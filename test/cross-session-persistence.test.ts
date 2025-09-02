/**
 * Cross-session persistence tests for bookmark history tracking
 * Tests data persistence across browser sessions, extension reloads, and device sync
 */

import { EnhancedStorageManager } from '../src/searching/enhanced-storage-manager';
import { SearchScorer } from '../src/searching/search-scorer';
import { IBookmarkTreeNode, ISearchResult, IClickData } from '../src/searching/types';
import { mockChromeStorage } from './setup';

describe('Cross-Session Persistence Tests', () => {
  let storageManager: EnhancedStorageManager;
  let searchScorer: SearchScorer;

  beforeEach(() => {
    storageManager = new EnhancedStorageManager();
    storageManager.enableTestMode();
    searchScorer = new SearchScorer();
    // Don't override the persistent mock storage behavior from setup.ts
  });

  describe('Browser Session Persistence', () => {
    it('should persist click data across browser restarts', async () => {
      // Session 1: User clicks on bookmarks
      
      // Simulate user activity in first session
      await storageManager.loadClickData();
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://stackoverflow.com');
      await storageManager.recordClick('https://developer.mozilla.org');

      // Capture the data that would be saved
      const savedData = storageManager.getAllClickData();
      expect(savedData['github.com/']?.count).toBe(2);
      expect(savedData['stackoverflow.com/']?.count).toBe(1);
      expect(savedData['developer.mozilla.org/']?.count).toBe(1);

      // Simulate browser restart - new ClickTracker instance
      const session2StorageManager = new EnhancedStorageManager();
      session2StorageManager.enableTestMode();
      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: savedData,
      });

      // Session 2: Load previous data
      await session2StorageManager.loadClickData();
      
      // Verify previous session data is loaded
      expect(session2StorageManager.getClickCount('https://github.com')).toBe(2);
      expect(session2StorageManager.getClickCount('https://stackoverflow.com')).toBe(1);
      expect(session2StorageManager.getClickCount('https://developer.mozilla.org')).toBe(1);

      // Add more clicks in session 2
      await session2StorageManager.recordClick('https://github.com');
      await session2StorageManager.recordClick('https://react.dev');

      // Verify cumulative counts
      expect(session2StorageManager.getClickCount('https://github.com')).toBe(3);
      expect(session2StorageManager.getClickCount('https://react.dev')).toBe(1);
      expect(session2StorageManager.getClickCount('https://stackoverflow.com')).toBe(1);
    });

    it('should maintain search ranking improvements across sessions', async () => {
      const mockBookmarks: IBookmarkTreeNode[] = [
        {
          id: '1', title: 'GitHub', url: 'https://github.com',
          syncing: false
        },
        {
          id: '2', title: 'Stack Overflow', url: 'https://stackoverflow.com',
          syncing: false
        },
        {
          id: '3', title: 'MDN Web Docs', url: 'https://developer.mozilla.org',
          syncing: false
        },
      ];

      // Session 1: Build up click history
      await storageManager.loadClickData();
      
      // GitHub gets many clicks
      for (let i = 0; i < 10; i++) {
        await storageManager.recordClick('https://github.com');
      }
      
      // Stack Overflow gets fewer clicks
      for (let i = 0; i < 3; i++) {
        await storageManager.recordClick('https://stackoverflow.com');
      }

      const session1Data = storageManager.getAllClickData();

      // Simulate session end and new session start
      const session2StorageManager = new EnhancedStorageManager();
      session2StorageManager.enableTestMode();
      const session2SearchScorer = new SearchScorer();
      
      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: session1Data,
      });

      await session2StorageManager.loadClickData();

      // Session 2: Search should reflect previous session's click history
      const searchResults: ISearchResult[] = [
        { item: mockBookmarks[0]!, score: 0.6 }, // GitHub - worse fuzzy score
        { item: mockBookmarks[1]!, score: 0.3 }, // Stack Overflow - better fuzzy score
        { item: mockBookmarks[2]!, score: 0.4 }, // MDN - no clicks
      ];

      const enhancedResults = session2SearchScorer.enhanceSearchResults(
        searchResults,
        session2StorageManager.getAllClickData()
      );

      // GitHub should rank first due to click history from previous session
      expect(enhancedResults[0]!.item.title).toBe('GitHub');
      expect(enhancedResults[0]!.clickCount).toBe(10);
      expect(enhancedResults[1]!.item.title).toBe('Stack Overflow');
      expect(enhancedResults[1]!.clickCount).toBe(3);
      expect(enhancedResults[2]!.item.title).toBe('MDN Web Docs');
      expect(enhancedResults[2]!.clickCount).toBe(0);
    });

    it('should handle data accumulated over multiple sessions', async () => {
      let cumulativeData: IClickData = {};

      // Simulate 5 browser sessions
      for (let session = 1; session <= 5; session++) {
        const sessionStorageManager = new EnhancedStorageManager();
        sessionStorageManager.enableTestMode();
        
        // Load previous session data
        mockChromeStorage.sync.get.mockResolvedValue({
          webpage_click_data: cumulativeData,
        });

        await sessionStorageManager.loadClickData();

        // Each session adds different patterns of clicks
        const sessionUrls = [
          'https://github.com',
          'https://stackoverflow.com',
          `https://session${session}.com`,
        ];

        for (const url of sessionUrls) {
          for (let i = 0; i < session; i++) { // More clicks in later sessions
            await sessionStorageManager.recordClick(url);
          }
        }

        // Update cumulative data for next session
        cumulativeData = sessionStorageManager.getAllClickData();
      }

      // Verify final accumulated data
      expect(cumulativeData['github.com/']?.count).toBe(15); // 1+2+3+4+5
      expect(cumulativeData['stackoverflow.com/']?.count).toBe(15); // 1+2+3+4+5
      expect(cumulativeData['session1.com/']?.count).toBe(1);
      expect(cumulativeData['session2.com/']?.count).toBe(2);
      expect(cumulativeData['session3.com/']?.count).toBe(3);
      expect(cumulativeData['session4.com/']?.count).toBe(4);
      expect(cumulativeData['session5.com/']?.count).toBe(5);

      // Total unique URLs should be 7 (github, stackoverflow, session1-5)
      expect(Object.keys(cumulativeData)).toHaveLength(7);
    });
  });

  describe('Extension Lifecycle Persistence', () => {
    it('should persist data across extension disable/enable cycles', async () => {
      // Extension enabled: Build up data
      await storageManager.loadClickData();
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://stackoverflow.com');

      const preDisableData = storageManager.getAllClickData();

      // Simulate extension disable/enable - new instances
      const postEnableStorageManager = new EnhancedStorageManager();
      postEnableStorageManager.enableTestMode();
      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: preDisableData,
      });

      await postEnableStorageManager.loadClickData();

      // Data should be preserved
      expect(postEnableStorageManager.getClickCount('https://github.com')).toBe(2);
      expect(postEnableStorageManager.getClickCount('https://stackoverflow.com')).toBe(1);

      // Should be able to continue adding data
      await postEnableStorageManager.recordClick('https://github.com');
      expect(postEnableStorageManager.getClickCount('https://github.com')).toBe(3);
    });

    it('should handle extension updates and version changes', async () => {
      // Old version data
      const oldVersionData = {
        webpage_click_data: {
          'github.com/': { count: 5, lastClicked: Date.now() },
          'stackoverflow.com/': { count: 3, lastClicked: Date.now() },
        },
        webpage_click_data_version: 1,
      };

      mockChromeStorage.sync.get.mockResolvedValue(oldVersionData);

      // New version should load old data successfully
      const data = await storageManager.loadClickData();
      expect(data['github.com/']?.count).toBe(5);
      expect(data['stackoverflow.com/']?.count).toBe(3);
    });

    it('should handle extension context invalidation gracefully', async () => {
      // Build up some data
      await storageManager.loadClickData();
      await storageManager.recordClick('https://github.com');

      // Simulate context invalidation
      const contextError = new Error('The extension context invalidated');
      mockChromeStorage.sync.get.mockRejectedValue(contextError);
      mockChromeStorage.sync.set.mockRejectedValue(contextError);

      // New instance should handle gracefully
      const newStorageManager = new EnhancedStorageManager();
      newStorageManager.enableTestMode();
      await expect(newStorageManager.loadClickData()).resolves.not.toThrow();
      
      // Should continue working with fallback behavior
      await expect(newStorageManager.recordClick('https://example.com')).resolves.not.toThrow();
    });
  });

  describe('Device Synchronization', () => {
    it('should handle data sync across multiple devices', async () => {
      // Device 1: User clicks on work computer
      const device1Data: IClickData = {
        'github.com/': { count: 10, lastClicked: Date.now() - 3600000 }, // 1 hour ago
        'stackoverflow.com/': { count: 5, lastClicked: Date.now() - 1800000 }, // 30 min ago
        'work-tool.com/': { count: 8, lastClicked: Date.now() - 900000 }, // 15 min ago
      };

      // Device 2: User clicks on home computer
      const device2Data: IClickData = {
        'github.com/': { count: 15, lastClicked: Date.now() - 7200000 }, // 2 hours ago
        'reddit.com/': { count: 20, lastClicked: Date.now() - 600000 }, // 10 min ago
        'youtube.com/': { count: 12, lastClicked: Date.now() - 300000 }, // 5 min ago
      };

      // Simulate Chrome sync merging data (most recent wins for conflicts)
      const mergedData: IClickData = {
        'github.com/': device1Data['github.com/']!, // Device 1 more recent
        'stackoverflow.com/': device1Data['stackoverflow.com/']!,
        'work-tool.com/': device1Data['work-tool.com/']!,
        'reddit.com/': device2Data['reddit.com/']!,
        'youtube.com/': device2Data['youtube.com/']!,
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: mergedData,
      });

      // Device 3: User opens extension on tablet
      const device3StorageManager = new EnhancedStorageManager();
      device3StorageManager.enableTestMode();
      await device3StorageManager.loadClickData();

      // Should have merged data from both devices
      expect(device3StorageManager.getClickCount('https://github.com')).toBe(10); // From device 1
      expect(device3StorageManager.getClickCount('https://stackoverflow.com')).toBe(5);
      expect(device3StorageManager.getClickCount('https://work-tool.com')).toBe(8);
      expect(device3StorageManager.getClickCount('https://reddit.com')).toBe(20); // From device 2
      expect(device3StorageManager.getClickCount('https://youtube.com')).toBe(12);

      // Add clicks on device 3
      await device3StorageManager.recordClick('https://github.com');
      await device3StorageManager.recordClick('https://mobile-app.com');

      expect(device3StorageManager.getClickCount('https://github.com')).toBe(11);
      expect(device3StorageManager.getClickCount('https://mobile-app.com')).toBe(1);
    });

    it('should handle sync conflicts and data merging', async () => {
      // Simulate conflicting data from different devices
      const conflictingData: IClickData = {
        'github.com/': { count: 5, lastClicked: Date.now() - 1000 },
        'stackoverflow.com/': { count: 3, lastClicked: Date.now() - 2000 },
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: conflictingData,
      });

      await storageManager.loadClickData();

      // Local device adds more clicks
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://github.com');
      await storageManager.recordClick('https://new-site.com');

      // Should merge correctly
      expect(storageManager.getClickCount('https://github.com')).toBe(7); // 5 + 2
      expect(storageManager.getClickCount('https://stackoverflow.com')).toBe(3); // Unchanged
      expect(storageManager.getClickCount('https://new-site.com')).toBe(1); // New
    });

    it('should handle partial sync failures', async () => {
      // Initial data load succeeds
      const initialData: IClickData = {
        'github.com/': { count: 5, lastClicked: Date.now() },
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: initialData,
      });

      await storageManager.loadClickData();
      expect(storageManager.getClickCount('https://github.com')).toBe(5);

      // Sync save fails
      mockChromeStorage.sync.set.mockRejectedValue(new Error('Sync failed'));

      // Should continue working locally
      await storageManager.recordClick('https://github.com');
      expect(storageManager.getClickCount('https://github.com')).toBe(6);

      // Should not lose local data
      await storageManager.recordClick('https://new-site.com');
      expect(storageManager.getClickCount('https://new-site.com')).toBe(1);
    });
  });

  describe('Long-term Data Persistence', () => {
    it('should maintain data integrity over extended periods', async () => {
      const now = Date.now();
      const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);
      const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);

      // Simulate data accumulated over a year
      const longTermData: IClickData = {
        'daily-site.com/': { count: 365, lastClicked: now - 1000 }, // Daily usage
        'weekly-site.com/': { count: 52, lastClicked: oneWeekAgo }, // Weekly usage
        'monthly-site.com/': { count: 12, lastClicked: oneMonthAgo }, // Monthly usage
        'old-site.com/': { count: 5, lastClicked: oneYearAgo }, // Old usage
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: longTermData,
      });

      await storageManager.loadClickData();

      // All data should be preserved
      expect(storageManager.getClickCount('https://daily-site.com')).toBe(365);
      expect(storageManager.getClickCount('https://weekly-site.com')).toBe(52);
      expect(storageManager.getClickCount('https://monthly-site.com')).toBe(12);
      expect(storageManager.getClickCount('https://old-site.com')).toBe(5);

      // Search should properly weight based on usage patterns
      const searchResults: ISearchResult[] = [
        { item: {
          id: '1', title: 'Daily Site', url: 'https://daily-site.com',
          syncing: false
        }, score: 0.8 },
        { item: {
          id: '2', title: 'Weekly Site', url: 'https://weekly-site.com',
          syncing: false
        }, score: 0.3 },
        { item: {
          id: '3', title: 'Monthly Site', url: 'https://monthly-site.com',
          syncing: false
        }, score: 0.2 },
        { item: {
          id: '4', title: 'Old Site', url: 'https://old-site.com',
          syncing: false
        }, score: 0.1 },
      ];

      const enhancedResults = searchScorer.enhanceSearchResults(
        searchResults,
        storageManager.getAllClickData()
      );

      // Daily site should rank first despite worst fuzzy score
      expect(enhancedResults[0]!.item.title).toBe('Daily Site');
      expect(enhancedResults[0]!.clickCount).toBe(365);
    });

    it('should handle storage quota management over time', async () => {
      // Simulate gradual data accumulation that approaches quota
      const largeHistoricalData: IClickData = {};
      
      // Add many entries over time
      for (let i = 0; i < 2000; i++) {
        const daysAgo = Math.floor(Math.random() * 365);
        largeHistoricalData[`site${i}.com/`] = {
          count: Math.floor(Math.random() * 50) + 1,
          lastClicked: Date.now() - (daysAgo * 24 * 60 * 60 * 1000),
        };
      }

      // First save fails with quota exceeded, then cleanup succeeds
      mockChromeStorage.sync.set
        .mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'))
        .mockResolvedValueOnce(undefined); // Cleanup succeeds

      await storageManager.saveClickData(largeHistoricalData);

      // Should handle quota exceeded and attempt cleanup (1 failed + 1 cleanup = 2 total)
      expect(mockChromeStorage.sync.set).toHaveBeenCalledTimes(2);
    });

    it('should preserve data through various error conditions over time', async () => {
      const persistentData: IClickData = {
        'important-site.com/': { count: 100, lastClicked: Date.now() },
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: persistentData,
      });

      await storageManager.loadClickData();
      expect(storageManager.getClickCount('https://important-site.com')).toBe(100);

      // Simulate various error conditions
      const errorConditions = [
        new Error('Network error'),
        new Error('QUOTA_EXCEEDED'),
        new Error('MAX_WRITE_OPERATIONS_PER_MINUTE'),
        new Error('The extension context invalidated'),
      ];

      for (const error of errorConditions) {
        mockChromeStorage.sync.set.mockRejectedValueOnce(error);
        
        // Should continue working despite errors
        await expect(storageManager.recordClick('https://important-site.com')).resolves.not.toThrow();
        
        // Data should still be accessible
        expect(storageManager.getClickCount('https://important-site.com')).toBeGreaterThan(100);
      }
    });
  });


});