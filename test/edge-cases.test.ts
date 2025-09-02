/**
 * Edge cases and error condition tests for bookmark history tracking
 * Tests unusual scenarios, error conditions, and boundary cases
 */

import { StorageManager } from '../src/searching/storage-manager';
import { SearchScorer } from '../src/searching/search-scorer';
import { ISearchResult, IClickData } from '../src/searching/types';
import { mockChromeStorage } from './setup';
import { createMockBookmark } from './test-helpers';

describe('Edge Cases and Error Conditions', () => {
  let storageManager: StorageManager;
  let searchScorer: SearchScorer;

  beforeEach(() => {
    storageManager = new StorageManager();
    storageManager.enableTestMode();
    searchScorer = new SearchScorer();
    // Don't override the persistent mock storage behavior from setup.ts
  });

  describe('URL Edge Cases', () => {
    it('should handle various URL formats correctly', async () => {
      await storageManager.loadClickData();

      const urlTestCases = [
        // Standard URLs
        { input: 'https://example.com', expected: 'example.com/' },
        { input: 'http://example.com', expected: 'example.com/' },
        { input: 'https://example.com/', expected: 'example.com/' },
        
        // URLs with paths
        { input: 'https://example.com/path', expected: 'example.com/path' },
        { input: 'https://example.com/path/', expected: 'example.com/path/' },
        { input: 'https://example.com/path/subpath', expected: 'example.com/path/subpath' },
        
        // URLs with query parameters (should be normalized)
        { input: 'https://example.com?param=value', expected: 'example.com/' },
        { input: 'https://example.com/path?param=value', expected: 'example.com/path' },
        { input: 'https://example.com?a=1&b=2', expected: 'example.com/' },
        
        // URLs with fragments (should be normalized)
        { input: 'https://example.com#section', expected: 'example.com/' },
        { input: 'https://example.com/path#section', expected: 'example.com/path' },
        
        // URLs with both query and fragment
        { input: 'https://example.com/path?param=value#section', expected: 'example.com/path' },
        
        // Subdomains
        { input: 'https://sub.example.com', expected: 'sub.example.com/' },
        { input: 'https://www.example.com', expected: 'www.example.com/' },
        
        // Ports
        { input: 'https://example.com:8080', expected: 'example.com:8080/' },
        { input: 'http://localhost:3000/app', expected: 'localhost:3000/app' },
        
        // Special characters in paths
        { input: 'https://example.com/path%20with%20spaces', expected: 'example.com/path%20with%20spaces' },
        { input: 'https://example.com/path-with-dashes', expected: 'example.com/path-with-dashes' },
        { input: 'https://example.com/path_with_underscores', expected: 'example.com/path_with_underscores' },
      ];

      // Track expected counts for normalized URLs
      const expectedCounts: { [key: string]: number } = {};
      
      for (const testCase of urlTestCases) {
        await storageManager.recordClick(testCase.input);
        
        // Update expected count for this normalized URL
        expectedCounts[testCase.expected] = (expectedCounts[testCase.expected] || 0) + 1;
        
        // Verify the click count matches expected for this normalized URL
        expect(storageManager.getClickCount(testCase.input)).toBe(expectedCounts[testCase.expected]);
        
        // Verify the normalized URL is used internally
        const allData = storageManager.getAllClickData();
        expect(allData[testCase.expected]).toBeDefined();
        expect(allData[testCase.expected]?.count).toBe(expectedCounts[testCase.expected]);
      }
    });

    it('should handle malformed and edge case URLs gracefully', async () => {
      await storageManager.loadClickData();

      const malformedUrls = [
        'not-a-url',
        'http://',
        'https://',
        'https:///',
        '',
        ' ',
        'javascript:void(0)',
        'data:text/html,<h1>Test</h1>',
        'chrome://settings',
        'chrome-extension://abc123/popup.html',
        'file:///local/file.html',
        'ftp://example.com/file.txt',
        'mailto:test@example.com',
        'tel:+1234567890',
        'about:blank',
        'blob:https://example.com/abc-123',
        'ws://example.com/socket',
        'wss://example.com/socket',
      ];

      // Should not throw errors for any malformed URL
      for (const url of malformedUrls) {
        await expect(storageManager.recordClick(url)).resolves.not.toThrow();
        expect(storageManager.getClickCount(url)).toBeGreaterThanOrEqual(0);
      }

      // Should be able to search with these URLs
      const searchResults: ISearchResult[] = malformedUrls.map((url, index) => ({
        item: createMockBookmark(`${index}`, `Item ${index}`, url),
        score: Math.random(),
      }));

      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );

      expect(enhancedResults).toHaveLength(malformedUrls.length);
      for (const result of enhancedResults) {
        expect(result.finalScore).toBeDefined();
        expect(result.clickCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle extremely long URLs', async () => {
      await storageManager.loadClickData();

      // Create very long URL
      const longPath = 'very/'.repeat(1000) + 'long/path';
      const longUrl = `https://example.com/${longPath}`;
      const longQuery = '?param=' + 'a'.repeat(1000);
      const veryLongUrl = longUrl + longQuery;

      await storageManager.recordClick(veryLongUrl);
      expect(storageManager.getClickCount(veryLongUrl)).toBe(1);

      // Should handle in search
      const searchResults: ISearchResult[] = [{
        item: createMockBookmark('1', 'Long URL', veryLongUrl),
        score: 0.5,
      }];

      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );

      expect(enhancedResults).toHaveLength(1);
      expect(enhancedResults[0]!.clickCount).toBe(1);
    });

    it('should handle Unicode and international domain names', async () => {
      await storageManager.loadClickData();

      const unicodeUrls = [
        'https://例え.テスト',
        'https://пример.испытание',
        'https://مثال.اختبار',
        'https://उदाहरण.परीक्षा',
        'https://example.中国',
        'https://test.рф',
      ];

      for (const url of unicodeUrls) {
        await expect(storageManager.recordClick(url)).resolves.not.toThrow();
        expect(storageManager.getClickCount(url)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Data Corruption and Recovery', () => {
    it('should handle completely corrupted storage data', async () => {
      const corruptedDataCases = [
        null,
        undefined,
        'string instead of object',
        123,
        [],
        { webpage_click_data: 'not an object' },
        { webpage_click_data: null },
        { webpage_click_data: [] },
      ];

      for (const corruptedData of corruptedDataCases) {
        mockChromeStorage.sync.get.mockResolvedValueOnce(corruptedData);
        
        const storageManager = new StorageManager();
        storageManager.enableTestMode();
        await expect(storageManager.loadClickData()).resolves.not.toThrow();
        expect(storageManager.getAllClickData()).toEqual({});
      }
    });

    it('should handle partially corrupted click data entries', async () => {
      const partiallyCorruptedData = {
        webpage_click_data: {
          // Valid entries
          'valid1.com/': { count: 5, lastClicked: Date.now() },
          'valid2.com/': { count: 10, lastClicked: Date.now() - 1000 },
          
          // Invalid entries - various corruption types
          'invalid1.com/': null,
          'invalid2.com/': 'string',
          'invalid3.com/': { count: 'not a number', lastClicked: Date.now() },
          'invalid4.com/': { count: 5 }, // missing lastClicked
          'invalid5.com/': { lastClicked: Date.now() }, // missing count
          'invalid6.com/': { count: -1, lastClicked: Date.now() }, // negative count
          'invalid7.com/': { count: 5, lastClicked: 0 }, // invalid timestamp
          'invalid8.com/': { count: Infinity, lastClicked: Date.now() }, // infinite count
          'invalid9.com/': { count: 5, lastClicked: NaN }, // NaN timestamp
          '': { count: 5, lastClicked: Date.now() }, // empty URL
        },
      };

      mockChromeStorage.sync.get.mockResolvedValue(partiallyCorruptedData);

      await storageManager.loadClickData();
      const cleanedData = storageManager.getAllClickData();

      // Should only keep valid entries
      expect(cleanedData['valid1.com/']).toEqual({ count: 5, lastClicked: expect.any(Number) });
      expect(cleanedData['valid2.com/']).toEqual({ count: 10, lastClicked: expect.any(Number) });
      
      // Invalid entries should be removed
      expect(cleanedData['invalid1.com/']).toBeUndefined();
      expect(cleanedData['invalid2.com/']).toBeUndefined();
      expect(cleanedData['invalid3.com/']).toBeUndefined();
      expect(cleanedData['invalid4.com/']).toBeUndefined();
      expect(cleanedData['invalid5.com/']).toBeUndefined();
      expect(cleanedData['invalid6.com/']).toBeUndefined();
      expect(cleanedData['invalid7.com/']).toBeUndefined();
      expect(cleanedData['invalid8.com/']).toBeUndefined();
      expect(cleanedData['invalid9.com/']).toBeUndefined();
      expect(cleanedData['']).toBeUndefined();
    });

    it('should handle storage version incompatibility', async () => {
      // Future version data
      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: { 'example.com/': { count: 5, lastClicked: Date.now() } },
        webpage_click_data_version: 999, // Future version
      });

      const data = await storageManager.loadClickData();
      expect(data).toEqual({}); // Should reset for compatibility
    });

    it('should recover from storage corruption during save', async () => {
      await storageManager.loadClickData();

      // Simulate storage corruption during save
      mockChromeStorage.sync.set.mockRejectedValue(new Error('Storage corrupted'));

      // Should not throw and should continue working
      await expect(storageManager.recordClick('https://example.com')).resolves.not.toThrow();
      
      // Data should still be available in memory
      expect(storageManager.getClickCount('https://example.com')).toBe(1);
    });
  });

  describe('Chrome Extension Context Edge Cases', () => {
    it('should handle extension context invalidation', async () => {
      const contextError = new Error('The extension context invalidated');
      mockChromeStorage.sync.get.mockRejectedValue(contextError);
      mockChromeStorage.sync.set.mockRejectedValue(contextError);

      await storageManager.loadClickData();
      await storageManager.recordClick('https://example.com');

      // Should continue working with fallback behavior
      expect(storageManager.getAllClickData()).toBeDefined();
    });

    it('should handle Chrome API unavailability', async () => {
      // Simulate Chrome API not available
      const originalChrome = (global as any).chrome;
      (global as any).chrome = undefined;

      const localStorageManager = new StorageManager();
      localStorageManager.enableTestMode();

      await expect(localStorageManager.loadClickData()).resolves.not.toThrow();
      await expect(localStorageManager.recordClick('https://example.com')).resolves.not.toThrow();
      expect(localStorageManager.isStorageAvailable()).toBe(false);

      // Restore Chrome API
      (global as any).chrome = originalChrome;
    });

    it('should handle partial Chrome API availability', async () => {
      // Simulate partial Chrome API
      (global as any).chrome = {
        storage: undefined,
      };

      const storageManager = new StorageManager();
      storageManager.enableTestMode();
      await expect(storageManager.loadClickData()).resolves.not.toThrow();
      expect(storageManager.getAllClickData()).toEqual({});
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle maximum click counts', async () => {
      const maxSafeInteger = Number.MAX_SAFE_INTEGER;
      const testData: IClickData = {
        'max.com/': { count: maxSafeInteger, lastClicked: Date.now() },
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: testData,
      });

      await storageManager.loadClickData();
      expect(storageManager.getClickCount('https://max.com')).toBe(maxSafeInteger);

      // Should handle incrementing max value
      await storageManager.recordClick('https://max.com');
      // Note: This might overflow, but should not crash
      expect(storageManager.getClickCount('https://max.com')).toBeGreaterThan(maxSafeInteger);
    });

    it('should handle minimum and zero timestamps', async () => {
      const edgeTimestamps = [
        0,
        1,
        -1,
        Date.now(),
        Number.MAX_SAFE_INTEGER,
      ];

      for (const timestamp of edgeTimestamps) {
        const testData: IClickData = {
          'test.com/': { count: 1, lastClicked: timestamp },
        };

        mockChromeStorage.sync.get.mockResolvedValue({
          webpage_click_data: testData,
        });

        const storageManager = new StorageManager();
        storageManager.enableTestMode();
        await storageManager.loadClickData();

        if (timestamp > 0) {
          expect(storageManager.getClickCount('https://test.com')).toBe(1);
        } else {
          // Invalid timestamps should be filtered out
          expect(storageManager.getClickCount('https://test.com')).toBe(0);
        }
      }
    });

    it('should handle empty and single-character URLs', async () => {
      await storageManager.loadClickData();

      const edgeCaseUrls = [
        '',
        ' ',
        'a',
        'http://a',
        'https://a.b',
      ];

      for (const url of edgeCaseUrls) {
        await expect(storageManager.recordClick(url)).resolves.not.toThrow();
        expect(storageManager.getClickCount(url)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Search Enhancement Edge Cases', () => {
    it('should handle search results with missing or invalid data', async () => {
      const edgeCaseResults = [
        // Missing item
        { score: 0.5 } as ISearchResult,
        
        // Missing score
        { item: createMockBookmark('1', 'Test') } as ISearchResult,
        
        // Missing URL
        { item: createMockBookmark('2', 'No URL'), score: 0.3 } as ISearchResult,
        
        // Empty title
        { item: createMockBookmark('3', '', 'https://example.com'), score: 0.4 } as ISearchResult,
        
        // Invalid score values
        { item: createMockBookmark('4', 'Test', 'https://test.com'), score: NaN } as ISearchResult,
        { item: createMockBookmark('5', 'Test', 'https://test2.com'), score: Infinity } as ISearchResult,
        { item: createMockBookmark('6', 'Test', 'https://test3.com'), score: -1 } as ISearchResult,
      ];

      const clickData: IClickData = {
        'example.com/': { count: 5, lastClicked: Date.now() },
        'test.com/': { count: 3, lastClicked: Date.now() },
      };

      const enhancedResults = searchScorer.enhanceSearchResults(
        edgeCaseResults,
        clickData
      );

      expect(enhancedResults).toHaveLength(edgeCaseResults.length);
      
      for (const result of enhancedResults) {
        expect(result.finalScore).toBeDefined();
        expect(typeof result.finalScore).toBe('number');
        expect(result.clickCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle extreme scoring scenarios', async () => {
      const searchResults: ISearchResult[] = [
        { item: createMockBookmark('1', 'High Clicks', 'https://popular.com'), score: 0.9 }, // Bad fuzzy score
        { item: createMockBookmark('2', 'Perfect Match', 'https://perfect.com'), score: 0.0 }, // Perfect fuzzy score
        { item: createMockBookmark('3', 'No Clicks', 'https://new.com'), score: 0.1 }, // Good fuzzy, no clicks
      ];

      const extremeClickData: IClickData = {
        'popular.com/': { count: 10000, lastClicked: Date.now() }, // Extremely high clicks
        'perfect.com/': { count: 1, lastClicked: Date.now() }, // Low clicks
        // 'new.com' has no click data
      };

      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        extremeClickData
      );

      expect(enhancedResults).toHaveLength(3);
      
      // High clicks should overcome bad fuzzy score
      const popularResult = enhancedResults.find(r => r.item.url === 'https://popular.com');
      expect(popularResult?.clickCount).toBe(10000);
      
      // Perfect fuzzy score should still be competitive
      const perfectResult = enhancedResults.find(r => r.item.url === 'https://perfect.com');
      expect(perfectResult?.clickCount).toBe(1);
      
      // No clicks should fall back to fuzzy score
      const newResult = enhancedResults.find(r => r.item.url === 'https://new.com');
      expect(newResult?.clickCount).toBe(0);
    });

    it('should handle circular references and complex objects', async () => {
      // Create objects with circular references
      const circularBookmark: any = { id: '1', title: 'Circular' };
      circularBookmark.self = circularBookmark;

      const searchResults: ISearchResult[] = [
        { item: circularBookmark, score: 0.5 },
      ];

      // Should not crash with circular references
      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        {}
      );

      expect(enhancedResults).toHaveLength(1);
      expect(enhancedResults[0]!.finalScore).toBeDefined();
    });
  });

  describe('Concurrent Access Edge Cases', () => {
    it('should handle rapid successive operations on same data', async () => {
      await storageManager.loadClickData();

      const url = 'https://rapid.com';
      const operations = 100;

      // Fire many operations simultaneously
      const promises = Array(operations).fill(null).map(async (_, i) => {
        if (i % 2 === 0) {
          await storageManager.recordClick(url);
          return 'click';
        } else {
          return storageManager.getClickCount(url);
        }
      });

      await Promise.all(promises);
      
      // Should not crash and should have reasonable final count
      const finalCount = storageManager.getClickCount(url);
      expect(finalCount).toBeGreaterThan(0);
      expect(finalCount).toBeLessThanOrEqual(operations / 2);
    });

    it('should handle storage operations during data loading', async () => {
      // Simulate slow storage load
      let resolveLoad: (value: any) => void;
      const loadPromise = new Promise(resolve => {
        resolveLoad = resolve;
      });
      
      mockChromeStorage.sync.get.mockReturnValue(loadPromise);

      // Start loading
      const loadDataPromise = storageManager.loadClickData();

      // Try to record click while loading
      const recordPromise = storageManager.recordClick('https://example.com');

      // Resolve the load
      resolveLoad!({ webpage_click_data: {} });

      // Both operations should complete successfully
      await expect(Promise.all([loadDataPromise, recordPromise])).resolves.not.toThrow();
      expect(storageManager.getClickCount('https://example.com')).toBe(1);
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    it('should handle extremely large individual entries', async () => {
      const hugeUrl = 'https://example.com/' + 'a'.repeat(100000);
      
      await storageManager.loadClickData();
      await expect(storageManager.recordClick(hugeUrl)).resolves.not.toThrow();
      expect(storageManager.getClickCount(hugeUrl)).toBe(1);
    });

    it('should handle resource exhaustion gracefully', async () => {
      // Simulate out of memory during operations
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn().mockImplementation(() => {
        throw new Error('Out of memory');
      });

      try {
        await storageManager.loadClickData();
        await expect(storageManager.recordClick('https://example.com')).resolves.not.toThrow();
      } finally {
        JSON.stringify = originalStringify;
      }
    });
  });
});