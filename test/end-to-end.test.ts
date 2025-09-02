/**
 * End-to-end tests for bookmark history tracking feature
 * Tests the complete flow from click tracking to search enhancement
 */

import { StorageManager } from '../src/searching/storage-manager';
import { SearchScorer } from '../src/searching/search-scorer';
import {
  IBookmarkTreeNode,
  ISearchResult,
  IClickData,
} from '../src/searching/types';
import { mockChromeStorage, mockStorageData } from './setup';

describe('End-to-End Bookmark History Tracking', () => {
  let storageManager: StorageManager;
  let searchScorer: SearchScorer;

  const mockBookmarks: IBookmarkTreeNode[] = [
    {
      id: '1',
      title: 'GitHub',
      url: 'https://github.com',
      syncing: false,
    },
    {
      id: '2',
      title: 'Stack Overflow',
      url: 'https://stackoverflow.com',
      syncing: false,
    },
    {
      id: '3',
      title: 'MDN Web Docs',
      url: 'https://developer.mozilla.org',
      syncing: false,
    },
    {
      id: '4',
      title: 'TypeScript Handbook',
      url: 'https://www.typescriptlang.org/docs',
      syncing: false,
    },
    {
      id: '5',
      title: 'React Documentation',
      url: 'https://react.dev',
      syncing: false,
    },
  ];

  beforeEach(() => {
    storageManager = new StorageManager();
    storageManager.enableTestMode();
    searchScorer = new SearchScorer();
    // Don't override the persistent mock storage behavior from setup.ts
  });

  describe('Complete Click Tracking and Search Enhancement Flow', () => {
    it('should track clicks and improve search rankings over time', async () => {
      // Initial search results - GitHub has worse fuzzy score
      const initialSearchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.6 }, // GitHub (worse score)
        { item: mockBookmarks[1]!, score: 0.3 }, // Stack Overflow (better score)
        { item: mockBookmarks[2]!, score: 0.4 }, // MDN
      ];

      // Initially, Stack Overflow should rank first due to better fuzzy score
      let enhancedResults = searchScorer.enhanceSearchResults(
        initialSearchResults,
        storageManager.getAllClickData()
      );
      expect(enhancedResults[0]!.item.title).toBe('Stack Overflow');
      expect(enhancedResults[1]!.item.title).toBe('MDN Web Docs');
      expect(enhancedResults[2]!.item.title).toBe('GitHub');

      // Simulate user clicking on GitHub multiple times
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');

      // Click on Stack Overflow once
      await storageManager.recordClick('https://stackoverflow.com');

      // Now GitHub should rank higher due to click history
      enhancedResults = searchScorer.enhanceSearchResults(
        initialSearchResults,
        storageManager.getAllClickData()
      );

      expect(enhancedResults[0]!.item.title).toBe('GitHub');
      expect(enhancedResults[0]!.clickCount).toBe(5);
      expect(enhancedResults[1]!.item.title).toBe('Stack Overflow');
      expect(enhancedResults[1]!.clickCount).toBe(1);
      expect(enhancedResults[2]!.item.title).toBe('MDN Web Docs');
      expect(enhancedResults[2]!.clickCount).toBe(0);

      // Verify storage was called for each click
      expect(mockChromeStorage.sync.set).toHaveBeenCalledTimes(6);
    });

    it('should handle mixed keyboard and mouse interactions', async () => {
      const searchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.5 }, // GitHub
        { item: mockBookmarks[3]!, score: 0.4 }, // TypeScript
      ];

      // Simulate mouse clicks on GitHub
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');

      // Simulate keyboard navigation clicks on TypeScript docs
      await storageManager.recordClick('https://www.typescriptlang.org/docs');
      await storageManager.recordClick('https://www.typescriptlang.org/docs');
      await storageManager.recordClick('https://www.typescriptlang.org/docs');

      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );

      // TypeScript should rank higher due to more clicks
      expect(enhancedResults[0]!.item.title).toBe('TypeScript Handbook');
      expect(enhancedResults[0]!.clickCount).toBe(3);
      expect(enhancedResults[1]!.item.title).toBe('GitHub');
      expect(enhancedResults[1]!.clickCount).toBe(2);
    });

    it('should maintain search functionality when click tracking fails', async () => {
      // Simulate storage failure
      mockChromeStorage.sync.set.mockRejectedValue(new Error('Storage failed'));

      const searchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.3 },
        { item: mockBookmarks[1]!, score: 0.5 },
      ];

      // Click tracking should fail silently
      await storageManager.recordClick('https://github.com');

      // Search should still work with fuzzy scores only
      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );

      expect(enhancedResults).toHaveLength(2);
      expect(enhancedResults[0]!.item.title).toBe('GitHub'); // Better fuzzy score
      expect(enhancedResults[0]!.clickCount).toBe(0); // No click data due to storage failure
    });
  });

  describe('Cross-Session Persistence', () => {
    it('should persist click data across browser sessions', async () => {
      // Simulate existing data from previous session
      const previousSessionData: IClickData = {
        'github.com/': { count: 10, lastClicked: Date.now() - 86400000 }, // 1 day ago
        'stackoverflow.com/': { count: 5, lastClicked: Date.now() - 3600000 }, // 1 hour ago
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: previousSessionData,
      });

      // Load data (simulating new session)
      await storageManager.loadClickData();

      // Verify previous session data is loaded
      expect(storageManager.getClickCount('https://github.com')).toBe(10);
      expect(storageManager.getClickCount('https://stackoverflow.com')).toBe(5);

      // Add new clicks in current session
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://react.dev');

      // Verify counts are updated correctly
      expect(storageManager.getClickCount('https://github.com')).toBe(11);
      expect(storageManager.getClickCount('https://react.dev')).toBe(1);

      // Verify search results use combined data
      const searchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.5 }, // GitHub
        { item: mockBookmarks[4]!, score: 0.3 }, // React
        { item: mockBookmarks[1]!, score: 0.2 }, // Stack Overflow
      ];

      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );

      // GitHub should rank first (11 clicks), then Stack Overflow (5 clicks), then React (1 click)
      expect(enhancedResults[0]!.item.title).toBe('GitHub');
      expect(enhancedResults[0]!.clickCount).toBe(11);
    });

    it('should handle data corruption across sessions', async () => {
      // Simulate corrupted data from previous session
      const corruptedData = {
        webpage_click_data: {
          'github.com/': { count: 5, lastClicked: Date.now() },
          'invalid-entry': 'not an object',
          'stackoverflow.com/': { count: 'invalid', lastClicked: Date.now() },
          'react.dev/': { count: 3 }, // missing lastClicked
        },
      };

      mockChromeStorage.sync.get.mockResolvedValue(corruptedData);

      await storageManager.loadClickData();

      // Only valid entries should be loaded
      expect(storageManager.getClickCount('https://github.com')).toBe(5);
      expect(storageManager.getClickCount('https://stackoverflow.com')).toBe(0); // Invalid entry
      expect(storageManager.getClickCount('https://react.dev')).toBe(0); // Invalid entry

      // Search should work with cleaned data
      const searchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.5 }, // GitHub
      ];

      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );

      expect(enhancedResults[0]!.clickCount).toBe(5);
    });

    it('should maintain data integrity across multiple sessions', async () => {
      // Session 1: Initial clicks
      await storageManager.loadClickData();
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');

      const session1Data = storageManager.getAllClickData();
      expect(session1Data['github.com/']?.count).toBe(2);

      // Simulate session end and new session start
      const newStorageManager = new StorageManager();
      newStorageManager.enableTestMode();
      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: session1Data,
      });

      // Session 2: Load previous data and add more clicks
      await newStorageManager.loadClickData();
      expect(newStorageManager.getClickCount('https://github.com')).toBe(2);

      await newStorageManager.recordClick('https://github.com');
      await newStorageManager.recordClick('https://stackoverflow.com');

      // Verify data integrity
      expect(newStorageManager.getClickCount('https://github.com')).toBe(3);
      expect(newStorageManager.getClickCount('https://stackoverflow.com')).toBe(
        1
      );
    });
  });

  describe('Performance with Large Datasets', () => {
    it('should handle large click history datasets efficiently', async () => {
      // Create large dataset (1000 entries)
      const largeClickData: IClickData = {};
      const largeSearchResults: ISearchResult[] = [];

      for (let i = 0; i < 1000; i++) {
        const url = `example${i}.com/`;
        largeClickData[url] = {
          count: Math.floor(Math.random() * 100) + 1,
          lastClicked: Date.now() - Math.floor(Math.random() * 86400000),
        };

        if (i < 100) {
          // Create 100 search results
          largeSearchResults.push({
            item: {
              id: `${i}`,
              title: `Bookmark ${i}`,
              url: `https://example${i}.com/`,
              syncing: false,
            },
            score: Math.random(),
          });
        }
      }

      // Measure search enhancement performance
      const startTime = performance.now();
      const enhancedResults = searchScorer.enhanceSearchResults(
        largeSearchResults,
        largeClickData
      );
      const endTime = performance.now();

      // Should complete within reasonable time (< 50ms for 100 results with 1000 click entries)
      expect(endTime - startTime).toBeLessThan(50);
      expect(enhancedResults).toHaveLength(100);
      expect(enhancedResults[0]!.finalScore).toBeDefined();
      expect(enhancedResults[0]!.clickCount).toBeGreaterThanOrEqual(0);
    });

    it('should maintain performance with frequent click recording', async () => {
      await storageManager.loadClickData();

      // Measure click recording performance
      const startTime = performance.now();

      // Record 100 clicks rapidly
      const clickPromises: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        clickPromises.push(
          storageManager.recordClick(`https://example${i % 10}.com`)
        );
      }

      await Promise.all(clickPromises);
      const endTime = performance.now();

      // Should complete within reasonable time (< 100ms for 100 clicks)
      expect(endTime - startTime).toBeLessThan(100);

      // Verify clicks were recorded
      expect(storageManager.getClickCount('https://example0.com')).toBe(10);
      expect(storageManager.getClickCount('https://example1.com')).toBe(10);
    });

    it('should handle storage quota efficiently', async () => {
      // Create data that would exceed quota
      const largeClickData: IClickData = {};
      for (let i = 0; i < 10000; i++) {
        largeClickData[
          `verylongdomainname${i}.com/very/long/path/that/takes/up/space`
        ] = {
          count: i,
          lastClicked: Date.now() - i * 1000,
        };
      }

      // Simulate quota exceeded error
      mockChromeStorage.sync.set.mockRejectedValueOnce(
        new Error('QUOTA_EXCEEDED')
      );
      mockChromeStorage.sync.set.mockResolvedValueOnce(undefined); // For cleanup attempt

      await storageManager.saveClickData(largeClickData);

      // Should handle quota exceeded gracefully
      expect(mockChromeStorage.sync.set).toHaveBeenCalledTimes(2); // Original attempt + cleanup
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle malformed URLs gracefully', async () => {
      const malformedUrls = [
        'not-a-url',
        'http://',
        'https:///',
        '',
        'javascript:void(0)',
        'data:text/html,<h1>Test</h1>',
        'chrome://settings',
        'file:///local/file.html',
      ];

      await storageManager.loadClickData();

      // Should not throw errors for any malformed URL
      for (const url of malformedUrls) {
        await expect(storageManager.recordClick(url)).resolves.not.toThrow();
      }

      // Should still be able to retrieve counts
      for (const url of malformedUrls) {
        expect(storageManager.getClickCount(url)).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle concurrent click recording', async () => {
      await storageManager.loadClickData();

      const url = 'https://github.com';
      const concurrentClicks = 50;

      // Record many clicks concurrently
      const clickPromises = Array(concurrentClicks)
        .fill(null)
        .map(() => storageManager.recordClick(url));

      await Promise.all(clickPromises);

      // All clicks should be recorded
      expect(storageManager.getClickCount(url)).toBe(concurrentClicks);
    });

    it('should handle search with empty and invalid data', async () => {
      const testCases = [
        { searchResults: [], clickData: {}, expectedLength: 0 },
        {
          searchResults: [{ item: mockBookmarks[0]! }], // No score
          clickData: {},
          expectedLength: 1,
        },
        {
          searchResults: [{ item: { id: '1', title: 'No URL' } }], // No URL
          clickData: { 'github.com/': { count: 5, lastClicked: Date.now() } },
          expectedLength: 1,
        },
        {
          searchResults: [{ item: mockBookmarks[0]!, score: 0.5 }],
          clickData: null as unknown as IClickData, // Invalid click data
          expectedLength: 1,
        },
      ];

      for (const testCase of testCases) {
        const results = searchScorer.enhanceSearchResults(
          testCase.searchResults as ISearchResult[],
          testCase.clickData
        );
        expect(results).toHaveLength(testCase.expectedLength);

        if (results.length > 0) {
          expect(results[0]!.finalScore).toBeDefined();
          expect(results[0]!.clickCount).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should handle storage unavailable scenarios', async () => {
      // Simulate Chrome storage not available
      (global as unknown).chrome = undefined;

      const newStorageManager = new StorageManager();
      newStorageManager.enableTestMode();

      // Should handle gracefully
      await expect(newStorageManager.loadClickData()).resolves.not.toThrow();
      await expect(
        newStorageManager.recordClick('https://github.com')
      ).resolves.not.toThrow();
      expect(newStorageManager.isStorageAvailable()).toBe(false);

      // Should still work with in-memory data
      expect(newStorageManager.getClickCount('https://github.com')).toBe(0);
    });

    it('should handle extension context invalidation', async () => {
      const contextError = new Error('The extension context invalidated');
      mockChromeStorage.sync.get.mockRejectedValue(contextError);
      mockChromeStorage.sync.set.mockRejectedValue(contextError);

      await storageManager.loadClickData();
      await storageManager.recordClick('https://github.com');

      // Should continue working with fallback behavior
      const searchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.5 },
      ];

      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );

      expect(enhancedResults).toHaveLength(1);
      expect(enhancedResults[0]!.finalScore).toBeDefined();
    });

    it('should handle rapid successive clicks on same URL', async () => {
      await storageManager.loadClickData();

      const url = 'https://github.com';
      const rapidClicks = 10;

      // Record clicks in rapid succession
      for (let i = 0; i < rapidClicks; i++) {
        await storageManager.recordClick(url);
      }

      // All clicks should be counted
      expect(storageManager.getClickCount(url)).toBe(rapidClicks);

      // Should not cause storage errors
      expect(mockChromeStorage.sync.set).toHaveBeenCalledTimes(rapidClicks);
    });

    it('should validate all requirements are met', async () => {
      // Requirement 1.1: Click tracking increments count
      await storageManager.loadClickData();
      await storageManager.recordClick('https://github.com');
      expect(storageManager.getClickCount('https://github.com')).toBe(1);

      // Requirement 1.2: Data stored in Chrome storage
      expect(mockChromeStorage.sync.set).toHaveBeenCalled();

      // Requirement 1.3: Data retrieved from Chrome storage
      // Manually set the mock storage data to test loading
      Object.assign(mockStorageData, {
        webpage_click_data: {
          'github.com/': { count: 5, lastClicked: Date.now() },
        },
      });
      const newStorageManager = new StorageManager();
      newStorageManager.enableTestMode();
      await newStorageManager.loadClickData();
      expect(newStorageManager.getClickCount('https://github.com')).toBe(5);

      // Requirement 1.4: Initialize to 0 for new bookmarks
      expect(storageManager.getClickCount('https://newsite.com')).toBe(0);

      // Requirement 2.1: Combine fuzzy search with click counts
      const searchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.5 },
      ];
      const enhanced = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );
      expect(enhanced[0]!.finalScore).not.toBe(0.5); // Should be modified

      // Requirement 2.2: Weight click counts to boost frequently used
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');
      const enhancedWithClicks = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );
      expect(enhancedWithClicks[0]!.finalScore).toBeLessThan(0.5); // Lower is better

      // Requirement 3.1: Efficient Chrome storage usage
      const startTime = performance.now();
      await storageManager.recordClick('https://test.com');
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast

      // Requirement 3.2: Handle storage errors gracefully
      mockChromeStorage.sync.set.mockRejectedValueOnce(
        new Error('Storage failed')
      );
      await expect(
        storageManager.recordClick('https://error-test.com')
      ).resolves.not.toThrow();

      // Requirement 4.1: Persist across browser sessions (tested above)
      // Requirement 5.1: Count only meaningful interactions (each click counted once)
      const initialCount = storageManager.getClickCount(
        'https://meaningful.com'
      );
      await storageManager.recordClick('https://meaningful.com');
      expect(storageManager.getClickCount('https://meaningful.com')).toBe(
        initialCount + 1
      );
    });
  });
});
