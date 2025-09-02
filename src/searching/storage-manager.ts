import { IClickData } from './types';
import { normalizeUrl } from './utils';

export interface IStorageManager {
  loadClickData(): Promise<IClickData>;
  saveClickData(data: IClickData): Promise<void>;
  isStorageAvailable(): boolean;
  recordClick(url: string): Promise<void>;
  getClickCount(url: string): number;
  getAllClickData(): IClickData;
  clearClickData(): Promise<void>;
  getStorageInfo(): Promise<{ bytesInUse: number; quotaBytes: number }>;
}

export class StorageManager implements IStorageManager {
  private static readonly STORAGE_KEY = 'tidy_tabs_click_data';
  private static readonly STORAGE_VERSION_KEY = 'tidy_tabs_click_data_version';
  private static readonly CURRENT_VERSION = 1;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000;

  private clickData: IClickData = {};
  private storageAvailable: boolean = true;
  private isLoaded: boolean = false;
  private testMode: boolean = false;

  constructor() {
    this.checkStorageAvailability();
  }

  /**
   * Enable test mode for synchronous operations
   */
  public enableTestMode(): void {
    this.testMode = true;
  }

  /**
   * Check if Chrome storage is available
   */
  private checkStorageAvailability(): void {
    try {
      this.storageAvailable = !!chrome?.storage?.sync;
    } catch (error) {
      this.logError('Chrome storage not available', String(error));
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
   * Load click data from Chrome storage with comprehensive error handling
   */
  public async loadClickData(): Promise<IClickData> {
    if (this.isLoaded) {
      return this.clickData;
    }

    if (!this.storageAvailable) {
      this.logError('Storage not available, using empty data');
      this.isLoaded = true;
      return this.clickData;
    }

    let retryCount = 0;
    while (retryCount < StorageManager.MAX_RETRIES) {
      try {
        const result = await chrome.storage.sync.get([
          StorageManager.STORAGE_KEY,
          StorageManager.STORAGE_VERSION_KEY,
        ]);

        // Check version compatibility
        const version = result[StorageManager.STORAGE_VERSION_KEY] || 0;
        if (version > StorageManager.CURRENT_VERSION) {
          this.logError('Storage data from newer version, resetting');
          this.clickData = {};
          this.isLoaded = true;
          return this.clickData;
        }

        const rawData = result[StorageManager.STORAGE_KEY];
        this.clickData = this.validateClickData(rawData || {});
        this.isLoaded = true;

        console.log(
          `Loaded click data for ${Object.keys(this.clickData).length} URLs`
        );
        return this.clickData;
      } catch (error) {
        retryCount++;
        const errorInfo = this.getErrorInfo(error);

        if (
          this.isRecoverableError(error) &&
          retryCount < StorageManager.MAX_RETRIES
        ) {
          this.logError(
            `Load attempt ${retryCount}/${StorageManager.MAX_RETRIES} failed: ${errorInfo.type}`
          );
          await this.delay(StorageManager.RETRY_DELAY * retryCount);
          continue;
        }

        this.handleStorageError(error, 'loadClickData');
        this.isLoaded = true;
        return this.clickData;
      }
    }

    this.isLoaded = true;
    return this.clickData;
  }

  /**
   * Save click data to Chrome storage with error handling
   */
  public async saveClickData(data: IClickData): Promise<void> {
    this.clickData = { ...data };

    if (!this.storageAvailable) {
      this.logError('Storage not available, data saved in memory only');
      return;
    }

    let retryCount = 0;
    while (retryCount < StorageManager.MAX_RETRIES) {
      try {
        const dataToSave = {
          [StorageManager.STORAGE_KEY]: data,
          [StorageManager.STORAGE_VERSION_KEY]: StorageManager.CURRENT_VERSION,
        };

        await chrome.storage.sync.set(dataToSave);
        console.debug(`Saved click data for ${Object.keys(data).length} URLs`);
        return;
      } catch (error) {
        retryCount++;
        const errorInfo = this.getErrorInfo(error);

        // Handle quota exceeded
        if (errorInfo.type === 'QUOTA_EXCEEDED') {
          await this.handleQuotaExceeded();
          return;
        }

        // Handle rate limits
        if (errorInfo.type.includes('RATE_LIMIT')) {
          this.logError('Storage rate limit exceeded, will retry later');
          if (retryCount < StorageManager.MAX_RETRIES) {
            await this.delay(StorageManager.RETRY_DELAY * retryCount * 2);
            continue;
          }
        }

        if (
          this.isRecoverableError(error) &&
          retryCount < StorageManager.MAX_RETRIES
        ) {
          this.logError(
            `Save attempt ${retryCount}/${StorageManager.MAX_RETRIES} failed: ${errorInfo.type}`
          );
          await this.delay(StorageManager.RETRY_DELAY * retryCount);
          continue;
        }

        await this.tryLocalStorageFallback(error);
        return;
      }
    }
  }

  /**
   * Record a click for the given URL
   */
  public async recordClick(url: string): Promise<void> {
    try {
      if (!this.isLoaded) {
        await this.loadClickData();
      }

      if (!this.storageAvailable) {
        console.debug('Storage unavailable, click not recorded');
        return;
      }

      const normalizedUrl = normalizeUrl(url);
      const now = Date.now();

      if (this.clickData[normalizedUrl]) {
        this.clickData[normalizedUrl].count++;
        this.clickData[normalizedUrl].lastClicked = now;
      } else {
        this.clickData[normalizedUrl] = {
          count: 1,
          lastClicked: now,
        };
      }

      // Save asynchronously
      if (this.testMode) {
        await this.saveClickData(this.clickData);
      } else {
        this.saveClickDataAsync();
      }
    } catch (error) {
      const errorInfo = this.getErrorInfo(error);
      this.logError(
        `Click recording failed: ${errorInfo.type}`,
        errorInfo.details
      );
    }
  }

  /**
   * Get click count for a URL
   */
  public getClickCount(url: string): number {
    if (!this.isLoaded) {
      return 0;
    }

    const normalizedUrl = normalizeUrl(url);
    return this.clickData[normalizedUrl]?.count || 0;
  }

  /**
   * Get all click data
   */
  public getAllClickData(): IClickData {
    return { ...this.clickData };
  }

  /**
   * Clear all click data
   */
  public async clearClickData(): Promise<void> {
    this.clickData = {};

    if (!this.storageAvailable) {
      return;
    }

    try {
      await chrome.storage.sync.remove([
        StorageManager.STORAGE_KEY,
        StorageManager.STORAGE_VERSION_KEY,
      ]);
      console.info('Click data cleared successfully');
    } catch (error) {
      this.logError('Failed to clear click data', String(error));
    }
  }

  /**
   * Get storage usage information
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
      this.logError('Failed to get storage info', String(error));
      return { bytesInUse: 0, quotaBytes: 0 };
    }
  }

  // Private helper methods
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
        console.debug('Invalid click data entry removed during validation');
      }
    }

    return validatedData;
  }

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
      (clickInfo as { lastClicked: number }).lastClicked > 0 &&
      Number.isFinite((clickInfo as { count: number }).count) &&
      Number.isFinite((clickInfo as { lastClicked: number }).lastClicked)
    );
  }

  private getErrorInfo(error: unknown): { type: string; details: string } {
    if (!error) {
      return { type: 'UNKNOWN', details: 'No error details available' };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('QUOTA_EXCEEDED')) {
      return { type: 'QUOTA_EXCEEDED', details: 'Storage quota exceeded' };
    }

    if (errorMessage.includes('MAX_WRITE_OPERATIONS_PER_MINUTE')) {
      return {
        type: 'RATE_LIMIT_EXCEEDED',
        details: 'Storage write rate limit exceeded',
      };
    }

    if (errorMessage.includes('MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE')) {
      return {
        type: 'SUSTAINED_RATE_LIMIT',
        details: 'Sustained write rate limit exceeded',
      };
    }

    if (errorMessage.includes('Extension context invalidated')) {
      return {
        type: 'CONTEXT_INVALIDATED',
        details: 'Extension context invalidated',
      };
    }

    const sanitizedMessage = errorMessage.replace(
      /https?:\/\/[^\s]+/g,
      '[URL]'
    );
    return { type: 'STORAGE_ERROR', details: sanitizedMessage };
  }

  private isRecoverableError(error: unknown): boolean {
    const errorInfo = this.getErrorInfo(error);
    const recoverableTypes = [
      'RATE_LIMIT_EXCEEDED',
      'SUSTAINED_RATE_LIMIT',
      'STORAGE_ERROR',
    ];
    return recoverableTypes.includes(errorInfo.type);
  }

  private async handleQuotaExceeded(): Promise<void> {
    try {
      this.logError('Storage quota exceeded, attempting cleanup');

      const entries = Object.entries(this.clickData);
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

      this.clickData = cleanedData;
      await chrome.storage.sync.set({
        [StorageManager.STORAGE_KEY]: this.clickData,
        [StorageManager.STORAGE_VERSION_KEY]: StorageManager.CURRENT_VERSION,
      });

      console.log(
        `Storage cleanup completed: kept ${keepCount} of ${entries.length} entries`
      );
    } catch (cleanupError) {
      this.logError('Storage cleanup failed, falling back to local storage');
      await this.tryLocalStorageFallback(cleanupError);
    }
  }

  private async tryLocalStorageFallback(originalError: unknown): Promise<void> {
    try {
      await chrome.storage.local.set({
        [StorageManager.STORAGE_KEY]: this.clickData,
      });
      console.log('Saved click data to local storage as fallback');
    } catch (localError) {
      const originalErrorInfo = this.getErrorInfo(originalError);
      const localErrorInfo = this.getErrorInfo(localError);
      this.logError(
        `Both sync and local storage failed. Sync: ${originalErrorInfo.type}, Local: ${localErrorInfo.type}`
      );

      if (!this.testMode) {
        this.storageAvailable = false;
      }
    }
  }

  private handleStorageError(error: unknown, operation: string): void {
    const errorInfo = this.getErrorInfo(error);
    this.logError(
      `Storage ${operation} failed: ${errorInfo.type}`,
      errorInfo.details
    );

    if (this.testMode) {
      this.storageAvailable = true;
    } else {
      this.storageAvailable = false;
      this.clickData = {};
    }
  }

  private logError(message: string, details?: string): void {
    if (this.testMode) {
      console.warn(message, details || '');
    } else {
      setTimeout(() => console.warn(message, details || ''), 0);
    }
  }

  private delay(ms: number): Promise<void> {
    if (this.testMode) {
      return Promise.resolve();
    }
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private saveClickDataAsync(): void {
    if (this.testMode) {
      return;
    }

    setTimeout(async () => {
      try {
        await this.saveClickData(this.clickData);
      } catch (error) {
        const errorInfo = this.getErrorInfo(error);
        this.logError(
          `Async save failed: ${errorInfo.type}`,
          errorInfo.details
        );
      }
    }, 0);
  }
}
