import { throwIfNull } from '../error_handling';
import { KeyboardHandler } from './keyboard-handler';
import Fuse from 'fuse.js';
import {
  IBookmarkTreeNode,
  IVisitSearchResult,
  IUnifiedSearchResult,
} from '../types';
import { SelectionManager } from './selection-manager';
import { VisitStorageManager } from './visit-storage-manager';
import { SearchScorer } from './search-scorer';
import { addProtocalToUrl, flattenBookmarks, removeUrlParams } from './utils';
import { BookmarkRenderer } from './bookmark-renderer';
import {
  IErrorManager,
  errorManager as defaultErrorManager,
} from '../feature/error-manager';

export class Searching {
  private readonly searchBox: HTMLInputElement;
  private readonly resultsContainer: HTMLElement;
  private readonly keyboardHandler: KeyboardHandler;
  private readonly errorManager: IErrorManager;

  private readonly selectionManager = new SelectionManager();
  private readonly visitStorageManager: VisitStorageManager;
  private readonly searchScorer = new SearchScorer();

  private allBookmarks: IBookmarkTreeNode[] = [];
  private filteredBookmarks: IBookmarkTreeNode[] = [];
  private fuse: Fuse<IBookmarkTreeNode> | null = null;
  private visitFuse: Fuse<IVisitSearchResult> | null = null;

  constructor(errorManager?: IErrorManager) {
    this.errorManager = errorManager || defaultErrorManager;
    this.visitStorageManager = new VisitStorageManager(this.errorManager);

    this.searchBox = document.getElementById('searchBox') as HTMLInputElement;
    this.resultsContainer =
      document.getElementById('search-result') ??
      throwIfNull('search-result cannot be null');

    this.keyboardHandler = new KeyboardHandler(
      () => this.openSelectedBookmark(),
      () => this.moveSelection(1),
      () => this.moveSelection(-1),
      () => window.close()
    );

    this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.loadBookmarks();
    } catch (error) {
      const errorMsg = `Failed to load bookmarks: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errorManager.addError(errorMsg);
      this.showError('Failed to load bookmarks. Please try again.');
      return;
    }

    // Load visit data with error handling - don't let this block the UI
    try {
      await this.visitStorageManager.loadVisitData();
      await this.setupVisitSearch();
    } catch (error) {
      // Don't add to error manager here as VisitStorageManager already handles its errors
      console.warn(
        'Failed to load visit data, continuing with bookmark-only search:',
        error
      );
      // Continue initialization even if visit tracking fails
    }

    try {
      this.setupEventListeners();
      this.hideResults();
      this.searchBox.focus();
    } catch (error) {
      this.errorManager.addError(
        `Failed to initialize search interface: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async loadBookmarks(): Promise<void> {
    try {
      if (!chrome?.bookmarks) {
        throw new Error('Chrome bookmarks API is not available');
      }

      const bookmarkTree = await chrome.bookmarks.getTree();
      this.allBookmarks = flattenBookmarks(bookmarkTree);

      this.fuse = new Fuse<IBookmarkTreeNode>(this.allBookmarks, {
        keys: [
          { name: 'title', weight: 0.7 },
          { name: 'url', weight: 0.3 },
        ],
        threshold: 0.4,
        distance: 100,
        minMatchCharLength: 1,
        includeScore: true,
        shouldSort: true,
      });

      console.log('Loaded bookmarks:', this.allBookmarks.length);
    } catch (error) {
      const errorMsg = `Error loading bookmarks: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errorManager.addError(errorMsg);
      throw error; // Re-throw to be handled by init()
    }
  }

  private async setupVisitSearch(): Promise<void> {
    try {
      const visitData = this.visitStorageManager.getAllVisitData();
      const visitSearchResults: IVisitSearchResult[] = [];

      // Convert visit data to searchable format
      for (const [normalizedUrl, visitInfo] of Object.entries(visitData)) {
        if (visitInfo.count > 0) {
          const displayUrl = visitInfo.originalUrl || normalizedUrl;
          visitSearchResults.push({
            url: displayUrl,
            title: visitInfo.title || displayUrl,
            visitCount: visitInfo.count,
            lastVisited: visitInfo.lastVisited,
            type: 'visit',
          });
        }
      }

      // Setup Fuse for visit data search
      this.visitFuse = new Fuse<IVisitSearchResult>(visitSearchResults, {
        keys: [
          { name: 'title', weight: 0.7 },
          { name: 'url', weight: 0.3 },
        ],
        threshold: 0.4,
        distance: 100,
        minMatchCharLength: 1,
        includeScore: true,
        shouldSort: true,
      });

      console.log('Loaded visit data for search:', visitSearchResults.length);
    } catch (error) {
      console.error('Error setting up visit search:', error);
      // Don't throw - allow search to continue without visit data
    }
  }

  private setupEventListeners(): void {
    this.searchBox.addEventListener('input', () => {
      const query = this.searchBox.value.trim();
      if (query) {
        this.searchBookmarks(query);
      } else {
        this.showMostVisited();
      }
    });

    this.searchBox.addEventListener(
      'keydown',
      this.keyboardHandler.handleKeyDown
    );
  }

  private showMostVisited(): void {
    try {
      const visitData = this.visitStorageManager.getAllVisitData();
      const visitEntries = Object.entries(visitData)
        .filter(([, data]) => data.count > 0)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10); // Show top 10 most visited

      this.filteredBookmarks = visitEntries.map(([normalizedUrl, data]) => {
        const displayUrl = data.originalUrl || normalizedUrl;
        return {
          id: `visit_${normalizedUrl}`,
          title: data.title || displayUrl,
          url: displayUrl,
          dateAdded: data.lastVisited,
          index: 0,
          parentId: 'visits',
        } as IBookmarkTreeNode;
      });

      this.selectionManager.reset();
      this.displayBookmarks();
    } catch (error) {
      console.debug('Failed to show most visited, hiding results:', error);
      this.hideResults();
    }
  }

  private searchBookmarks(query: string): void {
    if (!this.fuse) {
      throw new Error('unable to search due to bookmark failed to load');
    }

    try {
      // Perform unified search combining bookmarks and visit data
      const unifiedResults = this.performUnifiedSearch(query);

      // Extract bookmarks from unified results for display
      this.filteredBookmarks = unifiedResults.map(result => {
        if (result.type === 'bookmark') {
          return result.item as IBookmarkTreeNode;
        } else {
          // Convert visit result to bookmark-like structure for display
          const visitResult = result.item as IVisitSearchResult;
          return {
            id: `visit_${visitResult.url}`,
            title: visitResult.title,
            url: visitResult.url,
            dateAdded: visitResult.lastVisited,
            index: 0,
            parentId: 'visits',
          } as IBookmarkTreeNode;
        }
      });

      this.selectionManager.reset();
      this.displayBookmarks();
    } catch (error) {
      console.error('Search failed:', error);
      // Show error but don't break the UI
      this.showError('Search temporarily unavailable. Please try again.');
      this.filteredBookmarks = [];
      this.selectionManager.reset();
      this.displayBookmarks();
    }
  }

  private performUnifiedSearch(query: string): IUnifiedSearchResult[] {
    const unifiedResults: IUnifiedSearchResult[] = [];
    const seenUrls = new Set<string>();

    try {
      // Search bookmarks first (higher priority)
      const bookmarkResults = this.fuse!.search(query);
      for (const result of bookmarkResults) {
        const bookmark = result.item;
        if (bookmark.url) {
          const urlWithoutParams = removeUrlParams(bookmark.url);
          const normalizedUrl = this.normalizeUrl(urlWithoutParams);
          seenUrls.add(normalizedUrl);

          const visitCount =
            this.visitStorageManager.getVisitCount(urlWithoutParams);
          unifiedResults.push({
            item: bookmark,
            score: result.score || 1,
            type: 'bookmark',
            visitCount: visitCount,
          });
        }
      }

      // Search visit data if available
      if (this.visitFuse) {
        const visitResults = this.visitFuse.search(query);
        for (const result of visitResults) {
          const visitResult = result.item;
          const normalizedUrl = this.normalizeUrl(
            removeUrlParams(visitResult.url)
          );

          // Skip if we already have this URL from bookmarks (deduplication)
          if (!seenUrls.has(normalizedUrl)) {
            seenUrls.add(normalizedUrl);
            unifiedResults.push({
              item: visitResult,
              score: result.score || 1,
              type: 'visit',
              visitCount: visitResult.visitCount,
            });
          }
        }
      }

      // Use SearchScorer to enhance results with proper visit frequency ranking
      const visitData = this.visitStorageManager.getAllVisitData();
      const enhancedResults = this.searchScorer.enhanceUnifiedSearchResults(
        unifiedResults,
        visitData
      );

      return enhancedResults;
    } catch (error) {
      console.error('Unified search failed:', error);
      // Fallback to bookmark-only search
      const bookmarkResults = this.fuse!.search(query);
      return bookmarkResults.map(result => ({
        item: result.item,
        score: result.score || 1,
        type: 'bookmark' as const,
        visitCount: 0,
        finalScore: result.score || 1,
      }));
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      let normalized = urlObj.hostname + urlObj.pathname;

      // Remove www prefix
      if (normalized.startsWith('www.')) {
        normalized = normalized.substring(4);
      }

      // Remove trailing slash
      if (normalized.endsWith('/') && normalized.length > 1) {
        normalized = normalized.slice(0, -1);
      }

      return normalized.toLowerCase();
    } catch {
      // If URL parsing fails, return the original URL cleaned up
      return url
        .replace(/^https?:\/\/(www\.)?/, '')
        .replace(/\/$/, '')
        .toLowerCase();
    }
  }

  private hideResults(): void {
    this.resultsContainer.innerHTML = '';
    this.filteredBookmarks = [];
    this.selectionManager.reset();
    this.adjustPopupSize();
  }

  private displayBookmarks(): void {
    this.resultsContainer.innerHTML = BookmarkRenderer.renderBookmarks(
      this.filteredBookmarks
    );
    this.attachEventListeners();
    this.selectionManager.updateVisualSelection(this.resultsContainer);
    this.adjustPopupSize();
  }

  private attachEventListeners(): void {
    this.resultsContainer
      .querySelectorAll('.bookmark-item')
      .forEach((item, index) => {
        item.addEventListener('click', async () => {
          const url = item.getAttribute('data-url');
          if (url) await this.openBookmark(url);
        });

        item.addEventListener('mouseenter', () => {
          this.selectionManager.setIndex(index);
          this.selectionManager.updateVisualSelection(this.resultsContainer);
        });
      });
  }

  private adjustPopupSize(): void {
    setTimeout(() => {
      const searchHeight = this.searchBox.offsetHeight + 32;
      const resultsHeight = this.resultsContainer.scrollHeight;
      const totalHeight = Math.max(
        80,
        Math.min(600, searchHeight + resultsHeight)
      );
      document.body.style.height = `${totalHeight}px`;
    }, 0);
  }

  private moveSelection(direction: number): void {
    this.selectionManager.moveWithContainer(direction, this.resultsContainer);
  }

  private async openSelectedBookmark(): Promise<void> {
    const bookmark = this.selectionManager.getSelectedBookmark(
      this.filteredBookmarks
    );
    if (bookmark?.url) await this.openBookmark(bookmark.url);
  }

  private async openBookmark(rawUrl: string): Promise<void> {
    const url = addProtocalToUrl(rawUrl);
    try {
      // Open bookmark - visit tracking will be handled automatically by the background script
      await chrome.tabs.create({ url });
      window.close();
    } catch (error) {
      this.errorManager.addError(
        `Failed to open bookmark: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Try to open bookmark anyway as fallback
      try {
        await chrome.tabs.create({ url });
        window.close();
      } catch (fallbackError) {
        this.errorManager.addError(
          `Fallback bookmark opening also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
        );
        this.showError('Failed to open bookmark. Please try again.');
      }
    }
  }

  private showError(message: string): void {
    this.resultsContainer.innerHTML = `<div class="no-results">${message}</div>`;
    this.adjustPopupSize();
  }
}
