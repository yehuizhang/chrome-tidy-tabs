import { IVisitData } from './types.js';
import {
  IErrorManager,
  errorManager as defaultErrorManager,
} from '../error-manager';

export interface IVisitStorageManager {
  loadVisitData(): Promise<IVisitData>;
  saveVisitData(data: IVisitData): Promise<void>;
  recordVisit(url: string, title?: string): Promise<void>;
  getVisitCount(url: string): number;
  getAllVisitData(): IVisitData;
  clearVisitData(): Promise<void>;
  isStorageAvailable(): boolean;
}

export class VisitStorageManager implements IVisitStorageManager {
  private static readonly VISIT_DATA_KEY = 'y_nav_visit_data';

  private visitData: IVisitData = {};
  private isDataLoaded = false;
  private errorManager: IErrorManager;

  constructor(errorManager?: IErrorManager) {
    this.errorManager = errorManager || defaultErrorManager;
    this.loadVisitData().catch(error => {
      this.errorManager.addError(
        `Failed to initialize visit storage: ${error.message}`
      );
    });
  }

  /**
   * Checks if Chrome storage API is available
   */
  isStorageAvailable(): boolean {
    try {
      return (
        typeof chrome !== 'undefined' &&
        chrome.storage &&
        chrome.storage.local !== undefined
      );
    } catch {
      this.errorManager.addError('Chrome storage API is not available');
      return false;
    }
  }

  /**
   * Normalizes URL by removing protocol, www, and trailing slashes
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      let normalized = urlObj.hostname + urlObj.pathname;

      // Remove www prefix
      if (normalized.startsWith('www.')) {
        normalized = normalized.substring(4);
      }

      // Remove trailing slash
      if (normalized.endsWith('/') && normalized.length > 1) {
        normalized = normalized.slice(0, -1);
      }

      return normalized.toLowerCase();
    } catch {
      // If URL parsing fails, return the original URL cleaned up
      return url
        .replace(/^https?:\/\/(www\.)?/, '')
        .replace(/\/$/, '')
        .toLowerCase();
    }
  }

  /**
   * Loads visit data from Chrome storage
   */
  async loadVisitData(): Promise<IVisitData> {
    if (!this.isStorageAvailable()) {
      const errorMsg =
        'Chrome storage API is not available - visit tracking disabled';
      this.errorManager.addError(errorMsg);
      this.visitData = {};
      this.isDataLoaded = true;
      return { ...this.visitData };
    }

    try {
      const result = await chrome.storage.local.get([
        VisitStorageManager.VISIT_DATA_KEY,
      ]);

      const storedData = result[
        VisitStorageManager.VISIT_DATA_KEY
      ] as IVisitData;

      if (storedData) {
        this.visitData = storedData;
      } else {
        // Initialize with empty data if validation fails
        this.visitData = {};
        if (storedData) {
          this.errorManager.addError(
            'Invalid visit data found, resetting to empty data'
          );
        }
      }

      this.isDataLoaded = true;
      return { ...this.visitData };
    } catch (error) {
      const errorMsg = `Failed to load visit data: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errorManager.addError(errorMsg);
      this.visitData = {};
      this.isDataLoaded = true;
      return { ...this.visitData };
    }
  }

  /**
   * Saves visit data to Chrome storage
   */
  async saveVisitData(data: IVisitData): Promise<void> {
    try {
      await chrome.storage.local.set({
        [VisitStorageManager.VISIT_DATA_KEY]: data,
      });

      this.visitData = { ...data };
    } catch (error) {
      // Check if it's a quota exceeded error
      if (error instanceof Error && error.message.includes('QUOTA_BYTES')) {
        try {
          await this.cleanupOldData();
          // Retry save after cleanup
          await chrome.storage.local.set({
            [VisitStorageManager.VISIT_DATA_KEY]: data,
          });
          this.visitData = { ...data };
          this.errorManager.addError(
            'Storage quota exceeded - cleaned up old data and retried'
          );
        } catch (retryError) {
          this.errorManager.addError(
            `Storage quota exceeded and cleanup failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`
          );
        }
      } else {
        this.errorManager.addError(
          `Failed to save visit data: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  } /**
   
* Records a visit for the given URL
   */
  async recordVisit(url: string, title?: string): Promise<void> {
    if (!url || typeof url !== 'string') {
      return; // Graceful degradation - skip invalid URLs silently
    }

    try {
      // Ensure data is loaded
      if (!this.isDataLoaded) {
        await this.loadVisitData();
      }

      const normalizedUrl = this.normalizeUrl(url);
      const now = Date.now();

      // Update visit data
      if (this.visitData[normalizedUrl]) {
        this.visitData[normalizedUrl].count++;
        this.visitData[normalizedUrl].lastVisited = now;
        if (title) {
          this.visitData[normalizedUrl].title = title;
        }

        if (url !== normalizedUrl) {
          this.visitData[normalizedUrl].originalUrl = url;
        } else if (this.visitData[normalizedUrl].originalUrl !== undefined) {
          delete this.visitData[normalizedUrl].originalUrl;
        }
      } else {
        const visitInfo: IVisitData[string] = {
          count: 1,
          lastVisited: now,
          title: title || '',
        };
        if (url !== normalizedUrl) {
          visitInfo.originalUrl = url;
        }

        this.visitData[normalizedUrl] = visitInfo;
      }

      // Save updated data
      await this.saveVisitData(this.visitData);
    } catch (error) {
      // Don't add to error manager for individual visit recording failures
      // as they can be frequent and would spam the user
      console.warn(`Failed to record visit for ${url}:`, error);
    }
  }

  /**
   * Gets the visit count for a specific URL
   */
  getVisitCount(url: string): number {
    if (!url || typeof url !== 'string') {
      return 0;
    }

    const normalizedUrl = this.normalizeUrl(url);
    return this.visitData[normalizedUrl]?.count || 0;
  }

  /**
   * Returns all visit data
   */
  getAllVisitData(): IVisitData {
    return { ...this.visitData };
  }

  /**
   * Clears all visit data
   */
  async clearVisitData(): Promise<void> {
    if (!this.isStorageAvailable()) {
      this.errorManager.addError(
        'Chrome storage API is not available - cannot clear visit data'
      );
      return;
    }

    try {
      await chrome.storage.local.remove([VisitStorageManager.VISIT_DATA_KEY]);

      this.visitData = {};
    } catch (error) {
      this.errorManager.addError(
        `Failed to clear visit data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Cleans up old data when storage quota is exceeded
   * Removes the oldest 20% of entries
   */
  private async cleanupOldData(): Promise<void> {
    const entries = Object.entries(this.visitData);

    if (entries.length === 0) {
      return;
    }

    // Sort by lastVisited timestamp (oldest first)
    entries.sort(([, a], [, b]) => a.lastVisited - b.lastVisited);

    // Remove oldest 20% of entries
    const entriesToRemove = Math.max(1, Math.floor(entries.length * 0.2));
    const entriesToKeep = entries.slice(entriesToRemove);

    // Rebuild visit data with remaining entries
    const cleanedData: IVisitData = {};
    for (const [url, data] of entriesToKeep) {
      cleanedData[url] = data;
    }

    this.visitData = cleanedData;
    console.log(
      `Cleaned up ${entriesToRemove} old visit entries due to storage quota`
    );
  }
}
