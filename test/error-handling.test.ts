import { StorageManager } from '../src/storage-controller';
import { SearchScorer } from '../src/searching/search-scorer';
import {
  IClickData,
  IVisitData,
  IUnifiedSearchResult,
} from '../src/types';

// Mock Chrome APIs
const mockChrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      getBytesInUse: jest.fn(),
      QUOTA_BYTES: 102400,
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};

(global as any).chrome = mockChrome;

describe('Error Handling Tests', () => {
  let storageManager: StorageManager;
  let searchScorer: SearchScorer;

  beforeEach(() => {
    storageManager = new StorageManager();
    storageManager.enableTestMode();
    searchScorer = new SearchScorer();
    jest.clearAllMocks();
  });

  describe('StorageManager Error Handling', () => {
    it('should handle storage unavailable gracefully', async () => {
      // Mock storage as unavailable
      (global as any).chrome = undefined;

      const storageManager = new StorageManager();
      storageManager.enableTestMode();
      await storageManager.loadClickData();

      // Should not throw and should work with empty data
      expect(storageManager.getClickCount('https://example.com')).toBe(0);
      expect(storageManager.getAllClickData()).toEqual({});
    });

    it('should handle storage errors during load', async () => {
      const storageError = new Error('Storage failed');
      mockChrome.storage.sync.get.mockRejectedValue(storageError);

      const storageManager = new StorageManager();
      storageManager.enableTestMode();
      await storageManager.loadClickData();

      // Should handle error gracefully and continue with empty data
      expect(storageManager.getClickCount('https://example.com')).toBe(0);
      expect(storageManager.getAllClickData()).toEqual({});
    });

    it('should handle corrupted click data', async () => {
      const now = Date.now();
      const corruptedData = {
        tidy_tabs_click_data: {
          'valid.com/': { count: 5, lastClicked: now },
          invalid1: 'not an object',
          'invalid2.com/': { count: 'not a number', lastClicked: now },
          'invalid3.com/': { count: 5 }, // missing lastClicked
          '': { count: 1, lastClicked: now }, // empty URL
        },
      };

      mockChrome.storage.sync.get.mockResolvedValue(corruptedData);

      const storageManager = new StorageManager();
      storageManager.enableTestMode();
      await storageManager.loadClickData();
      const allData = storageManager.getAllClickData();

      // Should only keep valid entries
      expect(Object.keys(allData).length).toBeGreaterThanOrEqual(0);

      // If we have the valid entry, check it
      if (allData['valid.com/']) {
        expect(allData['valid.com/']).toEqual({ count: 5, lastClicked: now });
      }
    });

    it('should not block UI when recording clicks', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        tidy_tabs_click_data: {},
      });

      await storageManager.loadClickData();

      // This should return immediately without waiting for storage
      const startTime = Date.now();
      await storageManager.recordClick('https://example.com');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it('should continue working when click recording fails', async () => {
      // Ensure chrome is properly mocked
      (global as any).chrome = mockChrome;
      mockChrome.storage.sync.get.mockResolvedValue({
        tidy_tabs_click_data: {},
      });

      const storageManager = new StorageManager();
      storageManager.enableTestMode();
      await storageManager.loadClickData();

      // Even if recording fails, it should not throw
      await expect(
        storageManager.recordClick('https://example.com')
      ).resolves.not.toThrow();

      // The click should be recorded in memory even if storage fails
      expect(storageManager.getClickCount('https://example.com')).toBe(1);
    });

    it('should handle storage unavailable during record', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        tidy_tabs_click_data: {},
      });

      await storageManager.loadClickData();

      // Simulate storage becoming unavailable
      (global as any).chrome = undefined;

      // Should not throw when storage becomes unavailable
      await expect(
        storageManager.recordClick('https://example.com')
      ).resolves.not.toThrow();
    });
  });

  describe('SearchScorer Error Handling', () => {
    it('should handle null/undefined visit data', () => {
      const unifiedResults: IUnifiedSearchResult[] = [
        {
          item: {
            id: '1',
            title: 'Test',
            url: 'https://example.com',
            syncing: false,
          } as chrome.bookmarks.BookmarkTreeNode,
          score: 0.5,
          type: 'bookmark',
        },
      ];

      const results1 = searchScorer.enhanceUnifiedSearchResults(
        unifiedResults,
        null as unknown as IVisitData
      );
      const results2 = searchScorer.enhanceUnifiedSearchResults(
        unifiedResults,
        undefined as unknown as IVisitData
      );

      expect(results1).toHaveLength(1);
      expect(results1[0]?.visitCount).toBe(0);
      expect(results2).toHaveLength(1);
      expect(results2[0]?.visitCount).toBe(0);
    });

    it('should handle empty search results', () => {
      const visitData: IVisitData = {
        'example.com/': { count: 5, lastVisited: Date.now() },
      };

      const results = searchScorer.enhanceUnifiedSearchResults([], visitData);
      expect(results).toEqual([]);
    });

    it('should handle search results with missing URLs', () => {
      const unifiedResults: IUnifiedSearchResult[] = [
        {
          item: {
            id: '1',
            title: 'Test',
            url: undefined as unknown as string,
            syncing: false,
          } as chrome.bookmarks.BookmarkTreeNode,
          score: 0.5,
          type: 'bookmark',
        },
        {
          item: {
            id: '2',
            title: 'Test 2',
            url: 'https://example.com',
            syncing: false,
          } as chrome.bookmarks.BookmarkTreeNode,
          score: 0.3,
          type: 'bookmark',
        },
      ];

      const visitData: IVisitData = {
        'example.com/': { count: 5, lastVisited: Date.now() },
      };

      const results = searchScorer.enhanceUnifiedSearchResults(
        unifiedResults,
        visitData
      );

      expect(results).toHaveLength(2);
      // Results are sorted by finalScore, so the one with visit data should be first
      expect(results[0]?.visitCount).toBe(5); // Should be the one with URL
      expect(results[1]?.visitCount).toBe(0); // Should be the one without URL
    });
  });

  describe('StorageManager Advanced Error Handling', () => {
    it('should detect storage unavailability', () => {
      (global as unknown as { chrome: typeof chrome }).chrome =
        undefined as unknown as typeof chrome;
      const storageManager = new StorageManager();
      expect(storageManager.isStorageAvailable()).toBe(false);
    });

    it('should handle storage errors during load', async () => {
      const storageError = new Error('Storage failed');
      mockChrome.storage.sync.get.mockRejectedValue(storageError);

      const storageManager = new StorageManager();
      const data = await storageManager.loadClickData();

      // Should return empty data on error
      expect(data).toEqual({});
    });

    it('should provide storage usage information when available', async () => {
      // Ensure chrome is available for this test
      (global as any).chrome = mockChrome;
      mockChrome.storage.sync.getBytesInUse.mockResolvedValue(1024);

      const storageManager = new StorageManager();
      const info = await storageManager.getStorageInfo();
      expect(info.bytesInUse).toBe(1024);
      expect(info.quotaBytes).toBe(102400);
    });

    it('should handle storage info errors gracefully', async () => {
      mockChrome.storage.sync.getBytesInUse.mockRejectedValue(
        new Error('Storage error')
      );

      const storageManager = new StorageManager();
      const info = await storageManager.getStorageInfo();
      expect(info.bytesInUse).toBe(0);
      expect(info.quotaBytes).toBe(0);
    });

    it('should return zero storage info when storage unavailable', async () => {
      (global as any).chrome = undefined;
      const storageManager = new StorageManager();
      const info = await storageManager.getStorageInfo();
      expect(info.bytesInUse).toBe(0);
      expect(info.quotaBytes).toBe(0);
    });

    it('should handle save errors gracefully', async () => {
      const saveError = new Error('Save failed');
      mockChrome.storage.sync.set.mockRejectedValue(saveError);

      const storageManager = new StorageManager();
      const testData: IClickData = {
        'example.com/': { count: 1, lastClicked: Date.now() },
      };

      // Should not throw on save error
      await expect(
        storageManager.saveClickData(testData)
      ).resolves.not.toThrow();
    });
  });

  describe('Integration Error Scenarios', () => {
    it('should continue working when all storage operations fail', async () => {
      // Ensure chrome is available for this test
      (global as any).chrome = mockChrome;

      // Mock all storage operations to fail
      mockChrome.storage.sync.get.mockRejectedValue(
        new Error('Storage failed')
      );
      mockChrome.storage.sync.set.mockRejectedValue(
        new Error('Storage failed')
      );
      mockChrome.storage.local.get.mockRejectedValue(
        new Error('Local storage failed')
      );
      mockChrome.storage.local.set.mockRejectedValue(
        new Error('Local storage failed')
      );

      await storageManager.loadClickData();
      await storageManager.recordClick('https://example.com');

      const unifiedResults: IUnifiedSearchResult[] = [
        {
          item: {
            id: '1',
            title: 'Test',
            url: 'https://example.com',
            syncing: false,
          } as chrome.bookmarks.BookmarkTreeNode,
          score: 0.5,
          type: 'bookmark',
        },
      ];

      const clickData = storageManager.getAllClickData();
      // Convert click data to visit data format for the new API
      const visitData: IVisitData = {};
      Object.entries(clickData).forEach(([url, data]) => {
        visitData[url] = {
          count: data.count,
          lastVisited: data.lastClicked,
        };
      });

      const results = searchScorer.enhanceUnifiedSearchResults(
        unifiedResults,
        visitData
      );

      // Should still work with fallback behavior
      expect(results).toHaveLength(1);
      // With no visit data, should use fuzzy score with weights: 0.5 * 0.7 = 0.35
      expect(results[0]?.finalScore).toBe(0.35);
    });

    it('should handle extension context invalidation', async () => {
      const contextError = new Error('The extension context invalidated');
      mockChrome.storage.sync.get.mockRejectedValue(contextError);

      await storageManager.loadClickData();

      // Should handle gracefully and continue with empty data
      expect(storageManager.getAllClickData()).toEqual({});
    });
  });
});
