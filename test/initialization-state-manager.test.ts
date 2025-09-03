import { InitializationStateManager, IInitializationState } from '../src/searching/initialization-state-manager';
import { IErrorManager } from '../src/error-manager';

// Mock Chrome API
const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
};

// Mock error manager
const mockErrorManager: IErrorManager = {
  addError: jest.fn(),
  getErrors: jest.fn(() => []),
  clearErrors: jest.fn(),
  displayErrors: jest.fn(),
  initializeErrorDisplay: jest.fn(),
};

// Set up global chrome mock
(global as any).chrome = {
  storage: mockChromeStorage,
};

describe('InitializationStateManager', () => {
  let stateManager: InitializationStateManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure Chrome mock is properly set up before creating the state manager
    (global as any).chrome = {
      storage: mockChromeStorage,
    };
    stateManager = new InitializationStateManager(mockErrorManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isStorageAvailable', () => {
    it('should return true when Chrome storage is available', () => {
      expect(stateManager.isStorageAvailable()).toBe(true);
    });

    it('should return false when Chrome storage is not available', () => {
      const originalChrome = (global as any).chrome;
      (global as any).chrome = undefined;

      const newStateManager = new InitializationStateManager(mockErrorManager);
      expect(newStateManager.isStorageAvailable()).toBe(false);
      expect(mockErrorManager.addError).toHaveBeenCalledWith('Chrome storage API is not available');

      (global as any).chrome = originalChrome;
    });
  });

  describe('loadInitializationState', () => {
    it('should load valid initialization state from storage', async () => {
      const mockState: IInitializationState = {
        isHistoryInitialized: true,
        initializationDate: 1234567890,
        historyItemsProcessed: 100,
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': mockState,
      });

      const result = await stateManager.loadInitializationState();

      expect(result).toEqual(mockState);
      expect(mockChromeStorage.local.get).toHaveBeenCalledWith(['tidy_tabs_history_init_state']);
    });

    it('should return default state when no stored state exists', async () => {
      mockChromeStorage.local.get.mockResolvedValue({});

      const result = await stateManager.loadInitializationState();

      expect(result).toEqual({ isHistoryInitialized: false });
    });

    it('should return default state when stored state is invalid', async () => {
      const invalidState = {
        isHistoryInitialized: 'not a boolean', // Invalid type
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': invalidState,
      });

      const result = await stateManager.loadInitializationState();

      expect(result).toEqual({ isHistoryInitialized: false });
      expect(mockErrorManager.addError).toHaveBeenCalledWith('Invalid initialization state found, resetting to default');
    });

    it('should handle storage errors gracefully', async () => {
      const error = new Error('Storage error');
      mockChromeStorage.local.get.mockRejectedValue(error);

      const result = await stateManager.loadInitializationState();

      expect(result).toEqual({ isHistoryInitialized: false });
      expect(mockErrorManager.addError).toHaveBeenCalledWith('Failed to load initialization state: Storage error');
    });

    it('should return cached state on subsequent calls', async () => {
      const mockState: IInitializationState = {
        isHistoryInitialized: true,
        initializationDate: 1234567890,
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': mockState,
      });

      // First call
      const result1 = await stateManager.loadInitializationState();
      // Second call
      const result2 = await stateManager.loadInitializationState();

      expect(result1).toEqual(mockState);
      expect(result2).toEqual(mockState);
      expect(mockChromeStorage.local.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveInitializationState', () => {
    it('should save valid initialization state to storage', async () => {
      const state: IInitializationState = {
        isHistoryInitialized: true,
        initializationDate: Date.now(),
        historyItemsProcessed: 150,
      };

      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await stateManager.saveInitializationState(state);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        'tidy_tabs_history_init_state': state,
      });
    });

    it('should handle storage errors gracefully', async () => {
      const state: IInitializationState = {
        isHistoryInitialized: true,
      };

      const error = new Error('Storage error');
      mockChromeStorage.local.set.mockRejectedValue(error);

      await stateManager.saveInitializationState(state);

      expect(mockErrorManager.addError).toHaveBeenCalledWith('Failed to save initialization state: Storage error');
    });

    it('should not save invalid state', async () => {
      const invalidState = {
        isHistoryInitialized: 'not a boolean', // Invalid type
      } as any;

      await stateManager.saveInitializationState(invalidState);

      expect(mockChromeStorage.local.set).not.toHaveBeenCalled();
      expect(mockErrorManager.addError).toHaveBeenCalledWith('Invalid initialization state format - state not saved');
    });

    it('should handle unavailable storage', async () => {
      const originalChrome = (global as any).chrome;
      (global as any).chrome = undefined;

      const state: IInitializationState = {
        isHistoryInitialized: true,
      };

      const newStateManager = new InitializationStateManager(mockErrorManager);
      await newStateManager.saveInitializationState(state);

      expect(mockErrorManager.addError).toHaveBeenCalledWith('Chrome storage API is not available - initialization state not saved');

      (global as unknown).chrome = originalChrome;
    });
  });

  describe('isInitializationNeeded', () => {
    it('should return false when initialization is already complete', async () => {
      const completedState: IInitializationState = {
        isHistoryInitialized: true,
        initializationDate: Date.now(),
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': completedState,
      });

      const result = await stateManager.isInitializationNeeded();

      expect(result).toBe(false);
    });

    it('should return false when permission was denied', async () => {
      const deniedState: IInitializationState = {
        isHistoryInitialized: false,
        permissionDenied: true,
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': deniedState,
      });

      const result = await stateManager.isInitializationNeeded();

      expect(result).toBe(false);
    });

    it('should return true when initialization is needed', async () => {
      const defaultState: IInitializationState = {
        isHistoryInitialized: false,
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': defaultState,
      });

      const result = await stateManager.isInitializationNeeded();

      expect(result).toBe(true);
    });

    it('should return true for fresh installation (no stored state)', async () => {
      mockChromeStorage.local.get.mockResolvedValue({});

      const result = await stateManager.isInitializationNeeded();

      expect(result).toBe(true);
    });
  });

  describe('markInitializationComplete', () => {
    it('should mark initialization as complete with items processed', async () => {
      const initialState: IInitializationState = {
        isHistoryInitialized: false,
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': initialState,
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      const itemsProcessed = 250;
      await stateManager.markInitializationComplete(itemsProcessed);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        'tidy_tabs_history_init_state': expect.objectContaining({
          isHistoryInitialized: true,
          historyItemsProcessed: itemsProcessed,
          partialCompletion: false,
          initializationDate: expect.any(Number),
        }),
      });
    });

    it('should mark initialization as complete without items processed', async () => {
      const initialState: IInitializationState = {
        isHistoryInitialized: false,
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': initialState,
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await stateManager.markInitializationComplete();

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        'tidy_tabs_history_init_state': expect.objectContaining({
          isHistoryInitialized: true,
          partialCompletion: false,
          initializationDate: expect.any(Number),
        }),
      });
    });

    it('should clear partial completion flag when marking complete', async () => {
      const partialState: IInitializationState = {
        isHistoryInitialized: false,
        partialCompletion: true,
        historyItemsProcessed: 100,
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': partialState,
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await stateManager.markInitializationComplete(200);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        'tidy_tabs_history_init_state': expect.objectContaining({
          isHistoryInitialized: true,
          partialCompletion: false,
          historyItemsProcessed: 200,
        }),
      });
    });
  });

  describe('markPermissionDenied', () => {
    it('should mark permission as denied', async () => {
      const initialState: IInitializationState = {
        isHistoryInitialized: false,
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': initialState,
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await stateManager.markPermissionDenied();

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        'tidy_tabs_history_init_state': expect.objectContaining({
          permissionDenied: true,
          initializationDate: expect.any(Number),
        }),
      });
    });
  });

  describe('markPartialCompletion', () => {
    it('should mark partial completion with processed items and timestamp', async () => {
      const initialState: IInitializationState = {
        isHistoryInitialized: false,
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': initialState,
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      const itemsProcessed = 75;
      const lastTimestamp = 1234567890;

      await stateManager.markPartialCompletion(itemsProcessed, lastTimestamp);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        'tidy_tabs_history_init_state': expect.objectContaining({
          partialCompletion: true,
          historyItemsProcessed: itemsProcessed,
          lastProcessedTimestamp: lastTimestamp,
        }),
      });
    });
  });

  describe('resetInitializationState', () => {
    it('should reset state to default', async () => {
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await stateManager.resetInitializationState();

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        'tidy_tabs_history_init_state': {
          isHistoryInitialized: false,
        },
      });
    });
  });

  describe('state validation', () => {
    it('should accept valid complete state', async () => {
      const validState: IInitializationState = {
        isHistoryInitialized: true,
        initializationDate: 1234567890,
        permissionDenied: false,
        historyItemsProcessed: 100,
        partialCompletion: false,
        lastProcessedTimestamp: 1234567800,
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': validState,
      });

      const result = await stateManager.loadInitializationState();

      expect(result).toEqual(validState);
    });

    it('should reject state with invalid isHistoryInitialized type', async () => {
      const invalidState = {
        isHistoryInitialized: 'true', // Should be boolean
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': invalidState,
      });

      const result = await stateManager.loadInitializationState();

      expect(result).toEqual({ isHistoryInitialized: false });
      expect(mockErrorManager.addError).toHaveBeenCalledWith('Invalid initialization state found, resetting to default');
    });

    it('should reject state with invalid optional field types', async () => {
      const invalidState = {
        isHistoryInitialized: true,
        initializationDate: 'not a number', // Should be number
      };

      mockChromeStorage.local.get.mockResolvedValue({
        'tidy_tabs_history_init_state': invalidState,
      });

      const result = await stateManager.loadInitializationState();

      expect(result).toEqual({ isHistoryInitialized: false });
      expect(mockErrorManager.addError).toHaveBeenCalledWith('Invalid initialization state found, resetting to default');
    });
  });
});