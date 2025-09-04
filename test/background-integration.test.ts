// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onActivated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    get: jest.fn(),
  },
  history: {
    search: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};

// Set up global mocks before importing modules
(global as any).chrome = mockChrome;
(global as any).localStorage = mockLocalStorage;

import { BackgroundVisitTracker } from '../src/core/background';
import { HistoryInitializer } from '../src/searching/history-initializer';
import { visitTracker } from '../src/searching/visit-tracker';
import { errorManager } from '../src/error-manager';



// Mock console methods to avoid noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks();
  
  // Reset localStorage mock
  mockLocalStorage.getItem.mockReturnValue(null);
  mockLocalStorage.setItem.mockImplementation(() => {});
  mockLocalStorage.removeItem.mockImplementation(() => {});
  mockLocalStorage.clear.mockImplementation(() => {});
  
  // Mock console methods
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  
  // Reset error manager
  errorManager.clearErrors();
  
  // Stop any existing tracking
  if (visitTracker.isTracking()) {
    visitTracker.stopTracking();
  }
  
  // Reset Chrome API mocks to working state
  mockChrome.tabs.onUpdated.addListener.mockImplementation(() => {});
  mockChrome.tabs.onActivated.addListener.mockImplementation(() => {});
  mockChrome.tabs.onUpdated.removeListener.mockImplementation(() => {});
  mockChrome.tabs.onActivated.removeListener.mockImplementation(() => {});
  mockChrome.tabs.get.mockResolvedValue({ url: 'https://example.com', title: 'Example' });
  mockChrome.history.search.mockResolvedValue([]);
  mockChrome.storage.local.get.mockResolvedValue({});
  mockChrome.storage.local.set.mockResolvedValue(undefined);
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('BackgroundVisitTracker Integration Tests', () => {
  describe('Successful Initialization Flow', () => {
    it('should complete full initialization when history init is needed', async () => {
      // Mock successful history initialization
      const mockHistoryItems = [
        {
          id: '1',
          url: 'https://example.com',
          title: 'Example',
          visitCount: 5,
          lastVisitTime: Date.now() - 1000,
        },
        {
          id: '2',
          url: 'https://test.com',
          title: 'Test',
          visitCount: 3,
          lastVisitTime: Date.now() - 2000,
        },
      ];

      mockChrome.history.search.mockResolvedValue(mockHistoryItems);
      mockChrome.storage.local.get.mockResolvedValue({}); // No existing state
      mockChrome.storage.local.set.mockResolvedValue(undefined);

      // Create background tracker
      new BackgroundVisitTracker();
      
      // Wait for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify history initialization was attempted
      expect(mockChrome.history.search).toHaveBeenCalled();
      expect(mockChrome.storage.local.set).toHaveBeenCalled();

      // Verify visit tracking was started
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(mockChrome.tabs.onActivated.addListener).toHaveBeenCalled();
      expect(visitTracker.isTracking()).toBe(true);

      // Verify no errors were logged
      expect(errorManager.getErrors()).toHaveLength(0);
    });

    it('should skip history init and start tracking when already initialized', async () => {
      // Mock existing initialization state
      const existingState = {
        tidy_tabs_history_init_state: {
          isHistoryInitialized: true,
          initializationDate: Date.now() - 86400000, // 1 day ago
          historyItemsProcessed: 100,
        },
      };

      mockChrome.storage.local.get.mockResolvedValue(existingState);

      // Create background tracker
      new BackgroundVisitTracker();
      
      // Wait for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify history search was NOT called
      expect(mockChrome.history.search).not.toHaveBeenCalled();

      // Verify visit tracking was started
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(mockChrome.tabs.onActivated.addListener).toHaveBeenCalled();
      expect(visitTracker.isTracking()).toBe(true);

      // Verify no errors were logged
      expect(errorManager.getErrors()).toHaveLength(0);
    });

    it('should skip history init when permission was denied', async () => {
      // Mock permission denied state
      const deniedState = {
        tidy_tabs_history_init_state: {
          isHistoryInitialized: false,
          permissionDenied: true,
          initializationDate: Date.now() - 3600000, // 1 hour ago
        },
      };

      mockChrome.storage.local.get.mockResolvedValue(deniedState);

      // Create background tracker
      new BackgroundVisitTracker();
      
      // Wait for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify history search was NOT called
      expect(mockChrome.history.search).not.toHaveBeenCalled();

      // Verify visit tracking was started
      expect(visitTracker.isTracking()).toBe(true);

      // Verify no errors were logged
      expect(errorManager.getErrors()).toHaveLength(0);
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle Chrome tabs API unavailable', async () => {
      // Remove tabs API
      (global as any).chrome = { ...mockChrome, tabs: undefined };

      // Create background tracker
      new BackgroundVisitTracker();
      
      // Wait for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error was logged
      const errors = errorManager.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.includes('Chrome tabs API is not available'))).toBe(true);

      // Restore chrome mock for other tests
      (global as any).chrome = mockChrome;
    });

    it('should handle history initialization failure gracefully', async () => {
      // Mock history API failure
      mockChrome.history.search.mockRejectedValue(new Error('History API failed'));
      mockChrome.storage.local.get.mockResolvedValue({}); // No existing state

      // Create background tracker
      new BackgroundVisitTracker();
      
      // Wait for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify history initialization was attempted
      expect(mockChrome.history.search).toHaveBeenCalled();

      // Verify visit tracking still started despite history failure
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(visitTracker.isTracking()).toBe(true);

      // Verify error was logged but extension continued
      const errors = errorManager.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.includes('History initialization failed'))).toBe(true);
    });

    it('should handle storage API failure during history init', async () => {
      // Mock storage failure
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage failed'));
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage failed'));

      // Create background tracker
      new BackgroundVisitTracker();
      
      // Wait for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify visit tracking still started
      expect(visitTracker.isTracking()).toBe(true);

      // Verify error was logged
      const errors = errorManager.getErrors();
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle visit tracking failure after successful history init', async () => {
      // Mock successful history init but failing visit tracking
      mockChrome.history.search.mockResolvedValue([]);
      mockChrome.storage.local.get.mockResolvedValue({});
      mockChrome.storage.local.set.mockResolvedValue(undefined);
      
      // Make tabs API fail
      mockChrome.tabs.onUpdated.addListener.mockImplementation(() => {
        throw new Error('Tabs API failed');
      });

      // Create background tracker
      new BackgroundVisitTracker();
      
      // Wait for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify history initialization completed
      expect(mockChrome.history.search).toHaveBeenCalled();

      // Verify error was logged for visit tracking failure
      const errors = errorManager.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.includes('Failed to initialize visit tracking'))).toBe(true);
    });
  });

  describe('Coordination Between Components', () => {
    it('should coordinate history init and visit tracking properly', async () => {
      const mockHistoryItems = [
        {
          id: '1',
          url: 'https://example.com',
          title: 'Example',
          visitCount: 5,
          lastVisitTime: Date.now() - 1000,
        },
      ];

      mockChrome.history.search.mockResolvedValue(mockHistoryItems);
      mockChrome.storage.local.get.mockResolvedValue({});
      mockChrome.storage.local.set.mockResolvedValue(undefined);

      // Create background tracker
      new BackgroundVisitTracker();
      
      // Wait for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the sequence: history init first, then visit tracking
      expect(mockChrome.history.search).toHaveBeenCalled();
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(visitTracker.isTracking()).toBe(true);

      // Verify no errors
      expect(errorManager.getErrors()).toHaveLength(0);
    });

    it('should provide access to history initializer for testing', () => {
      const tracker = new BackgroundVisitTracker();
      const historyInitializer = tracker.getHistoryInitializer();
      
      expect(historyInitializer).toBeInstanceOf(HistoryInitializer);
    });
  });

  describe('Large History Processing', () => {
    it('should handle large history datasets efficiently', async () => {
      // Create a large mock history dataset
      const largeHistoryItems = Array.from({ length: 5000 }, (_, i) => ({
        id: `${i}`,
        url: `https://example${i}.com`,
        title: `Example ${i}`,
        visitCount: Math.floor(Math.random() * 10) + 1,
        lastVisitTime: Date.now() - (i * 1000),
      }));

      mockChrome.history.search.mockResolvedValue(largeHistoryItems);
      mockChrome.storage.local.get.mockResolvedValue({});
      mockChrome.storage.local.set.mockResolvedValue(undefined);

      // Create background tracker
      new BackgroundVisitTracker();
      
      // Wait for async initialization to complete (longer timeout for large dataset)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify history processing completed
      expect(mockChrome.history.search).toHaveBeenCalled();
      expect(mockChrome.storage.local.set).toHaveBeenCalled();

      // Verify visit tracking started
      expect(visitTracker.isTracking()).toBe(true);

      // Should complete without errors
      expect(errorManager.getErrors()).toHaveLength(0);
    });
  });

  describe('Partial Completion Scenarios', () => {
    it('should handle partial completion state correctly', async () => {
      // Mock partial completion state
      const partialState = {
        tidy_tabs_history_init_state: {
          isHistoryInitialized: false,
          partialCompletion: true,
          historyItemsProcessed: 500,
          lastProcessedTimestamp: Date.now() - 3600000, // 1 hour ago
        },
      };

      mockChrome.storage.local.get.mockResolvedValue(partialState);
      mockChrome.history.search.mockResolvedValue([]);

      // Create background tracker
      new BackgroundVisitTracker();
      
      // Wait for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should attempt to complete initialization
      expect(mockChrome.history.search).toHaveBeenCalled();
      expect(visitTracker.isTracking()).toBe(true);
    });
  });
});

describe('Background Script Error Recovery', () => {
  it('should recover from complete initialization failure', async () => {
    // Mock complete failure scenario
    mockChrome.storage.local.get.mockRejectedValue(new Error('Complete storage failure'));
    mockChrome.history.search.mockRejectedValue(new Error('History API failure'));

    // Create background tracker
    new BackgroundVisitTracker();
    
    // Wait for async initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should still attempt to start visit tracking as fallback
    expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled();

    // Should log multiple errors but continue
    const errors = errorManager.getErrors();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should handle constructor exceptions gracefully', () => {
    // Mock Chrome API to be completely unavailable
    (global as any).chrome = undefined;

    // Should not throw when creating background tracker
    expect(() => {
      new BackgroundVisitTracker();
    }).not.toThrow();

    // Restore chrome mock
    (global as any).chrome = mockChrome;
  });
});