import { throwIfNull } from '../error_handling';
import { KeyboardHandler } from './keyboard-handler';
import Fuse from 'fuse.js';
import {
  IBookmarkTreeNode,
  IUnifiedSearchResult,
  IVisitSearchEntry,
} from '../types';
import { SelectionManager } from './selection-manager';
import { VisitStorageManager } from './visit-storage-manager';
import { SearchScorer } from './search-scorer';
import { addProtocalToUrl } from './utils';
import { BookmarkRenderer } from './bookmark-renderer';
import {
  errorManager as defaultErrorManager,
  IErrorManager,
} from '../feature/error-manager';

export class Searching {
  private readonly searchBox: HTMLInputElement;
  private readonly resultsContainer: HTMLElement;
  private readonly keyboardHandler: KeyboardHandler;
  private readonly errorManager: IErrorManager;

  private readonly selectionManager = new SelectionManager();
  private visitStorageManager: VisitStorageManager | undefined;
  private readonly searchScorer = new SearchScorer();

  private filteredBookmarks: IBookmarkTreeNode[] = [];
  private fuse: Fuse<IVisitSearchEntry> | null = null;

  constructor(errorManager?: IErrorManager) {
    this.errorManager = errorManager || defaultErrorManager;
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
    this.visitStorageManager = await VisitStorageManager.getInstance();

    // Load visit data with error handling - don't let this block the UI
    try {
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

  private async setupVisitSearch(): Promise<void> {
    if (!this.visitStorageManager) {
      return;
    }
    try {
      const visitData = this.visitStorageManager.getAllVisitData();
      const visitSearchEntries: IVisitSearchEntry[] = [];

      // Convert visit data to searchable format
      for (const [url, visitInfo] of Object.entries(visitData)) {
        let title =
          `${visitInfo.customTitle || ''} | ${visitInfo.title || ''}`.trim();
        if (title.startsWith('|')) {
          title = title.substring(1).trim();
        }
        if (title.endsWith('|')) {
          title = title.substring(0, title.length - 1).trim();
        }
        visitSearchEntries.push({
          url: url,
          title: title || url,
          visitCount: visitInfo.count,
          lastVisited: visitInfo.lastVisited,
        });
      }

      // Setup Fuse for visit data search
      this.fuse = new Fuse<IVisitSearchEntry>(visitSearchEntries, {
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

      console.log('Loaded visit data for search:', visitSearchEntries.length);
    } catch (error) {
      console.error('Error setting up visit search:', error);
      // Don't throw - allow search to continue without visit data
    }
  }

  private setupEventListeners(): void {
    this.searchBox.addEventListener('input', () => {
      const query = this.searchBox.value.trim();
      if (query) {
        this.searchFromStorage(query);
      }

      // else {
      //   this.showMostVisited();
      // }
    });

    this.searchBox.addEventListener(
      'keydown',
      this.keyboardHandler.handleKeyDown
    );
  }

  // private showMostVisited(): void {
  //   if (!this.visitStorageManager) {
  //     return;
  //   }
  //   try {
  //     const visitData = this.visitStorageManager.getAllVisitData();
  //     const visitEntries = Object.entries(visitData)
  //       .filter(([, data]) => data.count > 0)
  //       .sort(([, a], [, b]) => b.count - a.count)
  //       .slice(0, 10); // Show top 10 most visited
  //
  //     this.filteredBookmarks = visitEntries.map(([url, data]) => {
  //       return {
  //         id: `visit_${url}`,
  //         title: data.title || url,
  //         url: url,
  //         dateAdded: data.lastVisited,
  //         index: 0,
  //         parentId: 'visits',
  //       } as IBookmarkTreeNode;
  //     });
  //
  //     this.selectionManager.reset();
  //     this.displayBookmarks();
  //   } catch (error) {
  //     console.debug('Failed to show most visited, hiding results:', error);
  //     this.hideResults();
  //   }
  // }

  private searchFromStorage(query: string): void {
    try {
      // Perform unified search combining bookmarks and visit data
      const unifiedResults = this.performUnifiedSearch(query);

      // Extract bookmarks from unified results for display
      this.filteredBookmarks = unifiedResults.map(result => {
        if (result.type === 'bookmark') {
          return result.item as IBookmarkTreeNode;
        } else {
          // Convert visit result to bookmark-like structure for display
          const visitResult = result.item as IVisitSearchEntry;
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

    if (!this.visitStorageManager) {
      console.debug(
        'Visit storage manager not available, returning empty results'
      );
      return unifiedResults;
    }

    try {
      // Search visit data if available
      if (this.fuse) {
        const visitResults = this.fuse.search(query);
        for (const result of visitResults) {
          const visitResult = result.item;

          // Skip if we already have this URL from bookmarks (deduplication)
          if (!seenUrls.has(visitResult.url)) {
            seenUrls.add(visitResult.url);
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

      return this.searchScorer.enhanceUnifiedSearchResults(
        unifiedResults,
        visitData
      );
    } catch (error) {
      console.error('Error in unified search:', error);
      return unifiedResults;
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
