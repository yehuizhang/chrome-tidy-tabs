import { throwIfNull } from '../error_handling';
import { KeyboardHandler } from './keyboard-handler';
import Fuse from 'fuse.js';
import { IBookmarkTreeNode, ISearchResult } from './types';
import { SelectionManager } from './selection-manager';
import { EnhancedStorageManager } from './enhanced-storage-manager';
import { SearchScorer } from './search-scorer';
import { flattenBookmarks } from './utils';
import { BookmarkRenderer } from './bookmark-renderer';

export class Searching {
  private readonly searchBox: HTMLInputElement;
  private readonly resultsContainer: HTMLElement;
  private readonly keyboardHandler: KeyboardHandler;

  private readonly selectionManager = new SelectionManager();
  private readonly storageManager = new EnhancedStorageManager();
  private readonly searchScorer = new SearchScorer();

  private allBookmarks: IBookmarkTreeNode[] = [];
  private filteredBookmarks: IBookmarkTreeNode[] = [];
  private fuse: Fuse<IBookmarkTreeNode> | null = null;

  constructor() {
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
      console.error('Failed to load bookmarks:', error);
      this.showError('Failed to load bookmarks. Please try again.');
      return;
    }

    // Load click data with error handling - don't let this block the UI
    try {
      await this.storageManager.loadClickData();
    } catch (error) {
      console.warn(
        'Failed to load click tracking data, continuing with basic search:',
        error
      );
      // Continue initialization even if click tracking fails
    }

    this.setupEventListeners();
    this.hideResults();
    this.searchBox.focus();
  }

  private async loadBookmarks(): Promise<void> {
    try {
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
      console.error('Error loading bookmarks:', error);
      this.showError('Failed to load bookmarks');
    }
  }

  private setupEventListeners(): void {
    this.searchBox.addEventListener('input', () => {
      const query = this.searchBox.value.trim();
      if (query) {
        this.searchBookmarks(query);
      } else {
        this.hideResults();
      }
    });

    this.searchBox.addEventListener(
      'keydown',
      this.keyboardHandler.handleKeyDown
    );
  }

  private searchBookmarks(query: string): void {
    if (!this.fuse) {
      throw new Error('unable to search due to bookmark failed to load');
    }

    try {
      // Get fuzzy search results from Fuse.js
      const fuseResults = this.fuse.search(query);

      // Convert Fuse results to ISearchResult format
      const searchResults: ISearchResult[] = fuseResults.map(result => ({
        item: result.item,
        score: result.score || 1,
      }));

      // Try to enhance results with click count data
      try {
        const clickData = this.storageManager.getAllClickData();
        const enhancedResults = this.searchScorer.enhanceSearchResults(
          searchResults,
          clickData
        );

        // Extract bookmarks in the new ranking order
        this.filteredBookmarks = enhancedResults.map(result => result.item);
      } catch (enhancementError) {
        console.debug(
          'Search enhancement failed, using basic fuzzy search:',
          enhancementError
        );
        // Fallback to basic fuzzy search if enhancement fails
        this.filteredBookmarks = searchResults.map(result => result.item);
      }

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

  private async openBookmark(url: string): Promise<void> {
    try {
      // Record the click before opening the bookmark (non-blocking)
      this.storageManager.recordClick(url).catch(error => {
        console.debug('Click tracking failed silently:', error);
      });

      // Open bookmark immediately without waiting for click tracking
      chrome.tabs.create({ url });
      window.close();
    } catch (error) {
      console.error('Failed to open bookmark:', error);
      // Try to open bookmark anyway
      try {
        chrome.tabs.create({ url });
        window.close();
      } catch (fallbackError) {
        console.error('Fallback bookmark opening also failed:', fallbackError);
        this.showError('Failed to open bookmark. Please try again.');
      }
    }
  }

  private showError(message: string): void {
    this.resultsContainer.innerHTML = `<div class="no-results">${message}</div>`;
    this.adjustPopupSize();
  }
}
