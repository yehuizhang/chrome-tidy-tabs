import { HistoryInitializer } from '../src/searching/history-initializer';
import { VisitStorageManager } from '../src/searching/visit-storage-manager';
import { InitializationStateManager } from '../src/searching/initialization-state-manager';
import { ErrorManager } from '../src/error-manager';
import { 
  IProgressCallback
} from '../src/searching/types';

// Mock DOM environment
const mockElement = {
  id: '',
  className: '',
  innerHTML: '',
  style: { display: 'none' },
  parentNode: null as any,
  insertBefore: jest.fn(),
  appendChild: jest.fn(),
};

const mockDocument = {
  getElementById: jest.fn(),
  createElement: jest.fn(() => ({ ...mockElement })),
  querySelector: jest.fn(),
  body: {
    ...mockElement,
    firstChild: null as any,
    insertBefore: jest.fn(),
    appendChild: jest.fn(),
  },
};

(global as any).document = mockDocument;

describe('Progress Tracking and Error Messaging', () => {
  let historyInitializer: HistoryInitializer;
  let visitStorageManager: VisitStorageManager;
  let initializationStateManager: InitializationStateManager;
  let errorManager: ErrorManager;
  let progressCallback: jest.MockedFunction<IProgressCallback>;
  let mockChrome: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up Chrome API mock
    mockChrome = {
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
    (global as any).chrome = mockChrome;
    
    // Create mock instances
    visitStorageManager = new VisitStorageManager();
    initializationStateManager = new InitializationStateManager();
    errorManager = new ErrorManager();
    
    // Mock the dependencies
    jest.spyOn(visitStorageManager, 'loadVisitData').mockResolvedValue({});
    jest.spyOn(visitStorageManager, 'saveVisitData').mockResolvedValue();
    jest.spyOn(visitStorageManager, 'getAllVisitData').mockReturnValue({});
    
    jest.spyOn(initializationStateManager, 'isInitializationNeeded').mockResolvedValue(true);
    jest.spyOn(initializationStateManager, 'markInitializationComplete').mockResolvedValue();
    jest.spyOn(initializationStateManager, 'markPartialCompletion').mockResolvedValue();
    
    jest.spyOn(errorManager, 'addError').mockImplementation();
    jest.spyOn(errorManager, 'addHistoryInitializationError').mockImplementation();
    jest.spyOn(errorManager, 'addPermissionError').mockImplementation();

    // Create progress callback mock
    progressCallback = jest.fn();

    // Create history initializer with mocked dependencies
    historyInitializer = new HistoryInitializer(
      visitStorageManager,
      initializationStateManager,
      errorManager,
      { maxHistoryItems: 100, batchSize: 10, maxAge: 365 }
    );

    // Mock DOM for progress display manager
    document.body.innerHTML = `
      <div class="tab-tooling-container"></div>
      <div class="search-container"></div>
    `;
  });

  describe('Progress Tracking', () => {
    it('should report progress through initialization phases', async () => {
      // Mock successful history data
      const mockHistoryItems = Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        url: `https://example${i}.com`,
        title: `Example ${i}`,
        lastVisitTime: Date.now() - i * 1000,
        visitCount: i + 1,
      }));

      mockChrome.history.search.mockResolvedValue(mockHistoryItems);

      const result = await historyInitializer.initialize(progressCallback);

      expect(result.success).toBe(true);
      expect(progressCallback).toHaveBeenCalled();

      // Verify we get progress callbacks
      const calls = progressCallback.mock.calls.map(call => call[0]);
      const phases = calls.map(call => call.phase);
      
      expect(phases).toContain('checking');
      expect(phases).toContain('reading_history');
      expect(phases).toContain('processing');
      expect(phases).toContain('saving');
      expect(phases).toContain('complete');
    });

    it('should report progress with time estimates for large datasets', async () => {
      // Mock large history dataset
      const mockHistoryItems = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        url: `https://example${i}.com`,
        title: `Example ${i}`,
        lastVisitTime: Date.now() - i * 1000,
        visitCount: i + 1,
      }));

      mockChrome.history.search.mockResolvedValue(mockHistoryItems);

      await historyInitializer.initialize(progressCallback);

      // Find processing progress calls
      const processingCalls = progressCallback.mock.calls
        .map(call => call[0])
        .filter(progress => progress.phase === 'processing' && progress.processedItems);

      // Should have time estimates for later batches
      const laterCalls = processingCalls.slice(1);
      expect(laterCalls.some(call => call.estimatedTimeRemaining !== undefined)).toBe(true);
    });

    it('should handle progress callback errors gracefully', async () => {
      const faultyCallback = jest.fn().mockImplementation(() => {
        throw new Error('Progress callback error');
      });

      const mockHistoryItems = [{
        id: '1',
        url: 'https://example.com',
        title: 'Example',
        lastVisitTime: Date.now(),
        visitCount: 1,
      }];

      mockChrome.history.search.mockResolvedValue(mockHistoryItems);

      // Should not throw despite callback errors
      const result = await historyInitializer.initialize(faultyCallback);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Messaging', () => {
    it('should report API unavailability errors', async () => {
      // Mock Chrome API as unavailable
      (global as any).chrome = undefined;

      const result = await historyInitializer.initialize(progressCallback);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Chrome history API is not available');
    });

    it('should report processing errors', async () => {
      // Mock history search to throw error
      mockChrome.history.search.mockRejectedValue(new Error('History access denied'));

      const result = await historyInitializer.initialize(progressCallback);

      expect(result.success).toBe(false);
      expect(result.error).toContain('History access denied');
    });
  });



  describe('Enhanced Error Manager', () => {
    it('should add history initialization errors', () => {
      // Create a real error manager instance for this test
      const realErrorManager = new ErrorManager();
      
      realErrorManager.addHistoryInitializationError('Test error', 'processing');
      
      const errors = realErrorManager.getErrors();
      expect(errors).toContain('History Initialization (processing): Test error');
    });
  });

  describe('Integration Tests', () => {
    it('should provide complete progress feedback for successful initialization', async () => {
      const mockHistoryItems = Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        url: `https://example${i}.com`,
        title: `Example ${i}`,
        lastVisitTime: Date.now() - i * 1000,
        visitCount: i + 1,
      }));

      mockChrome.history.search.mockResolvedValue(mockHistoryItems);

      const result = await historyInitializer.initialize(progressCallback);

      expect(result.success).toBe(true);
      expect(result.itemsProcessed).toBe(5);
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });
  });
});