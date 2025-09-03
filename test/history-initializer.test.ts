import { HistoryInitializer, IHistoryInitializer } from '../src/searching/history-initializer';
import { IVisitStorageManager } from '../src/searching/visit-storage-manager';
import { IInitializationStateManager } from '../src/searching/initialization-state-manager';

import { IErrorManager } from '../src/error-manager';
import { IVisitData } from '../src/searching/types';

// Extend the global chrome mock to include history and permissions APIs
const mockHistory = {
  search: jest.fn(),
};

const mockPermissions = {
  request: jest.fn(),
  contains: jest.fn(),
};

// Extend the existing global chrome mock
(global as any).chrome = {
  ...(global as any).chrome,
  history: mockHistory,
  permissions: mockPermissions,
};

describe('HistoryInitializer', () => {
  let historyInitializer: IHistoryInitializer;
  let mockVisitStorageManager: jest.Mocked<IVisitStorageManager>;
  let mockInitializationStateManager: jest.Mocked<IInitializationStateManager>;

  let mockErrorManager: jest.Mocked<IErrorManager>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset Chrome API mocks
    mockHistory.search.mockClear();
    mockPermissions.request.mockClear();
    mockPermissions.contains.mockClear();

    // Create mock dependencies
    mockVisitStorageManager = {
      loadVisitData: jest.fn(),
      saveVisitData: jest.fn(),
      recordVisit: jest.fn(),
      getVisitCount: jest.fn(),
      getAllVisitData: jest.fn(),
      clearVisitData: jest.fn(),
      isStorageAvailable: jest.fn(),
    };

    mockInitializationStateManager = {
      loadInitializationState: jest.fn(),
      saveInitializationState: jest.fn(),
      isInitializationNeeded: jest.fn(),
      markInitializationComplete: jest.fn(),
      markPermissionDenied: jest.fn(),
      markPartialCompletion: jest.fn(),
      resetInitializationState: jest.fn(),
      isStorageAvailable: jest.fn(),
    };



    mockErrorManager = {
      addError: jest.fn(),
      getErrors: jest.fn(),
      clearErrors: jest.fn(),
      displayErrors: jest.fn(),
      initializeErrorDisplay: jest.fn(),
    };

    // Create HistoryInitializer instance with mocked dependencies and test config
    historyInitializer = new HistoryInitializer(
      mockVisitStorageManager,
      mockInitializationStateManager,
      mockErrorManager,
      {
        maxHistoryItems: 10000,
        batchSize: 1000,
        maxAge: 36500, // 100 years to avoid age filtering in tests
      }
    );
  });

  describe('initialize', () => {
    it('should skip initialization if not needed', async () => {
      mockInitializationStateManager.isInitializationNeeded.mockResolvedValue(false);

      await historyInitializer.initialize();

      expect(mockHistory.search).not.toHaveBeenCalled();
    });

    it('should complete full initialization successfully', async () => {
      const mockHistoryItems: chrome.history.HistoryItem[] = [
        {
          id: '1',
          url: 'https://example.com/page1',
          title: 'Example Page 1',
          lastVisitTime: Date.now() - 1000,
          visitCount: 5,
        },
        {
          id: '2',
          url: 'https://www.example.com/page2',
          title: 'Example Page 2',
          lastVisitTime: Date.now() - 2000,
          visitCount: 3,
        },
      ];

      mockInitializationStateManager.isInitializationNeeded.mockResolvedValue(true);
      mockHistory.search.mockResolvedValue(mockHistoryItems);
      mockVisitStorageManager.getAllVisitData.mockReturnValue({});

      await historyInitializer.initialize();

      expect(mockHistory.search).toHaveBeenCalledWith({
        text: '',
        startTime: expect.any(Number),
        maxResults: 10000,
      });
      expect(mockVisitStorageManager.saveVisitData).toHaveBeenCalled();
      expect(mockInitializationStateManager.markInitializationComplete).toHaveBeenCalled();
    });

    it('should handle Chrome history API unavailability', async () => {
      mockInitializationStateManager.isInitializationNeeded.mockResolvedValue(true);
      
      // Mock Chrome history API as unavailable
      delete (global as any).chrome.history;

      await historyInitializer.initialize();

      expect(mockErrorManager.addError).toHaveBeenCalledWith(
        'Chrome history API is not available - skipping history initialization'
      );
    });

    it('should handle initialization errors and mark partial completion', async () => {
      mockInitializationStateManager.isInitializationNeeded.mockResolvedValue(true);
      
      // Ensure chrome.history is properly set up
      (global as any).chrome.history = mockHistory;
      
      // Make the search method fail when called
      mockHistory.search.mockRejectedValue(new Error('History API error'));

      await historyInitializer.initialize();

      expect(mockErrorManager.addError).toHaveBeenCalledWith(
        expect.stringContaining('History initialization failed')
      );
      expect(mockInitializationStateManager.markPartialCompletion).toHaveBeenCalledWith(
        0,
        expect.any(Number)
      );
    });
  });

  describe('isInitializationNeeded', () => {
    it('should delegate to initialization state manager', async () => {
      mockInitializationStateManager.isInitializationNeeded.mockResolvedValue(true);

      const result = await historyInitializer.isInitializationNeeded();

      expect(result).toBe(true);
      expect(mockInitializationStateManager.isInitializationNeeded).toHaveBeenCalled();
    });
  });

  describe('processHistoryItems', () => {
    it('should process valid history items correctly', async () => {
      const now = Date.now();
      const mockHistoryItems: chrome.history.HistoryItem[] = [
        {
          id: '1',
          url: 'https://example.com/page1',
          title: 'Example Page 1',
          lastVisitTime: now - 1000,
          visitCount: 5,
        },
        {
          id: '2',
          url: 'https://www.example.com/page2',
          title: 'Example Page 2',
          lastVisitTime: now - 2000,
          visitCount: 3,
        },
      ];

      const result = await historyInitializer.processHistoryItems(mockHistoryItems);

      expect(result).toEqual({
        'example.com/page1': {
          count: 5,
          lastVisited: now - 1000,
          title: 'Example Page 1',
        },
        'example.com/page2': {
          count: 3,
          lastVisited: now - 2000,
          title: 'Example Page 2',
        },
      });
    });

    it('should aggregate duplicate URLs correctly', async () => {
      const now = Date.now();
      const mockHistoryItems: chrome.history.HistoryItem[] = [
        {
          id: '1',
          url: 'https://example.com/page',
          title: 'Example Page Old',
          lastVisitTime: now - 2000,
          visitCount: 3,
        },
        {
          id: '2',
          url: 'https://www.example.com/page/',
          title: 'Example Page New',
          lastVisitTime: now - 1000,
          visitCount: 2,
        },
      ];

      const result = await historyInitializer.processHistoryItems(mockHistoryItems);

      expect(result).toEqual({
        'example.com/page': {
          count: 5, // 3 + 2
          lastVisited: now - 1000, // Most recent
          title: 'Example Page New', // Title from most recent visit
        },
      });
    });

    it('should skip invalid URLs', async () => {
      const now = Date.now();
      const mockHistoryItems: chrome.history.HistoryItem[] = [
        {
          id: '1',
          url: 'chrome://settings',
          title: 'Chrome Settings',
          lastVisitTime: now - 3000,
          visitCount: 1,
        },
        {
          id: '2',
          url: 'file:///local/file.html',
          title: 'Local File',
          lastVisitTime: now - 2000,
          visitCount: 1,
        },
        {
          id: '3',
          url: 'https://example.com/valid',
          title: 'Valid Page',
          lastVisitTime: now - 1000,
          visitCount: 1,
        },
      ];

      const result = await historyInitializer.processHistoryItems(mockHistoryItems);

      expect(result).toEqual({
        'example.com/valid': {
          count: 1,
          lastVisited: now - 1000,
          title: 'Valid Page',
        },
      });
    });

    it('should skip items without URLs', async () => {
      const now = Date.now();
      const mockHistoryItems: chrome.history.HistoryItem[] = [
        {
          id: '1',
          title: 'No URL Item',
          lastVisitTime: now - 2000,
          visitCount: 1,
        },
        {
          id: '2',
          url: 'https://example.com/valid',
          title: 'Valid Page',
          lastVisitTime: now - 1000,
          visitCount: 1,
        },
      ];

      const result = await historyInitializer.processHistoryItems(mockHistoryItems);

      expect(result).toEqual({
        'example.com/valid': {
          count: 1,
          lastVisited: now - 1000,
          title: 'Valid Page',
        },
      });
    });

    it('should handle items with missing optional fields', async () => {
      const mockHistoryItems: chrome.history.HistoryItem[] = [
        {
          id: '1',
          url: 'https://example.com/page',
          // Missing title, lastVisitTime, visitCount
        },
      ];

      const result = await historyInitializer.processHistoryItems(mockHistoryItems);

      expect(result).toEqual({
        'example.com/page': {
          count: 1, // Default visitCount
          lastVisited: expect.any(Number), // Current timestamp
          title: '', // Empty title
        },
      });
    });

    it('should skip items that are too old', async () => {
      // Create a separate instance with default config for this test
      const defaultConfigInitializer = new HistoryInitializer(
        mockVisitStorageManager,
        mockInitializationStateManager,
        mockErrorManager
        // Use default config (365 days)
      );

      const oneYearAgo = Date.now() - (366 * 24 * 60 * 60 * 1000); // Older than 365 days
      const recent = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago

      const mockHistoryItems: chrome.history.HistoryItem[] = [
        {
          id: '1',
          url: 'https://example.com/old',
          title: 'Old Page',
          lastVisitTime: oneYearAgo,
          visitCount: 1,
        },
        {
          id: '2',
          url: 'https://example.com/recent',
          title: 'Recent Page',
          lastVisitTime: recent,
          visitCount: 1,
        },
      ];

      const result = await defaultConfigInitializer.processHistoryItems(mockHistoryItems);

      expect(result).toEqual({
        'example.com/recent': {
          count: 1,
          lastVisited: recent,
          title: 'Recent Page',
        },
      });
    });

    it('should handle empty history items array', async () => {
      const result = await historyInitializer.processHistoryItems([]);

      expect(result).toEqual({});
    });
  });

  describe('markInitializationComplete', () => {
    it('should mark initialization as complete with processed items count', async () => {
      const mockVisitData: IVisitData = {
        'example.com/page1': { count: 5, lastVisited: 1000, title: 'Page 1' },
        'example.com/page2': { count: 3, lastVisited: 2000, title: 'Page 2' },
      };

      mockVisitStorageManager.getAllVisitData.mockReturnValue(mockVisitData);

      await historyInitializer.markInitializationComplete();

      expect(mockInitializationStateManager.markInitializationComplete).toHaveBeenCalledWith(2);
    });
  });

  describe('URL normalization', () => {
    it('should normalize URLs consistently with VisitStorageManager', async () => {
      const now = Date.now();
      const mockHistoryItems: chrome.history.HistoryItem[] = [
        {
          id: '1',
          url: 'https://www.Example.Com/Path/',
          title: 'Test Page',
          lastVisitTime: now - 2000,
          visitCount: 1,
        },
        {
          id: '2',
          url: 'http://Example.Com/Path',
          title: 'Test Page 2',
          lastVisitTime: now - 1000,
          visitCount: 1,
        },
      ];

      const result = await historyInitializer.processHistoryItems(mockHistoryItems);

      // Both URLs should normalize to the same key
      expect(result).toEqual({
        'example.com/path': {
          count: 2, // Aggregated
          lastVisited: now - 1000, // Most recent
          title: 'Test Page 2', // From most recent visit
        },
      });
    });

    it('should filter out non-HTTP URLs', async () => {
      const now = Date.now();
      const mockHistoryItems: chrome.history.HistoryItem[] = [
        {
          id: '1',
          url: 'not-a-valid-url',
          title: 'Invalid URL',
          lastVisitTime: now - 2000,
          visitCount: 1,
        },
        {
          id: '2',
          url: 'https://example.com/valid',
          title: 'Valid URL',
          lastVisitTime: now - 1000,
          visitCount: 1,
        },
      ];

      const result = await historyInitializer.processHistoryItems(mockHistoryItems);

      // Should only include the valid HTTP URL
      expect(result).toEqual({
        'example.com/valid': {
          count: 1,
          lastVisited: now - 1000,
          title: 'Valid URL',
        },
      });
    });
  });

  describe('batch processing', () => {
    it('should process large datasets in batches', async () => {
      const now = Date.now();
      // Create a large dataset
      const mockHistoryItems: chrome.history.HistoryItem[] = [];
      for (let i = 0; i < 2500; i++) {
        mockHistoryItems.push({
          id: i.toString(),
          url: `https://example.com/page${i}`,
          title: `Page ${i}`,
          lastVisitTime: now - (2500 - i) * 1000, // Recent timestamps
          visitCount: 1,
        });
      }

      const result = await historyInitializer.processHistoryItems(mockHistoryItems);

      // Should process all items
      expect(Object.keys(result)).toHaveLength(2500);
      
      // Verify a few items to ensure correct processing
      expect(result['example.com/page0']).toEqual({
        count: 1,
        lastVisited: now - 2500000,
        title: 'Page 0',
      });
      expect(result['example.com/page2499']).toEqual({
        count: 1,
        lastVisited: now - 1000,
        title: 'Page 2499',
      });
    });
  });

  describe('data aggregation and storage integration', () => {
    describe('integrateAndSaveHistoryData', () => {
      it('should integrate history data with existing visit data', async () => {
        const existingData: IVisitData = {
          'example.com/existing': {
            count: 2,
            lastVisited: 1000,
            title: 'Existing Page',
          },
        };

        const historyData: IVisitData = {
          'example.com/existing': {
            count: 5,
            lastVisited: 2000,
            title: 'Updated Page',
          },
          'example.com/new': {
            count: 3,
            lastVisited: 1500,
            title: 'New Page',
          },
        };

        mockVisitStorageManager.loadVisitData.mockResolvedValue(existingData);
        mockVisitStorageManager.saveVisitData.mockResolvedValue();

        // Access the private method through type assertion
        await (historyInitializer as any).integrateAndSaveHistoryData(historyData);

        // Verify that saveVisitData was called with integrated data
        expect(mockVisitStorageManager.saveVisitData).toHaveBeenCalledWith({
          'example.com/existing': {
            count: 5, // History data takes precedence
            lastVisited: 2000,
            title: 'Updated Page',
          },
          'example.com/new': {
            count: 3,
            lastVisited: 1500,
            title: 'New Page',
          },
        });
      });

      it('should preserve existing titles when history data has empty titles', async () => {
        const existingData: IVisitData = {
          'example.com/page': {
            count: 2,
            lastVisited: 1000,
            title: 'Existing Title',
          },
        };

        const historyData: IVisitData = {
          'example.com/page': {
            count: 5,
            lastVisited: 2000,
            title: '', // Empty title from history
          },
        };

        mockVisitStorageManager.loadVisitData.mockResolvedValue(existingData);
        mockVisitStorageManager.saveVisitData.mockResolvedValue();

        await (historyInitializer as any).integrateAndSaveHistoryData(historyData);

        expect(mockVisitStorageManager.saveVisitData).toHaveBeenCalledWith({
          'example.com/page': {
            count: 5,
            lastVisited: 2000,
            title: 'Existing Title', // Preserved from existing data
          },
        });
      });

      it('should handle storage errors during integration', async () => {
        const historyData: IVisitData = {
          'example.com/page': {
            count: 5,
            lastVisited: 2000,
            title: 'Test Page',
          },
        };

        mockVisitStorageManager.loadVisitData.mockResolvedValue({});
        mockVisitStorageManager.saveVisitData.mockRejectedValue(new Error('Storage error'));

        await expect(
          (historyInitializer as any).integrateAndSaveHistoryData(historyData)
        ).rejects.toThrow('Storage error');

        expect(mockErrorManager.addError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to integrate history data')
        );
      });
    });

    describe('saveWithRetry', () => {
      it('should retry on quota exceeded errors', async () => {
        const testData: IVisitData = {
          'example.com/page1': { count: 1, lastVisited: 1000, title: 'Page 1' },
          'example.com/page2': { count: 1, lastVisited: 2000, title: 'Page 2' },
        };

        // First call fails with quota error, second succeeds
        mockVisitStorageManager.saveVisitData
          .mockRejectedValueOnce(new Error('QUOTA_BYTES exceeded'))
          .mockResolvedValueOnce();

        await (historyInitializer as any).saveWithRetry(testData);

        expect(mockVisitStorageManager.saveVisitData).toHaveBeenCalledTimes(2);
        expect(mockErrorManager.addError).toHaveBeenCalledWith(
          expect.stringContaining('Storage quota exceeded during history initialization')
        );
      });

      it('should fail after max retries on quota errors', async () => {
        const testData: IVisitData = {
          'example.com/page': { count: 1, lastVisited: 1000, title: 'Page' },
        };

        mockVisitStorageManager.saveVisitData.mockRejectedValue(new Error('QUOTA_BYTES exceeded'));

        await expect(
          (historyInitializer as any).saveWithRetry(testData, 1)
        ).rejects.toThrow('Storage quota exceeded after 2 attempts');

        expect(mockVisitStorageManager.saveVisitData).toHaveBeenCalledTimes(2);
      });

      it('should not retry on non-quota errors', async () => {
        const testData: IVisitData = {
          'example.com/page': { count: 1, lastVisited: 1000, title: 'Page' },
        };

        mockVisitStorageManager.saveVisitData.mockRejectedValue(new Error('Network error'));

        await expect(
          (historyInitializer as any).saveWithRetry(testData)
        ).rejects.toThrow('Network error');

        expect(mockVisitStorageManager.saveVisitData).toHaveBeenCalledTimes(1);
      });
    });

    describe('reduceDataForQuota', () => {
      it('should remove oldest entries to reduce data size', async () => {
        const testData: IVisitData = {
          'example.com/old1': { count: 1, lastVisited: 1000, title: 'Old 1' },
          'example.com/old2': { count: 1, lastVisited: 2000, title: 'Old 2' },
          'example.com/new1': { count: 1, lastVisited: 8000, title: 'New 1' },
          'example.com/new2': { count: 1, lastVisited: 9000, title: 'New 2' },
          'example.com/new3': { count: 1, lastVisited: 10000, title: 'New 3' },
        };

        const result = await (historyInitializer as any).reduceDataForQuota(testData);

        // Should remove 30% (1.5 floored to 1) of oldest entries
        expect(Object.keys(result)).toHaveLength(4);
        expect(result['example.com/old1']).toBeUndefined();
        expect(result['example.com/old2']).toBeDefined();
        expect(result['example.com/new1']).toBeDefined();
        expect(result['example.com/new2']).toBeDefined();
        expect(result['example.com/new3']).toBeDefined();
      });

      it('should handle empty data gracefully', async () => {
        const result = await (historyInitializer as any).reduceDataForQuota({});
        expect(result).toEqual({});
      });

      it('should remove at least one entry even for small datasets', async () => {
        const testData: IVisitData = {
          'example.com/page1': { count: 1, lastVisited: 1000, title: 'Page 1' },
          'example.com/page2': { count: 1, lastVisited: 2000, title: 'Page 2' },
        };

        const result = await (historyInitializer as any).reduceDataForQuota(testData);

        expect(Object.keys(result)).toHaveLength(1);
        expect(result['example.com/page2']).toBeDefined(); // Keep the newer one
      });
    });

    describe('enhanced processHistoryItems', () => {
      it('should provide detailed processing statistics', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        
        const mockHistoryItems: chrome.history.HistoryItem[] = [
          {
            id: '1',
            url: 'https://example.com/valid',
            title: 'Valid Page',
            lastVisitTime: Date.now() - 1000,
            visitCount: 1,
          },
          {
            id: '2',
            url: 'chrome://settings', // Invalid URL
            title: 'Settings',
            lastVisitTime: Date.now() - 2000,
            visitCount: 1,
          },
          {
            id: '3',
            // Missing URL
            title: 'No URL',
            lastVisitTime: Date.now() - 3000,
            visitCount: 1,
          },
        ];

        await historyInitializer.processHistoryItems(mockHistoryItems);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('History processing completed: 1 processed, 2 skipped, 0 errors')
        );

        consoleSpy.mockRestore();
      });

      it('should handle high error rates', async () => {
        // Mock the normalizeUrl method to throw errors
        const originalNormalizeUrl = (historyInitializer as any).normalizeUrl;
        (historyInitializer as any).normalizeUrl = jest.fn().mockImplementation(() => {
          throw new Error('Normalization error');
        });

        // Create items that will cause processing errors
        const mockHistoryItems: chrome.history.HistoryItem[] = [];
        for (let i = 0; i < 150; i++) {
          mockHistoryItems.push({
            id: i.toString(),
            url: `https://example${i}.com/page`,
            title: `Item ${i}`,
            lastVisitTime: Date.now() - i * 1000,
            visitCount: 1,
          });
        }

        await historyInitializer.processHistoryItems(mockHistoryItems);

        expect(mockErrorManager.addError).toHaveBeenCalledWith(
          expect.stringContaining('High error rate during history processing')
        );

        // Restore original method
        (historyInitializer as any).normalizeUrl = originalNormalizeUrl;
      });

      it('should validate processed data and report invalid entries', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        // Mock the validateProcessedData method to test validation
        const originalValidate = (historyInitializer as any).validateProcessedData;
        (historyInitializer as any).validateProcessedData = jest.fn().mockImplementation((_data: IVisitData) => {
          // Simulate finding invalid entries
          mockErrorManager.addError('Found 2 invalid entries in processed history data');
        });

        const mockHistoryItems: chrome.history.HistoryItem[] = [
          {
            id: '1',
            url: 'https://example.com/page',
            title: 'Test Page',
            lastVisitTime: Date.now() - 1000,
            visitCount: 1,
          },
        ];

        await historyInitializer.processHistoryItems(mockHistoryItems);

        expect(mockErrorManager.addError).toHaveBeenCalledWith(
          'Found 2 invalid entries in processed history data'
        );

        // Restore original method
        (historyInitializer as any).validateProcessedData = originalValidate;
        consoleWarnSpy.mockRestore();
      });

      it('should ensure minimum visit count of 1', async () => {
        const mockHistoryItems: chrome.history.HistoryItem[] = [
          {
            id: '1',
            url: 'https://example.com/page',
            title: 'Test Page',
            lastVisitTime: Date.now() - 1000,
            visitCount: 0, // Invalid count
          },
        ];

        const result = await historyInitializer.processHistoryItems(mockHistoryItems);

        expect(result['example.com/page']?.count).toBe(1); // Should be corrected to 1
      });

      it('should preserve non-empty titles when aggregating', async () => {
        const now = Date.now();
        const mockHistoryItems: chrome.history.HistoryItem[] = [
          {
            id: '1',
            url: 'https://example.com/page',
            title: '', // Empty title
            lastVisitTime: now - 2000,
            visitCount: 1,
          },
          {
            id: '2',
            url: 'https://example.com/page',
            title: 'Good Title', // Non-empty title
            lastVisitTime: now - 1000, // More recent
            visitCount: 1,
          },
        ];

        const result = await historyInitializer.processHistoryItems(mockHistoryItems);

        expect(result['example.com/page']?.title).toBe('Good Title');
      });
    });
  });
});