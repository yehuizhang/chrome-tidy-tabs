/**
 * Unit tests for click tracking integration in BookmarkSearch
 * Tests click recording functionality for both mouse and keyboard interactions
 */

import { EnhancedStorageManager } from '../src/searching/enhanced-storage-manager';
import { mockChromeStorage } from './setup';

// Mock Chrome tabs API
const mockChromeTabs = {
  create: jest.fn(),
};

// Mock window.close
const mockWindowClose = jest.fn();

// Set up global mocks
beforeAll(() => {
  (global as any).chrome = {
    ...((global as any).chrome || {}),
    tabs: mockChromeTabs,
  };
  (global as any).window = {
    ...((global as any).window || {}),
    close: mockWindowClose,
  };
});

describe('Click Tracking Integration', () => {
  let storageManager: EnhancedStorageManager;

  beforeEach(() => {
    storageManager = new EnhancedStorageManager();
    storageManager.enableTestMode(); // Enable synchronous saves for testing
    jest.clearAllMocks();
    
    // Set up default mock behavior
    mockChromeStorage.sync.get.mockResolvedValue({});
    mockChromeStorage.sync.set.mockResolvedValue(undefined);
    mockChromeTabs.create.mockResolvedValue({ id: 1 });
  });

  describe('ClickTracker.recordClick', () => {
    test('should record click for new URL', async () => {
      await storageManager.loadClickData();
      
      const testUrl = 'https://example.com/page';
      await storageManager.recordClick(testUrl);

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        webpage_click_data: {
          'example.com/page': {
            count: 1,
            lastClicked: expect.any(Number),
          },
        },
      });
    });

    test('should increment click count for existing URL', async () => {
      // Set up existing data
      const existingData = {
        'example.com/page': {
          count: 3,
          lastClicked: 1703123456789,
        },
      };
      
      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: existingData,
      });

      await storageManager.loadClickData();
      
      const testUrl = 'https://example.com/page';
      await storageManager.recordClick(testUrl);

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        webpage_click_data: {
          'example.com/page': {
            count: 4,
            lastClicked: expect.any(Number),
          },
        },
      });
    });

    test('should normalize URLs before recording', async () => {
      await storageManager.loadClickData();
      
      // Test various URL formats that should normalize to the same key
      const urls = [
        'https://example.com/page?param=value',
        'http://example.com/page#section',
        'https://example.com/page?different=param#other',
      ];

      for (const url of urls) {
        await storageManager.recordClick(url);
      }

      // All should be recorded under the same normalized key
      expect(mockChromeStorage.sync.set).toHaveBeenCalledTimes(3);
      
      // Check the final call to see accumulated count
      const lastCall = mockChromeStorage.sync.set.mock.calls[2][0];
      expect(lastCall.webpage_click_data['example.com/page'].count).toBe(3);
    });

    test('should handle storage errors gracefully', async () => {
      await storageManager.loadClickData();
      
      mockChromeStorage.sync.set.mockRejectedValue(new Error('Storage failed'));
      
      const testUrl = 'https://example.com/page';
      
      // Should not throw error
      await expect(storageManager.recordClick(testUrl)).resolves.not.toThrow();
    });

    test('should auto-load data if not already loaded', async () => {
      const testUrl = 'https://example.com/page';
      
      // Don't call loadClickData first
      await storageManager.recordClick(testUrl);

      expect(mockChromeStorage.sync.get).toHaveBeenCalled();
      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        webpage_click_data: {
          'example.com/page': {
            count: 1,
            lastClicked: expect.any(Number),
          },
        },
      });
    });
  });

  describe('ClickTracker.getClickCount', () => {
    test('should return correct click count for existing URL', async () => {
      const existingData = {
        'example.com/page': {
          count: 5,
          lastClicked: 1703123456789,
        },
      };
      
      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: existingData,
      });

      await storageManager.loadClickData();
      
      const count = storageManager.getClickCount('https://example.com/page?param=value');
      expect(count).toBe(5);
    });

    test('should return 0 for non-existent URL', async () => {
      await storageManager.loadClickData();
      
      const count = storageManager.getClickCount('https://nonexistent.com/page');
      expect(count).toBe(0);
    });

    test('should return 0 when data not loaded', () => {
      // Don't load data first
      const count = storageManager.getClickCount('https://example.com/page');
      expect(count).toBe(0);
    });
  });

  describe('Bookmark Opening Integration', () => {
    test('should record click when opening bookmark via mouse click', async () => {
      // This test simulates the integration but doesn't test the actual DOM
      // since we're focusing on the click tracking logic
      const testUrl = 'https://example.com/bookmark';
      
      await storageManager.loadClickData();
      await storageManager.recordClick(testUrl);

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        webpage_click_data: {
          'example.com/bookmark': {
            count: 1,
            lastClicked: expect.any(Number),
          },
        },
      });
    });

    test('should record click when opening bookmark via keyboard navigation', async () => {
      // This test simulates keyboard navigation click recording
      const testUrl = 'https://github.com/user/repo';
      
      await storageManager.loadClickData();
      await storageManager.recordClick(testUrl);

      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        webpage_click_data: {
          'github.com/user/repo': {
            count: 1,
            lastClicked: expect.any(Number),
          },
        },
      });
    });

    test('should handle multiple rapid clicks correctly', async () => {
      const testUrl = 'https://example.com/rapid';
      
      await storageManager.loadClickData();
      
      // Simulate rapid clicks
      await storageManager.recordClick(testUrl);
      await storageManager.recordClick(testUrl);
      await storageManager.recordClick(testUrl);

      // Should record each click
      expect(mockChromeStorage.sync.set).toHaveBeenCalledTimes(3);
      
      // Final count should be 3
      const lastCall = mockChromeStorage.sync.set.mock.calls[2][0];
      expect(lastCall.webpage_click_data['example.com/rapid'].count).toBe(3);
    });

    test('should continue opening bookmark even if click recording fails', async () => {
      // This test verifies the error handling in the openBookmark method
      // We can't directly test the BookmarkSearch class here due to DOM dependencies,
      // but we can test that ClickTracker handles errors gracefully
      
      await storageManager.loadClickData();
      mockChromeStorage.sync.set.mockRejectedValue(new Error('Storage failed'));
      
      const testUrl = 'https://example.com/error-test';
      
      // Should not throw error, allowing bookmark opening to continue
      await expect(storageManager.recordClick(testUrl)).resolves.not.toThrow();
    });
  });

  describe('URL Normalization in Click Tracking', () => {
    test('should normalize different URL variations to same key', async () => {
      await storageManager.loadClickData();
      
      const urlVariations = [
        'https://example.com/path',
        'http://example.com/path',
        'https://example.com/path?query=param',
        'https://example.com/path#fragment',
        'https://example.com/path?query=param#fragment',
      ];

      // Record clicks for all variations
      for (const url of urlVariations) {
        await storageManager.recordClick(url);
      }

      // All should be stored under the same normalized key
      const finalCall = mockChromeStorage.sync.set.mock.calls[4][0];
      const clickData = finalCall.webpage_click_data;
      
      expect(Object.keys(clickData)).toHaveLength(1);
      expect(clickData['example.com/path'].count).toBe(5);
    });

    test('should handle invalid URLs gracefully', async () => {
      await storageManager.loadClickData();
      
      const invalidUrl = 'not-a-valid-url';
      
      await storageManager.recordClick(invalidUrl);

      // Should store the original URL as fallback
      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        webpage_click_data: {
          'not-a-valid-url': {
            count: 1,
            lastClicked: expect.any(Number),
          },
        },
      });
    });
  });

  describe('Cross-session Persistence', () => {
    test('should maintain click counts across sessions', async () => {
      // Simulate existing data from previous session
      const previousSessionData = {
        'example.com/persistent': {
          count: 10,
          lastClicked: 1703123456789,
        },
      };
      
      mockChromeStorage.sync.get.mockResolvedValue({
        webpage_click_data: previousSessionData,
      });

      await storageManager.loadClickData();
      
      // Add new click in current session
      await storageManager.recordClick('https://example.com/persistent');

      // Should increment existing count
      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        webpage_click_data: {
          'example.com/persistent': {
            count: 11,
            lastClicked: expect.any(Number),
          },
        },
      });
    });
  });
});