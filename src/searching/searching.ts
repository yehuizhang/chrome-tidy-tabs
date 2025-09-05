import { throwIfNull } from '../error_handling';
import { KeyboardHandler } from './keyboard-handler';
import Fuse from 'fuse.js';
import { SearchEntry, SearchResult } from '../types';
import { SelectionManager } from './selection-manager';
import { VisitStorageManager } from './visit-storage-manager';
import { SearchRank } from './search-rank';
import { addProtocalToUrl } from './utils';
import { SearchResultRenderer } from '../ui/search-result-renderer';
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
  private readonly searchScorer = new SearchRank();

  private searchResults: SearchEntry[] = [];
  private fuse: Fuse<SearchEntry> | null = null;

  constructor(errorManager?: IErrorManager) {
    this.errorManager = errorManager || defaultErrorManager;
    this.searchBox = document.getElementById('searchBox') as HTMLInputElement;
    this.resultsContainer =
      document.getElementById('search-result') ??
      throwIfNull('search-result cannot be null');

    this.keyboardHandler = new KeyboardHandler(
      () => this.openSelectedItem(),
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
      this.setupSearchInputListener();
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
      const visitSearchEntries: SearchEntry[] = [];

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
      this.fuse = new Fuse<SearchEntry>(visitSearchEntries, {
        keys: [
          { name: 'title', weight: 0.7 },
          { name: 'url', weight: 0.3 },
        ],
        threshold: 0.4, // score >= 0.4 will be ignored
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

  private setupSearchInputListener(): void {
    this.searchBox.addEventListener('input', () => {
      const query = this.searchBox.value.trim();
      if (query) {
        try {
          const fuseResults: SearchResult[] = this.fuse!.search(query).map(
            result => ({
              item: result.item,
              fuseScore: result.score || 1,
            })
          );

          this.searchResults = this.searchScorer.rankSearchResults(fuseResults);
          this.selectionManager.reset();
          this.render();
        } catch (error) {
          console.error('Search failed:', error);
          // Show error but don't break the UI
          this.showError('Search temporarily unavailable. Please try again.');
          this.searchResults = [];
          this.selectionManager.reset();
          this.render();
        }
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
  //     this.searchResults = visitEntries.map(([url, data]) => {
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
  //     this.render();
  //   } catch (error) {
  //     console.debug('Failed to show most visited, hiding results:', error);
  //     this.hideResults();
  //   }
  // }

  private hideResults(): void {
    this.resultsContainer.innerHTML = '';
    this.searchResults = [];
    this.selectionManager.reset();
    this.adjustPopupSize();
  }

  private render(): void {
    this.resultsContainer.innerHTML = SearchResultRenderer.renderSearchResults(
      this.searchResults
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

  private async openSelectedItem(): Promise<void> {
    const bookmark = this.selectionManager.getSelectedBookmark(
      this.searchResults
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
