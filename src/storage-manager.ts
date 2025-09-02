import { IClickData } from './searching/types';

export interface IStorageManager {
  loadClickData(): Promise<IClickData>;
  saveClickData(data: IClickData): Promise<void>;
  isStorageAvailable(): boolean;
}

export class StorageManager implements IStorageManager {
  private static readonly STORAGE_KEY = 'webpage_click_data';
  private static readonly STORAGE_VERSION_KEY = 'webpage_click_data_version';
  private static readonly CURRENT_VERSION = 1;

  private storageAvailable: boolean = true;
  private fallbackData: IClickData = {};

  constructor() {
    this.checkStorageAvailability();
  }

  /**
   * Check if Chrome storage is available and accessible
   */
  private checkStorageAvailability(): void {
    try {
      this.storageAvailable = !!chrome?.storage?.sync;
    } catch (error) {
      console.warn('Chrome storage not available:', error);
      this.storageAvailable = false;
    }
  }

  /**
   * Check if storage is available
   */
  public isStorageAvailable(): boolean {
    return this.storageAvailable;
  }

  /**
   * Load click data from Chrome storage with error handling and fallbacks
   */
  public async loadClickData(): Promise<IClickData> {
    if (!this.storageAvailable) {
      console.warn('Storage not available, using fallback data');
      return this.fallbackData;
    }

    try {
      const result = await chrome.storage.sync.get([
        StorageManager.STORAGE_KEY,
        StorageManager.STORAGE_VERSION_KEY,
      ]);

      // Check for version compatibility
      const version = result[StorageManager.STORAGE_VERSION_KEY] || 0;
      if (version > StorageManager.CURRENT_VERSION) {
        console.warn(
          'Storage data from newer version, resetting to avoid compatibility issues'
        );
        return {};
      }

      const clickData = result[StorageManager.STORAGE_KEY];

      if (!clickData || typeof clickData !== 'object') {
        console.info('No existing click data found, starting fresh');
        return {};
      }

      // Validate data structure
      const validatedData = this.validateClickData(clickData);
      console.info(
        `Loaded click data for ${Object.keys(validatedData).length} URLs`
      );

      return validatedData;
    } catch (error) {
      return this.handleStorageError(error, 'loadClickData');
    }
  }

  /**
   * Save click data to Chrome storage with error handling
   */
  public async saveClickData(data: IClickData): Promise<void> {
    if (!this.storageAvailable) {
      console.warn('Storage not available, saving to fallback');
      this.fallbackData = { ...data };
      return;
    }

    try {
      const dataToSave = {
        [StorageManager.STORAGE_KEY]: data,
        [StorageManager.STORAGE_VERSION_KEY]: StorageManager.CURRENT_VERSION,
      };

      await chrome.storage.sync.set(dataToSave);
      console.debug(`Saved click data for ${Object.keys(data).length} URLs`);
    } catch (error) {
      await this.handleStorageError(error, 'saveClickData', data);
    }
  }

  /**
   * Validate click data structure and clean up invalid entries
   */
  private validateClickData(data: unknown): IClickData {
    const validatedData: IClickData = {};

    if (!data || typeof data !== 'object') {
      return validatedData;
    }

    for (const [url, clickInfo] of Object.entries(data)) {
      if (this.isValidClickEntry(url, clickInfo)) {
        validatedData[url] = clickInfo as {
          count: number;
          lastClicked: number;
        };
      } else {
        console.warn(`Invalid click data entry removed: ${url}`);
      }
    }

    return validatedData;
  }

  /**
   * Validate individual click data entry
   */
  private isValidClickEntry(url: string, clickInfo: unknown): boolean {
    return (
      typeof url === 'string' &&
      url.length > 0 &&
      clickInfo !== null &&
      typeof clickInfo === 'object' &&
      'count' in clickInfo &&
      'lastClicked' in clickInfo &&
      typeof (clickInfo as { count: unknown }).count === 'number' &&
      typeof (clickInfo as { lastClicked: unknown }).lastClicked === 'number' &&
      (clickInfo as { count: number }).count >= 0 &&
      (clickInfo as { lastClicked: number }).lastClicked > 0
    );
  }

  /**
   * Handle storage errors with appropriate fallbacks
   */
  private async handleStorageError(
    error: unknown,
    operation: string,
    data?: IClickData
  ): Promise<IClickData> {
    console.warn(`Storage operation '${operation}' failed:`, error);

    // Handle specific Chrome storage errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('QUOTA_EXCEEDED')) {
      console.warn('Storage quota exceeded, attempting cleanup');
      if (data && operation === 'saveClickData') {
        await this.attemptStorageCleanup(data);
      }
      return this.fallbackData;
    }

    if (errorMessage.includes('MAX_WRITE_OPERATIONS_PER_MINUTE')) {
      console.warn('Storage write rate limit exceeded, using fallback');
      if (data) {
        this.fallbackData = { ...data };
      }
      return this.fallbackData;
    }

    // For load operations, return fallback data
    if (operation === 'loadClickData') {
      return this.fallbackData;
    }

    // For save operations, store in fallback
    if (data && operation === 'saveClickData') {
      this.fallbackData = { ...data };
    }

    return this.fallbackData;
  }

  /**
   * Attempt to clean up old storage data when quota is exceeded
   */
  private async attemptStorageCleanup(currentData: IClickData): Promise<void> {
    try {
      // Keep only the most recently clicked entries (top 80% by last clicked time)
      const entries = Object.entries(currentData);
      entries.sort((a, b) => b[1].lastClicked - a[1].lastClicked);

      const keepCount = Math.floor(entries.length * 0.8);
      const cleanedData: IClickData = {};

      for (let i = 0; i < keepCount; i++) {
        const entry = entries[i];
        if (entry) {
          const [url, clickInfo] = entry;
          cleanedData[url] = clickInfo;
        }
      }

      await chrome.storage.sync.set({
        [StorageManager.STORAGE_KEY]: cleanedData,
        [StorageManager.STORAGE_VERSION_KEY]: StorageManager.CURRENT_VERSION,
      });

      console.info(
        `Storage cleanup completed: kept ${keepCount} of ${entries.length} entries`
      );
    } catch (cleanupError) {
      console.error('Storage cleanup failed:', cleanupError);
      // If cleanup fails, disable storage and use fallback
      this.storageAvailable = false;
      this.fallbackData = currentData;
    }
  }

  /**
   * Clear all click data (useful for testing or user-requested reset)
   */
  public async clearClickData(): Promise<void> {
    if (!this.storageAvailable) {
      this.fallbackData = {};
      return;
    }

    try {
      await chrome.storage.sync.remove([
        StorageManager.STORAGE_KEY,
        StorageManager.STORAGE_VERSION_KEY,
      ]);
      console.info('Click data cleared successfully');
    } catch (error) {
      console.warn('Failed to clear click data:', error);
      this.fallbackData = {};
    }
  }

  /**
   * Get storage usage information (for debugging/monitoring)
   */
  public async getStorageInfo(): Promise<{
    bytesInUse: number;
    quotaBytes: number;
  }> {
    if (!this.storageAvailable) {
      return { bytesInUse: 0, quotaBytes: 0 };
    }

    try {
      const bytesInUse = await chrome.storage.sync.getBytesInUse(
        StorageManager.STORAGE_KEY
      );
      const quotaBytes = chrome.storage.sync.QUOTA_BYTES;
      return { bytesInUse, quotaBytes };
    } catch (error) {
      console.warn('Failed to get storage info:', error);
      return { bytesInUse: 0, quotaBytes: 0 };
    }
  }
}
