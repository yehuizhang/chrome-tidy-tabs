import {
  IErrorManager,
  errorManager as defaultErrorManager,
} from '../error-manager';

export interface IInitializationState {
  isHistoryInitialized: boolean;
  initializationDate?: number;
  permissionDenied?: boolean;
  historyItemsProcessed?: number;
  partialCompletion?: boolean;
  lastProcessedTimestamp?: number;
}

export interface IInitializationStateManager {
  loadInitializationState(): Promise<IInitializationState>;
  saveInitializationState(state: IInitializationState): Promise<void>;
  isInitializationNeeded(): Promise<boolean>;
  markInitializationComplete(itemsProcessed?: number): Promise<void>;
  markPermissionDenied(): Promise<void>;
  markPartialCompletion(
    itemsProcessed: number,
    lastTimestamp: number
  ): Promise<void>;
  resetInitializationState(): Promise<void>;
  isStorageAvailable(): boolean;
}

export class InitializationStateManager implements IInitializationStateManager {
  private static readonly STATE_KEY = 'tidy_tabs_history_init_state';

  private initializationState: IInitializationState = {
    isHistoryInitialized: false,
  };
  private isStateLoaded = false;
  private errorManager: IErrorManager;

  constructor(errorManager?: IErrorManager) {
    this.errorManager = errorManager || defaultErrorManager;
  }

  /**
   * Checks if Chrome storage API is available
   */
  isStorageAvailable(): boolean {
    try {
      const isAvailable =
        typeof chrome !== 'undefined' &&
        chrome.storage &&
        chrome.storage.local !== undefined;

      if (!isAvailable) {
        this.errorManager.addError('Chrome storage API is not available');
      }

      return isAvailable;
    } catch {
      this.errorManager.addError('Chrome storage API is not available');
      return false;
    }
  }

  /**
   * Validates initialization state structure
   */
  private validateInitializationState(
    data: unknown
  ): data is IInitializationState {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const state = data as Record<string, unknown>;

    // Required field
    if (typeof state['isHistoryInitialized'] !== 'boolean') {
      return false;
    }

    // Optional fields validation
    if (
      state['initializationDate'] !== undefined &&
      typeof state['initializationDate'] !== 'number'
    ) {
      return false;
    }

    if (
      state['permissionDenied'] !== undefined &&
      typeof state['permissionDenied'] !== 'boolean'
    ) {
      return false;
    }

    if (
      state['historyItemsProcessed'] !== undefined &&
      typeof state['historyItemsProcessed'] !== 'number'
    ) {
      return false;
    }

    if (
      state['partialCompletion'] !== undefined &&
      typeof state['partialCompletion'] !== 'boolean'
    ) {
      return false;
    }

    if (
      state['lastProcessedTimestamp'] !== undefined &&
      typeof state['lastProcessedTimestamp'] !== 'number'
    ) {
      return false;
    }

    return true;
  }

  /**
   * Loads initialization state from Chrome storage
   */
  async loadInitializationState(): Promise<IInitializationState> {
    if (this.isStateLoaded) {
      return { ...this.initializationState };
    }

    if (!this.isStorageAvailable()) {
      const errorMsg =
        'Chrome storage API is not available - using default initialization state';
      this.errorManager.addError(errorMsg);
      this.initializationState = { isHistoryInitialized: false };
      this.isStateLoaded = true;
      return { ...this.initializationState };
    }

    try {
      const result = await chrome.storage.local.get([
        InitializationStateManager.STATE_KEY,
      ]);
      const storedState = result[InitializationStateManager.STATE_KEY];

      if (storedState && this.validateInitializationState(storedState)) {
        this.initializationState = storedState;
      } else {
        // Initialize with default state if validation fails
        this.initializationState = { isHistoryInitialized: false };
        if (storedState) {
          this.errorManager.addError(
            'Invalid initialization state found, resetting to default'
          );
        }
      }

      this.isStateLoaded = true;
      return { ...this.initializationState };
    } catch (error) {
      const errorMsg = `Failed to load initialization state: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errorManager.addError(errorMsg);
      this.initializationState = { isHistoryInitialized: false };
      this.isStateLoaded = true;
      return { ...this.initializationState };
    }
  }

  /**
   * Saves initialization state to Chrome storage
   */
  async saveInitializationState(state: IInitializationState): Promise<void> {
    if (!this.isStorageAvailable()) {
      this.errorManager.addError(
        'Chrome storage API is not available - initialization state not saved'
      );
      return;
    }

    if (!this.validateInitializationState(state)) {
      this.errorManager.addError(
        'Invalid initialization state format - state not saved'
      );
      return;
    }

    try {
      await chrome.storage.local.set({
        [InitializationStateManager.STATE_KEY]: state,
      });

      this.initializationState = { ...state };
      this.isStateLoaded = true;
    } catch (error) {
      this.errorManager.addError(
        `Failed to save initialization state: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Determines if history initialization is needed
   */
  async isInitializationNeeded(): Promise<boolean> {
    const state = await this.loadInitializationState();

    // Don't initialize if already completed
    if (state.isHistoryInitialized) {
      return false;
    }

    // Don't initialize if permission was denied
    if (state.permissionDenied) {
      return false;
    }

    // Initialization is needed if not completed and permission not denied
    return true;
  }

  /**
   * Marks history initialization as complete
   */
  async markInitializationComplete(itemsProcessed?: number): Promise<void> {
    const currentState = await this.loadInitializationState();

    const updatedState: IInitializationState = {
      isHistoryInitialized: true,
      initializationDate: Date.now(),
      partialCompletion: false, // Clear any partial completion flag
    };

    // Only include optional properties if they have values
    if (itemsProcessed !== undefined) {
      updatedState.historyItemsProcessed = itemsProcessed;
    }

    // Preserve other optional properties from current state if they exist
    if (currentState.permissionDenied !== undefined) {
      updatedState.permissionDenied = currentState.permissionDenied;
    }
    if (currentState.lastProcessedTimestamp !== undefined) {
      updatedState.lastProcessedTimestamp = currentState.lastProcessedTimestamp;
    }

    await this.saveInitializationState(updatedState);
  }

  /**
   * Marks that history permission was denied
   */
  async markPermissionDenied(): Promise<void> {
    const currentState = await this.loadInitializationState();

    const updatedState: IInitializationState = {
      isHistoryInitialized: currentState.isHistoryInitialized,
      permissionDenied: true,
      initializationDate: Date.now(),
    };

    // Preserve other optional properties from current state if they exist
    if (currentState.historyItemsProcessed !== undefined) {
      updatedState.historyItemsProcessed = currentState.historyItemsProcessed;
    }
    if (currentState.partialCompletion !== undefined) {
      updatedState.partialCompletion = currentState.partialCompletion;
    }
    if (currentState.lastProcessedTimestamp !== undefined) {
      updatedState.lastProcessedTimestamp = currentState.lastProcessedTimestamp;
    }

    await this.saveInitializationState(updatedState);
  }

  /**
   * Marks partial completion of history initialization
   */
  async markPartialCompletion(
    itemsProcessed: number,
    lastTimestamp: number
  ): Promise<void> {
    const currentState = await this.loadInitializationState();

    const updatedState: IInitializationState = {
      isHistoryInitialized: currentState.isHistoryInitialized,
      partialCompletion: true,
      historyItemsProcessed: itemsProcessed,
      lastProcessedTimestamp: lastTimestamp,
    };

    // Preserve other optional properties from current state if they exist
    if (currentState.initializationDate !== undefined) {
      updatedState.initializationDate = currentState.initializationDate;
    }
    if (currentState.permissionDenied !== undefined) {
      updatedState.permissionDenied = currentState.permissionDenied;
    }

    await this.saveInitializationState(updatedState);
  }

  /**
   * Resets initialization state (useful for testing or re-initialization)
   */
  async resetInitializationState(): Promise<void> {
    const defaultState: IInitializationState = {
      isHistoryInitialized: false,
    };

    await this.saveInitializationState(defaultState);
  }
}
