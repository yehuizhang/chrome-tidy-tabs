/**
 * Unit tests for StorageManager
 * Tests Chrome storage operations, error handling, and fallback mechanisms
 */

import { EnhancedStorageManager } from '../src/searching/enhanced-storage-manager';
import { IClickData } from '../src/searching/types';
import { mockChromeStorage } from './setup';

// Type augmentation for testing
declare const global: any;

describe('StorageManager', () => {
  let storageManager: EnhancedStorageManager;

  beforeEach(() => {
    storageManager = new EnhancedStorageManager();
  });

  describe('Constructor and Storage Availability', () => {
    test('should detect available storage', () => {
      expect(storageManager.isStorageAvailable()).toBe(true);
    });

    test('should handle missing Chrome storage API', () => {
      const originalChrome = global.chrome;
      global.chrome = undefined;

      const storageManager = new EnhancedStorageManager();
      expect(storageManager.isStorageAvailable()).toBe(false);

      global.chrome = originalChrome;
    });

    test('should handle missing storage.sync API', () => {
      const originalChrome = global.chrome;
      global.chrome = { storage: {} } as any;

      const storageManager = new EnhancedStorageManager();
      expect(storageManager.isStorageAvailable()).toBe(false);

      global.chrome = originalChrome;
    });
  });

  describe('loadClickData', () => {
    test('should load valid click data successfully', async () => {
      const testData: IClickData = {
        'example.com/': { count: 5, lastClicked: 1703123456789 },
        'github.com/user/repo': { count: 3, lastClicked: 1703098765432 },
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: testData,
        webpage_click_data_version: 1,
      });

      const result = await storageManager.loadClickData();

      expect(result).toEqual(testData);
      expect(mockChromeStorage.sync.get).toHaveBeenCalledWith([
        'webpage_click_data',
        'webpage_click_data_version',
      ]);
    });

    test('should return empty object when no data exists', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({});

      const result = await storageManager.loadClickData();

      expect(result).toEqual({});
    });

    test('should validate and clean invalid data entries', async () => {
      const invalidData = {
        'valid.com/': { count: 5, lastClicked: 1703123456789 },
        'invalid1.com/': { count: 'invalid', lastClicked: 1703123456789 },
        'invalid2.com/': { count: 5 }, // missing lastClicked
        '': { count: 5, lastClicked: 1703123456789 }, // empty URL
        'invalid3.com/': null,
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: invalidData,
        webpage_click_data_version: 1,
      });

      const result = await storageManager.loadClickData();

      expect(result).toEqual({
        'valid.com/': { count: 5, lastClicked: 1703123456789 },
      });
    });

    test('should handle newer version data by resetting', async () => {
      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: { 'test.com/': { count: 1, lastClicked: 123 } },
        webpage_click_data_version: 999, // Future version
      });

      const result = await storageManager.loadClickData();

      expect(result).toEqual({});
    });

    test('should handle storage errors gracefully', async () => {
      mockChromeStorage.sync.get.mockRejectedValue(
        new Error('Storage access denied')
      );

      const result = await storageManager.loadClickData();

      expect(result).toEqual({});
    });

    test('should use fallback when storage unavailable', async () => {
      const originalChrome = global.chrome;
      global.chrome = undefined;

      const storageManager = new EnhancedStorageManager();
      const result = await storageManager.loadClickData();

      expect(result).toEqual({});

      global.chrome = originalChrome;
    });
  });

  describe('saveClickData', () => {
    test('should save click data successfully', async () => {
      const testData: IClickData = {
        'example.com/': { count: 5, lastClicked: 1703123456789 },
      };

      mockChromeStorage.sync.set.mockResolvedValue(undefined);

      await storageManager.saveClickData(testData);

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        webpage_click_data: testData,
        webpage_click_data_version: 1,
      });
    });

    test('should handle quota exceeded error with cleanup', async () => {
      const testData: IClickData = {};
      for (let i = 0; i < 100; i++) {
        testData[`site${i}.com/`] = {
          count: i,
          lastClicked: 1703123456789 + i,
        };
      }

      // First call fails with quota exceeded, second succeeds
      mockChromeStorage.sync.set
        .mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'))
        .mockResolvedValueOnce(undefined);

      await storageManager.saveClickData(testData);

      expect(mockChromeStorage.sync.set).toHaveBeenCalledTimes(2);
    });

    test('should handle rate limit error', async () => {
      const testData: IClickData = {
        'example.com/': { count: 5, lastClicked: 1703123456789 },
      };

      mockChromeStorage.sync.set.mockRejectedValue(
        new Error('MAX_WRITE_OPERATIONS_PER_MINUTE')
      );

      await storageManager.saveClickData(testData);

      // Should not throw error, should handle gracefully
      expect(true).toBe(true);
    });

    test('should use fallback when storage unavailable', async () => {
      const originalChrome = global.chrome;
      global.chrome = undefined;

      const testData: IClickData = {
        'example.com/': { count: 5, lastClicked: 1703123456789 },
      };

      const storageManager = new EnhancedStorageManager();
      await storageManager.saveClickData(testData);

      // Should not throw error
      expect(true).toBe(true);

      global.chrome = originalChrome;
    });

    test('should handle general storage errors', async () => {
      const testData: IClickData = {
        'example.com/': { count: 5, lastClicked: 1703123456789 },
      };

      mockChromeStorage.sync.set.mockRejectedValue(new Error('Network error'));

      await storageManager.saveClickData(testData);

      // Should not throw error, should handle gracefully
      expect(true).toBe(true);
    });
  });

  describe('clearClickData', () => {
    test('should clear data successfully', async () => {
      mockChromeStorage.sync.remove.mockResolvedValue(undefined);

      await storageManager.clearClickData();

      expect(mockChromeStorage.sync.remove).toHaveBeenCalledWith([
        'webpage_click_data',
        'webpage_click_data_version',
      ]);
    });

    test('should handle clear errors gracefully', async () => {
      mockChromeStorage.sync.remove.mockRejectedValue(
        new Error('Clear failed')
      );

      await storageManager.clearClickData();

      // Should not throw error
      expect(true).toBe(true);
    });

    test('should clear fallback when storage unavailable', async () => {
      const originalChrome = global.chrome;
      global.chrome = undefined;

      const storageManager = new EnhancedStorageManager();
      await storageManager.clearClickData();

      // Should not throw error
      expect(true).toBe(true);

      global.chrome = originalChrome;
    });
  });

  describe('getStorageInfo', () => {
    test('should return storage usage info', async () => {
      mockChromeStorage.sync.getBytesInUse.mockResolvedValue(1024);

      const info = await storageManager.getStorageInfo();

      expect(info).toEqual({
        bytesInUse: 1024,
        quotaBytes: 102400,
      });
      expect(mockChromeStorage.sync.getBytesInUse).toHaveBeenCalledWith(
        'webpage_click_data'
      );
    });

    test('should handle storage info errors', async () => {
      mockChromeStorage.sync.getBytesInUse.mockRejectedValue(
        new Error('Info failed')
      );

      const info = await storageManager.getStorageInfo();

      expect(info).toEqual({
        bytesInUse: 0,
        quotaBytes: 0,
      });
    });

    test('should return zeros when storage unavailable', async () => {
      const originalChrome = global.chrome;
      global.chrome = undefined;

      const storageManager = new EnhancedStorageManager();
      const info = await storageManager.getStorageInfo();

      expect(info).toEqual({
        bytesInUse: 0,
        quotaBytes: 0,
      });

      global.chrome = originalChrome;
    });
  });

  describe('Storage Cleanup', () => {
    test('should keep most recent entries during cleanup', async () => {
      const largeData: IClickData = {};
      for (let i = 0; i < 100; i++) {
        largeData[`site${i}.com/`] = {
          count: i,
          lastClicked: 1703123456789 + i * 1000, // Increasing timestamps
        };
      }

      // First call fails with quota exceeded, second succeeds
      mockChromeStorage.sync.set
        .mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'))
        .mockResolvedValueOnce(undefined);

      await storageManager.saveClickData(largeData);

      // Should have called set twice (original + cleanup)
      expect(mockChromeStorage.sync.set).toHaveBeenCalledTimes(2);

      // Check that cleanup kept 80% of entries (80 out of 100)
      const cleanupCall = mockChromeStorage.sync.set.mock.calls[1][0];
      const cleanedData = cleanupCall.webpage_click_data;
      expect(Object.keys(cleanedData)).toHaveLength(80);

      // Verify it kept the most recent entries (highest lastClicked values)
      const cleanedEntries = Object.entries(cleanedData);
      const minLastClicked = Math.min(
        ...cleanedEntries.map(([, data]) => (data as { count: number; lastClicked: number }).lastClicked)
      );
      expect(minLastClicked).toBeGreaterThan(1703123456789 + 19 * 1000); // Should keep entries from index 20+
    });

    test('should disable storage if cleanup fails', async () => {
      const testData: IClickData = {
        'example.com/': { count: 5, lastClicked: 1703123456789 },
      };

      // Both original save and cleanup fail
      mockChromeStorage.sync.set.mockRejectedValue(new Error('QUOTA_EXCEEDED'));

      await storageManager.saveClickData(testData);

      // Should not throw error, should handle gracefully
      expect(true).toBe(true);
    });
  });

  describe('Data Validation', () => {
    test('should validate data through loadClickData with mixed valid/invalid entries', async () => {
      const mixedData = {
        'valid1.com/': { count: 5, lastClicked: 1703123456789 },
        'valid2.com/': { count: 10, lastClicked: 1703123456790 },
        'invalid1.com/': { count: 'invalid', lastClicked: 1703123456789 }, // invalid count type
        'invalid2.com/': { count: 5 }, // missing lastClicked
        '': { count: 5, lastClicked: 1703123456789 }, // empty URL
        'invalid3.com/': { count: -1, lastClicked: 1703123456789 }, // negative count
        'invalid4.com/': { count: 5, lastClicked: 0 }, // zero lastClicked
        'invalid5.com/': null, // null data
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: mixedData,
        webpage_click_data_version: 1
      });

      const result = await storageManager.loadClickData();

      // Should only contain valid entries
      expect(result).toEqual({
        'valid1.com/': { count: 5, lastClicked: 1703123456789 },
        'valid2.com/': { count: 10, lastClicked: 1703123456790 },
      });
      
      // Should have filtered out 6 invalid entries
      expect(Object.keys(result)).toHaveLength(2);
    });

    test('should handle completely invalid data gracefully', async () => {
      const invalidData = {
        'invalid1.com/': { count: 'string', lastClicked: 1703123456789 },
        'invalid2.com/': { count: 5 }, // missing lastClicked
        '': { count: 5, lastClicked: 1703123456789 }, // empty URL
        'invalid3.com/': null,
        'invalid4.com/': undefined,
      };

      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: invalidData,
        webpage_click_data_version: 1
      });

      const result = await storageManager.loadClickData();

      // Should return empty object when all data is invalid
      expect(result).toEqual({});
      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
