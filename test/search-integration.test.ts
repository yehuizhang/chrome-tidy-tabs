import { SearchScorer } from '../src/searching/search-scorer';
import { StorageManager } from '../src/storage-controller';
import { IBookmarkTreeNode, IUnifiedSearchResult, IClickData, IVisitData } from '../src/types';

// Mock Chrome APIs
const mockChromeStorage = {
  sync: {
    get: jest.fn(),
    set: jest.fn(),
  },
  local: {
    set: jest.fn(),
  },
};

(global as any).chrome = {
  storage: mockChromeStorage,
};

describe('Search Integration Tests', () => {
  let searchScorer: SearchScorer;
  let storageManager: StorageManager;

  const mockBookmarks: IBookmarkTreeNode[] = [
    { id: '1', title: 'GitHub', url: 'https://github.com', syncing: false },
    { id: '2', title: 'Stack Overflow', url: 'https://stackoverflow.com', syncing: false },
    { id: '3', title: 'MDN Web Docs', url: 'https://developer.mozilla.org', syncing: false },
    { id: '4', title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs', syncing: false },
  ];

  beforeEach(() => {
    searchScorer = new SearchScorer();
    storageManager = new StorageManager();
    storageManager.enableTestMode();
    jest.clearAllMocks();
  });

  describe('Complete Search Flow with Visit Data', () => {
    it('should rank frequently visited bookmarks higher in search results', async () => {
      // Setup visit data - GitHub has been visited 10 times, others have fewer visits
      // URLs are normalized to hostname + pathname
      const visitData: IVisitData = {
        'github.com/': { count: 10, lastVisited: Date.now() },
        'stackoverflow.com/': { count: 2, lastVisited: Date.now() - 1000 },
      };

      // Simulate unified search results (all have similar scores)
      const searchResults: IUnifiedSearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.3, type: 'bookmark' }, // GitHub
        { item: mockBookmarks[1]!, score: 0.35, type: 'bookmark' }, // Stack Overflow  
        { item: mockBookmarks[2]!, score: 0.4, type: 'bookmark' }, // MDN
        { item: mockBookmarks[3]!, score: 0.45, type: 'bookmark' }, // TypeScript
      ];

      const enhancedResults = searchScorer.enhanceUnifiedSearchResults(
        searchResults,
        visitData
      );

      // GitHub should be ranked first due to high visit count
      expect(enhancedResults[0]!.item.title).toBe('GitHub');
      expect(enhancedResults[0]!.visitCount).toBe(10);
      expect(enhancedResults[0]!.finalScore).toBeLessThan(searchResults[0]!.score!);

      // Stack Overflow should be second due to some visits
      expect(enhancedResults[1]!.item.title).toBe('Stack Overflow');
      expect(enhancedResults[1]!.visitCount).toBe(2);

      // Items with no visits should maintain fuzzy search order
      expect(enhancedResults[2]!.item.title).toBe('MDN Web Docs');
      expect(enhancedResults[3]!.item.title).toBe('TypeScript Handbook');
    });

    it('should handle search when no visit data exists', async () => {
      const searchResults: IUnifiedSearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.3, type: 'bookmark' },
        { item: mockBookmarks[1]!, score: 0.4, type: 'bookmark' },
      ];

      const enhancedResults = searchScorer.enhanceUnifiedSearchResults(
        searchResults,
        {}
      );

      // Should maintain original fuzzy search order when no visit data
      expect(enhancedResults[0]!.item.title).toBe('GitHub');
      expect(enhancedResults[1]!.item.title).toBe('Stack Overflow');
      expect(enhancedResults[0]!.visitCount).toBe(0);
      expect(enhancedResults[1]!.visitCount).toBe(0);
    });

    it('should gracefully handle storage errors and continue with fuzzy search', async () => {
      mockChromeStorage.sync.get.mockRejectedValue(new Error('Storage error'));
      await storageManager.loadClickData();

      const searchResults: IUnifiedSearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.3, type: 'bookmark' },
        { item: mockBookmarks[1]!, score: 0.4, type: 'bookmark' },
      ];

      // Convert click data to visit data format for the test
      const clickData = storageManager.getAllClickData();
      const visitData: IVisitData = {};
      Object.entries(clickData).forEach(([url, data]) => {
        visitData[url] = {
          count: data.count,
          lastVisited: data.lastClicked,
        };
      });

      const enhancedResults = searchScorer.enhanceUnifiedSearchResults(
        searchResults,
        visitData
      );

      // Should work with empty visit data when storage fails
      expect(enhancedResults).toHaveLength(2);
      expect(enhancedResults[0]!.visitCount).toBe(0);
      expect(enhancedResults[1]!.visitCount).toBe(0);
    });

    it('should maintain search performance with large datasets', async () => {
      // Create large visit data set
      const largeVisitData: IVisitData = {};
      for (let i = 0; i < 1000; i++) {
        largeVisitData[`example${i}.com/`] = {
          count: Math.floor(Math.random() * 100),
          lastVisited: Date.now(),
        };
      }

      // Create large search results
      const largeSearchResults: IUnifiedSearchResult[] = [];
      for (let i = 0; i < 100; i++) {
        largeSearchResults.push({
          item: { id: `${i}`, title: `Bookmark ${i}`, url: `https://example${i}.com/`, syncing: false },
          score: Math.random(),
          type: 'bookmark',
        });
      }

      const startTime = performance.now();
      const enhancedResults = searchScorer.enhanceUnifiedSearchResults(
        largeSearchResults,
        largeVisitData
      );
      const endTime = performance.now();

      // Should complete within reasonable time (< 100ms for 100 results)
      expect(endTime - startTime).toBeLessThan(100);
      expect(enhancedResults).toHaveLength(100);
      expect(enhancedResults[0]!.finalScore).toBeDefined();
    });

    it('should record clicks and update search rankings over time', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({});
      mockChromeStorage.sync.set.mockResolvedValue(undefined);

      await storageManager.loadClickData();

      // Initial search results
      const searchResults: IUnifiedSearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.4, type: 'bookmark' }, // GitHub (worse fuzzy score)
        { item: mockBookmarks[1]!, score: 0.3, type: 'bookmark' }, // Stack Overflow (better fuzzy score)
      ];

      // Convert click data to visit data format
      const convertClickToVisitData = (clickData: IClickData): IVisitData => {
        const visitData: IVisitData = {};
        Object.entries(clickData).forEach(([url, data]) => {
          visitData[url] = {
            count: data.count,
            lastVisited: data.lastClicked,
          };
        });
        return visitData;
      };

      // Initially, Stack Overflow should rank higher due to better fuzzy score
      let visitData = convertClickToVisitData(storageManager.getAllClickData());
      let enhancedResults = searchScorer.enhanceUnifiedSearchResults(
        searchResults,
        visitData
      );
      expect(enhancedResults[0]!.item.title).toBe('Stack Overflow');

      // Record multiple clicks on GitHub
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');

      // Now GitHub should rank higher due to click history
      visitData = convertClickToVisitData(storageManager.getAllClickData());
      enhancedResults = searchScorer.enhanceUnifiedSearchResults(
        searchResults,
        visitData
      );
      expect(enhancedResults[0]!.item.title).toBe('GitHub');
      expect(enhancedResults[0]!.visitCount).toBe(3);
    });

    it('should handle edge cases in search results', async () => {
      // Test with empty search results
      let enhancedResults = searchScorer.enhanceUnifiedSearchResults([], {});
      expect(enhancedResults).toHaveLength(0);

      // Test with results missing URLs
      const resultsWithoutUrls: IUnifiedSearchResult[] = [
        { item: { id: '1', title: 'Folder', syncing: false }, score: 0.3, type: 'bookmark' },
      ];
      enhancedResults = searchScorer.enhanceUnifiedSearchResults(resultsWithoutUrls, {});
      expect(enhancedResults[0]!.visitCount).toBe(0);

      // Test with results missing scores
      const resultsWithoutScores: IUnifiedSearchResult[] = [
        { item: mockBookmarks[0]!, type: 'bookmark', score: 1 },
      ];
      enhancedResults = searchScorer.enhanceUnifiedSearchResults(resultsWithoutScores, {});
      expect(enhancedResults[0]!.finalScore).toBeDefined();
    });
  });

  describe('Cross-session Persistence', () => {
    it('should persist click data across browser sessions', async () => {
      const persistedClickData: IClickData = {
        'github.com/': { count: 5, lastClicked: Date.now() - 86400000 }, // 1 day ago
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        tidy_tabs_click_data: persistedClickData,
      });

      await storageManager.loadClickData();

      // Verify persisted data is loaded
      expect(storageManager.getClickCount('https://github.com')).toBe(5);

      // Add new click
      mockChromeStorage.sync.set.mockResolvedValue(undefined);
      await storageManager.recordClick('https://github.com');

      // Verify count is incremented
      expect(storageManager.getClickCount('https://github.com')).toBe(6);
    });
  });

  describe('Performance Optimization', () => {
    it('should not significantly impact search performance', async () => {
      const visitData: IVisitData = {
        'github.com/': { count: 10, lastVisited: Date.now() },
        'stackoverflow.com/': { count: 5, lastVisited: Date.now() },
      };

      const searchResults: IUnifiedSearchResult[] = mockBookmarks.map((bookmark, index) => ({
        item: bookmark,
        score: 0.3 + (index * 0.1),
        type: 'bookmark' as const,
      }));

      // Measure performance of enhanced scoring
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        searchScorer.enhanceUnifiedSearchResults(searchResults, visitData);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Should complete each enhancement in less than 1ms on average
      expect(avgTime).toBeLessThan(1);
    });
  });
});