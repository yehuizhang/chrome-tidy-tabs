/**
 * Performance validation tests for bookmark history tracking
 * Tests system performance with large datasets and high-frequency operations
 */

import { ClickTracker } from '../src/click-tracker';
import { SearchScorer } from '../src/search-scorer';
import { StorageManager } from '../src/storage-manager';
import { ISearchResult, IClickData } from '../src/types';
import { mockChromeStorage } from './setup';

describe('Performance Validation Tests', () => {
  let clickTracker: ClickTracker;
  let searchScorer: SearchScorer;
  let storageManager: StorageManager;

  beforeEach(() => {
    clickTracker = new ClickTracker();
    clickTracker.enableTestMode();
    searchScorer = new SearchScorer();
    storageManager = new StorageManager();
    jest.clearAllMocks();
    
    mockChromeStorage.sync.get.mockResolvedValue({});
    mockChromeStorage.sync.set.mockResolvedValue(undefined);
  });

  describe('Large Dataset Performance', () => {
    it('should handle 10,000 click history entries efficiently', async () => {
      // Generate large click dataset
      const largeClickData: IClickData = {};
      const baseTime = Date.now();
      
      for (let i = 0; i < 10000; i++) {
        largeClickData[`site${i}.com/path${i % 100}`] = {
          count: Math.floor(Math.random() * 1000) + 1,
          lastClicked: baseTime - (i * 1000),
        };
      }

      // Test search enhancement performance with large dataset
      const searchResults: ISearchResult[] = [];
      for (let i = 0; i < 500; i++) {
        searchResults.push({
          item: {
            id: `${i}`,
            title: `Bookmark ${i}`,
            url: `https://site${i}.com/path${i % 100}`,
          },
          score: Math.random(),
        });
      }

      const startTime = performance.now();
      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        largeClickData
      );
      const endTime = performance.now();

      // Should complete within 100ms for 500 results with 10k click entries
      expect(endTime - startTime).toBeLessThan(100);
      expect(enhancedResults).toHaveLength(500);
      
      // Verify results are properly enhanced
      expect(enhancedResults[0]!.finalScore).toBeDefined();
      expect(enhancedResults[0]!.clickCount).toBeGreaterThanOrEqual(0);
      
      // Verify sorting is correct (lower finalScore should come first)
      for (let i = 1; i < enhancedResults.length; i++) {
        expect(enhancedResults[i]!.finalScore).toBeGreaterThanOrEqual(
          enhancedResults[i - 1]!.finalScore
        );
      }
    });

    it('should maintain performance with frequent click recording', async () => {
      await clickTracker.loadClickData();

      const urls = Array.from({ length: 100 }, (_, i) => `https://site${i}.com`);
      const totalClicks = 1000;

      const startTime = performance.now();
      
      // Record clicks in batches to simulate real usage
      const batchSize = 50;
      for (let i = 0; i < totalClicks; i += batchSize) {
        const batch = [];
        for (let j = 0; j < batchSize && i + j < totalClicks; j++) {
          const url = urls[(i + j) % urls.length]!;
          batch.push(clickTracker.recordClick(url));
        }
        await Promise.all(batch);
      }
      
      const endTime = performance.now();

      // Should complete within 500ms for 1000 clicks
      expect(endTime - startTime).toBeLessThan(500);
      
      // Verify clicks were recorded correctly
      expect(clickTracker.getClickCount(urls[0]!)).toBe(10); // 1000 clicks / 100 URLs = 10 each
      expect(clickTracker.getClickCount(urls[50]!)).toBe(10);
    });

    it('should handle memory efficiently with large click datasets', async () => {
      // Create very large dataset
      const largeClickData: IClickData = {};
      for (let i = 0; i < 50000; i++) {
        largeClickData[`domain${i}.com/`] = {
          count: Math.floor(Math.random() * 100) + 1,
          lastClicked: Date.now() - Math.floor(Math.random() * 86400000 * 365), // Random time in past year
        };
      }

      // Mock storage to return large dataset
      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: largeClickData,
      });

      const startTime = performance.now();
      await clickTracker.loadClickData();
      const loadEndTime = performance.now();

      // Loading should be reasonably fast even with large dataset
      expect(loadEndTime - startTime).toBeLessThan(200);

      // Test search performance with loaded data
      const searchResults: ISearchResult[] = Array.from({ length: 1000 }, (_, i) => ({
        item: {
          id: `${i}`,
          title: `Bookmark ${i}`,
          url: `https://domain${i}.com/`,
        },
        score: Math.random(),
      }));

      const searchStartTime = performance.now();
      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        clickTracker.getAllClickData()
      );
      const searchEndTime = performance.now();

      // Search enhancement should be fast even with large dataset
      expect(searchEndTime - searchStartTime).toBeLessThan(200);
      expect(enhancedResults).toHaveLength(1000);
    });

    it('should handle storage quota management efficiently', async () => {
      // Create dataset that would exceed typical storage quota
      const largeClickData: IClickData = {};
      const longUrl = 'verylongdomainname.com/very/long/path/that/takes/up/lots/of/storage/space';
      
      for (let i = 0; i < 5000; i++) {
        largeClickData[`${longUrl}${i}`] = {
          count: Math.floor(Math.random() * 1000),
          lastClicked: Date.now() - (i * 1000),
        };
      }

      // First call fails with quota exceeded
      mockChromeStorage.sync.set
        .mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'))
        .mockResolvedValueOnce(undefined); // Cleanup succeeds

      const startTime = performance.now();
      await storageManager.saveClickData(largeClickData);
      const endTime = performance.now();

      // Should handle quota exceeded and cleanup within reasonable time
      expect(endTime - startTime).toBeLessThan(100);
      expect(mockChromeStorage.sync.set).toHaveBeenCalledTimes(2); // Original + cleanup
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent click recording without data corruption', async () => {
      await clickTracker.loadClickData();

      const urls = [
        'https://github.com',
        'https://stackoverflow.com',
        'https://developer.mozilla.org',
      ];

      const concurrentOperations = 200;
      const operations = [];

      const startTime = performance.now();
      
      // Create many concurrent click operations
      for (let i = 0; i < concurrentOperations; i++) {
        const url = urls[i % urls.length]!;
        operations.push(clickTracker.recordClick(url));
      }

      await Promise.all(operations);
      const endTime = performance.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(300);

      // Verify all clicks were recorded correctly
      const expectedClicksPerUrl = Math.floor(concurrentOperations / urls.length);
      const remainder = concurrentOperations % urls.length;
      
      for (let i = 0; i < urls.length; i++) {
        const expectedCount = expectedClicksPerUrl + (i < remainder ? 1 : 0);
        expect(clickTracker.getClickCount(urls[i]!)).toBe(expectedCount);
      }
    });

    it('should handle concurrent search enhancements efficiently', async () => {
      const clickData: IClickData = {};
      for (let i = 0; i < 1000; i++) {
        clickData[`site${i}.com/`] = {
          count: Math.floor(Math.random() * 100),
          lastClicked: Date.now() - Math.floor(Math.random() * 86400000),
        };
      }

      const searchResults: ISearchResult[] = Array.from({ length: 100 }, (_, i) => ({
        item: {
          id: `${i}`,
          title: `Bookmark ${i}`,
          url: `https://site${i}.com/`,
        },
        score: Math.random(),
      }));

      // Perform multiple concurrent search enhancements
      const concurrentSearches = 10;
      const searchPromises = [];

      const startTime = performance.now();
      
      for (let i = 0; i < concurrentSearches; i++) {
        searchPromises.push(
          searchScorer.enhanceSearchResults(searchResults, clickData)
        );
      }

      const results = await Promise.all(searchPromises);
      const endTime = performance.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(100);

      // All results should be identical and properly formatted
      for (const result of results) {
        expect(result).toHaveLength(100);
        expect(result[0]!.finalScore).toBeDefined();
        expect(result[0]!.clickCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should not leak memory during repeated operations', async () => {
      await clickTracker.loadClickData();

      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 1000;

      // Perform many click operations
      for (let i = 0; i < iterations; i++) {
        await clickTracker.recordClick(`https://site${i % 10}.com`);
        
        // Occasionally check memory hasn't grown excessively
        if (i % 100 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryGrowth = currentMemory - initialMemory;
          
          // Memory growth should be reasonable (less than 10MB for 1000 operations)
          expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalMemoryGrowth = finalMemory - initialMemory;
      
      // Total memory growth should be minimal
      expect(totalMemoryGrowth).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
    });

    it('should handle cleanup of old data efficiently', async () => {
      // Create dataset with old entries
      const oldClickData: IClickData = {};
      const now = Date.now();
      const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
      
      for (let i = 0; i < 1000; i++) {
        oldClickData[`oldsite${i}.com/`] = {
          count: Math.floor(Math.random() * 10) + 1,
          lastClicked: oneYearAgo - (i * 1000),
        };
      }

      // Add some recent entries
      for (let i = 0; i < 100; i++) {
        oldClickData[`newsite${i}.com/`] = {
          count: Math.floor(Math.random() * 50) + 1,
          lastClicked: now - (i * 1000),
        };
      }

      // Simulate quota exceeded scenario that triggers cleanup
      mockChromeStorage.sync.set
        .mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'))
        .mockResolvedValueOnce(undefined);

      const startTime = performance.now();
      await storageManager.saveClickData(oldClickData);
      const endTime = performance.now();

      // Cleanup should be efficient
      expect(endTime - startTime).toBeLessThan(50);
      
      // Should have attempted cleanup (2 calls: original + cleanup)
      expect(mockChromeStorage.sync.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('Real-world Usage Simulation', () => {
    it('should handle typical user behavior patterns efficiently', async () => {
      await clickTracker.loadClickData();

      // Simulate realistic user behavior over time
      const popularSites = [
        'https://github.com',
        'https://stackoverflow.com',
        'https://google.com',
        'https://developer.mozilla.org',
        'https://react.dev',
      ];

      const occasionalSites = Array.from({ length: 20 }, (_, i) => 
        `https://site${i}.com`
      );

      const rareSites = Array.from({ length: 100 }, (_, i) => 
        `https://rare${i}.com`
      );

      const startTime = performance.now();

      // Simulate clicks over time with realistic distribution
      // Popular sites: 60% of clicks
      for (let i = 0; i < 300; i++) {
        const site = popularSites[i % popularSites.length]!;
        await clickTracker.recordClick(site);
      }

      // Occasional sites: 30% of clicks
      for (let i = 0; i < 150; i++) {
        const site = occasionalSites[i % occasionalSites.length]!;
        await clickTracker.recordClick(site);
      }

      // Rare sites: 10% of clicks
      for (let i = 0; i < 50; i++) {
        const site = rareSites[i % rareSites.length]!;
        await clickTracker.recordClick(site);
      }

      const clickingEndTime = performance.now();

      // Now simulate search operations
      const allSites = [...popularSites, ...occasionalSites, ...rareSites];
      const searchResults: ISearchResult[] = allSites.map((url, index) => ({
        item: {
          id: `${index}`,
          title: `Site ${index}`,
          url,
        },
        score: Math.random(),
      }));

      const searchStartTime = performance.now();
      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        clickTracker.getAllClickData()
      );
      const searchEndTime = performance.now();

      // Performance should be good for realistic usage
      expect(clickingEndTime - startTime).toBeLessThan(1000); // 500 clicks in < 1s
      expect(searchEndTime - searchStartTime).toBeLessThan(50); // Search enhancement < 50ms

      // Verify popular sites are ranked higher
      const topResults = enhancedResults.slice(0, 10);
      const popularSiteResults = topResults.filter(result => 
        popularSites.includes(result.item.url!)
      );
      
      // Most top results should be popular sites
      expect(popularSiteResults.length).toBeGreaterThanOrEqual(3);
      
      // Popular sites should have higher click counts
      for (const site of popularSites) {
        expect(clickTracker.getClickCount(site)).toBeGreaterThan(50);
      }
    });

    it('should maintain performance during browser session simulation', async () => {
      // Simulate a full browser session with mixed operations
      const sessionStartTime = performance.now();

      // Session start: Load existing data
      const existingData: IClickData = {};
      for (let i = 0; i < 500; i++) {
        existingData[`existing${i}.com/`] = {
          count: Math.floor(Math.random() * 20) + 1,
          lastClicked: Date.now() - Math.floor(Math.random() * 86400000 * 30), // Last 30 days
        };
      }

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: existingData,
      });

      await clickTracker.loadClickData();

      // Simulate user activity throughout session
      const sessionOperations = [];

      // Mix of clicks and searches
      for (let i = 0; i < 100; i++) {
        // Record some clicks
        sessionOperations.push(
          clickTracker.recordClick(`https://session${i % 20}.com`)
        );

        // Perform some searches every 10 operations
        if (i % 10 === 0) {
          const searchResults: ISearchResult[] = Array.from({ length: 20 }, (_, j) => ({
            item: {
              id: `${j}`,
              title: `Bookmark ${j}`,
              url: `https://session${j}.com`,
            },
            score: Math.random(),
          }));

          sessionOperations.push(
            Promise.resolve(searchScorer.enhanceSearchResults(
              searchResults,
              clickTracker.getAllClickData()
            ))
          );
        }
      }

      await Promise.all(sessionOperations);
      const sessionEndTime = performance.now();

      // Full session should complete efficiently
      expect(sessionEndTime - sessionStartTime).toBeLessThan(2000); // < 2 seconds

      // Verify session data is properly maintained
      expect(clickTracker.getClickCount('https://session0.com')).toBe(5); // 100 clicks / 20 URLs = 5 each
    });
  });
});