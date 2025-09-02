import { SearchScorer } from '../src/searching/search-scorer';
import { EnhancedStorageManager } from '../src/searching/enhanced-storage-manager';
import { IBookmarkTreeNode, ISearchResult, IClickData } from '../src/searching/types';

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
  let storageManager: EnhancedStorageManager;

  const mockBookmarks: IBookmarkTreeNode[] = [
    { id: '1', title: 'GitHub', url: 'https://github.com' },
    { id: '2', title: 'Stack Overflow', url: 'https://stackoverflow.com' },
    { id: '3', title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
    { id: '4', title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs' },
  ];

  beforeEach(() => {
    searchScorer = new SearchScorer();
    storageManager = new EnhancedStorageManager();
    storageManager.enableTestMode();
    jest.clearAllMocks();
  });

  describe('Complete Search Flow with Click Data', () => {
    it('should rank frequently clicked bookmarks higher in search results', async () => {
      // Setup click data - GitHub has been clicked 10 times, others have no clicks
      // URLs are normalized to hostname + pathname
      const clickData: IClickData = {
        'github.com/': { count: 10, lastClicked: Date.now() },
        'stackoverflow.com/': { count: 2, lastClicked: Date.now() - 1000 },
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: clickData,
      });

      await storageManager.loadClickData();

      // Simulate fuzzy search results (all have similar scores)
      const searchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.3 }, // GitHub
        { item: mockBookmarks[1]!, score: 0.35 }, // Stack Overflow  
        { item: mockBookmarks[2]!, score: 0.4 }, // MDN
        { item: mockBookmarks[3]!, score: 0.45 }, // TypeScript
      ];

      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        clickData
      );

      // GitHub should be ranked first due to high click count
      expect(enhancedResults[0]!.item.title).toBe('GitHub');
      expect(enhancedResults[0]!.clickCount).toBe(10);
      expect(enhancedResults[0]!.finalScore).toBeLessThan(searchResults[0]!.score!);

      // Stack Overflow should be second due to some clicks
      expect(enhancedResults[1]!.item.title).toBe('Stack Overflow');
      expect(enhancedResults[1]!.clickCount).toBe(2);

      // Items with no clicks should maintain fuzzy search order
      expect(enhancedResults[2]!.item.title).toBe('MDN Web Docs');
      expect(enhancedResults[3]!.item.title).toBe('TypeScript Handbook');
    });

    it('should handle search when no click data exists', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({});
      await storageManager.loadClickData();

      const searchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.3 },
        { item: mockBookmarks[1]!, score: 0.4 },
      ];

      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        {}
      );

      // Should maintain original fuzzy search order when no click data
      expect(enhancedResults[0]!.item.title).toBe('GitHub');
      expect(enhancedResults[1]!.item.title).toBe('Stack Overflow');
      expect(enhancedResults[0]!.clickCount).toBe(0);
      expect(enhancedResults[1]!.clickCount).toBe(0);
    });

    it('should gracefully handle storage errors and continue with fuzzy search', async () => {
      mockChromeStorage.sync.get.mockRejectedValue(new Error('Storage error'));
      await storageManager.loadClickData();

      const searchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.3 },
        { item: mockBookmarks[1]!, score: 0.4 },
      ];

      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );

      // Should work with empty click data when storage fails
      expect(enhancedResults).toHaveLength(2);
      expect(enhancedResults[0]!.clickCount).toBe(0);
      expect(enhancedResults[1]!.clickCount).toBe(0);
    });

    it('should maintain search performance with large datasets', async () => {
      // Create large click data set
      const largeClickData: IClickData = {};
      for (let i = 0; i < 1000; i++) {
        largeClickData[`example${i}.com/`] = {
          count: Math.floor(Math.random() * 100),
          lastClicked: Date.now(),
        };
      }

      // Create large search results
      const largeSearchResults: ISearchResult[] = [];
      for (let i = 0; i < 100; i++) {
        largeSearchResults.push({
          item: { id: `${i}`, title: `Bookmark ${i}`, url: `https://example${i}.com/` },
          score: Math.random(),
        });
      }

      const startTime = performance.now();
      const enhancedResults = searchScorer.enhanceSearchResults(
        largeSearchResults,
        largeClickData
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
      const searchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.4 }, // GitHub (worse fuzzy score)
        { item: mockBookmarks[1]!, score: 0.3 }, // Stack Overflow (better fuzzy score)
      ];

      // Initially, Stack Overflow should rank higher due to better fuzzy score
      let enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );
      expect(enhancedResults[0]!.item.title).toBe('Stack Overflow');

      // Record multiple clicks on GitHub
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');

      // Now GitHub should rank higher due to click history
      enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );
      expect(enhancedResults[0]!.item.title).toBe('GitHub');
      expect(enhancedResults[0]!.clickCount).toBe(3);
    });

    it('should handle edge cases in search results', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({});
      await storageManager.loadClickData();

      // Test with empty search results
      let enhancedResults = searchScorer.enhanceSearchResults([], {});
      expect(enhancedResults).toHaveLength(0);

      // Test with results missing URLs
      const resultsWithoutUrls: ISearchResult[] = [
        { item: { id: '1', title: 'Folder' }, score: 0.3 },
      ];
      enhancedResults = searchScorer.enhanceSearchResults(resultsWithoutUrls, {});
      expect(enhancedResults[0]!.clickCount).toBe(0);

      // Test with results missing scores
      const resultsWithoutScores: ISearchResult[] = [
        { item: mockBookmarks[0]! },
      ];
      enhancedResults = searchScorer.enhanceSearchResults(resultsWithoutScores, {});
      expect(enhancedResults[0]!.finalScore).toBeDefined();
    });
  });

  describe('Cross-session Persistence', () => {
    it('should persist click data across browser sessions', async () => {
      const persistedClickData: IClickData = {
        'github.com/': { count: 5, lastClicked: Date.now() - 86400000 }, // 1 day ago
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: persistedClickData,
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
      const clickData: IClickData = {
        'github.com/': { count: 10, lastClicked: Date.now() },
        'stackoverflow.com/': { count: 5, lastClicked: Date.now() },
      };

      const searchResults: ISearchResult[] = mockBookmarks.map((bookmark, index) => ({
        item: bookmark,
        score: 0.3 + (index * 0.1),
      }));

      // Measure performance of enhanced scoring
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        searchScorer.enhanceSearchResults(searchResults, clickData);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Should complete each enhancement in less than 1ms on average
      expect(avgTime).toBeLessThan(1);
    });
  });
});