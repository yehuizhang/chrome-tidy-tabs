import {
  IVisitStorageManager,
  VisitStorageManager,
} from './visit-storage-manager';
import {
  IErrorManager,
  errorManager as defaultErrorManager,
} from '../feature/error-manager';
import { removeUrlParams } from './utils';

// Minimal interfaces for Chrome tab events
interface TabChangeInfo {
  status?: string;
  url?: string;
}

interface TabInfo {
  url?: string;
  title?: string;
}

interface TabActiveInfo {
  tabId: number;
  windowId: number;
}

/**
 * Interface for VisitTracker functionality
 */
export interface IVisitTracker {
  startTracking(): void;
  stopTracking(): void;
  recordVisit(url: string, title?: string): Promise<void>;
  getVisitCount(url: string): number;
  isTracking(): boolean;
}

/**
 * VisitTracker - Tracks URL visits by listening to Chrome tab events
 * Integrates with VisitStorageManager for data persistence and ErrorManager for error handling
 */
export class VisitTracker implements IVisitTracker {
  private visitStorageManager: IVisitStorageManager;
  private errorManager: IErrorManager;
  private isTrackingActive = false;
  private tabUpdateListener:
    | ((tabId: number, changeInfo: TabChangeInfo, tab: TabInfo) => void)
    | null = null;
  private tabActivatedListener: ((activeInfo: TabActiveInfo) => void) | null =
    null;

  constructor(
    visitStorageManager?: IVisitStorageManager,
    errorManager?: IErrorManager
  ) {
    this.visitStorageManager = visitStorageManager || new VisitStorageManager();
    this.errorManager = errorManager || defaultErrorManager;
  }

  /**
   * Start tracking URL visits by setting up Chrome tab event listeners
   */
  startTracking(): void {
    if (this.isTrackingActive) {
      return; // Already tracking
    }

    if (!this.isChromeTabsApiAvailable()) {
      this.errorManager.addError(
        'Chrome tabs API is not available for visit tracking'
      );
      return;
    }

    try {
      // Set up tab update listener (for URL changes and page loads)
      this.tabUpdateListener = this.handleTabUpdate.bind(this);
      chrome.tabs.onUpdated.addListener(this.tabUpdateListener);

      // Set up tab activation listener (for tab switches)
      this.tabActivatedListener = this.handleTabActivated.bind(this);
      chrome.tabs.onActivated.addListener(this.tabActivatedListener);

      this.isTrackingActive = true;
    } catch (error) {
      const errorMessage = `Failed to start visit tracking: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errorManager.addError(errorMessage);
    }
  }

  /**
   * Stop tracking URL visits by removing Chrome tab event listeners
   */
  stopTracking(): void {
    if (!this.isTrackingActive) {
      return; // Not tracking
    }

    try {
      if (this.tabUpdateListener && chrome.tabs?.onUpdated) {
        chrome.tabs.onUpdated.removeListener(this.tabUpdateListener);
        this.tabUpdateListener = null;
      }

      if (this.tabActivatedListener && chrome.tabs?.onActivated) {
        chrome.tabs.onActivated.removeListener(this.tabActivatedListener);
        this.tabActivatedListener = null;
      }

      this.isTrackingActive = false;
    } catch (error) {
      const errorMessage = `Failed to stop visit tracking: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errorManager.addError(errorMessage);
    }
  }

  /**
   * Record a visit for the given URL
   * @param url - URL to record visit for
   * @param title - Optional page title
   */
  async recordVisit(url: string, title?: string): Promise<void> {
    if (!url || typeof url !== 'string') {
      return; // Skip invalid URLs silently
    }

    // Skip non-HTTP(S) URLs
    if (!this.isValidHttpUrl(url)) {
      return;
    }

    try {
      const urlWithoutParams = removeUrlParams(url);
      await this.visitStorageManager.recordVisit(urlWithoutParams, title);
    } catch (error) {
      const errorMessage = `Failed to record visit for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errorManager.addError(errorMessage);
    }
  }

  /**
   * Get the visit count for a specific URL
   * @param url - URL to get visit count for
   * @returns Visit count (0 if not found or error)
   */
  getVisitCount(url: string): number {
    if (!url || typeof url !== 'string') {
      return 0;
    }

    try {
      const urlWithoutParams = removeUrlParams(url);
      return this.visitStorageManager.getVisitCount(urlWithoutParams);
    } catch (error) {
      // Log error but don't add to error manager for this read operation
      // as it could be called frequently and spam the user
      console.warn(`Failed to get visit count for ${url}:`, error);
      return 0;
    }
  }

  /**
   * Check if visit tracking is currently active
   * @returns True if tracking is active
   */
  isTracking(): boolean {
    return this.isTrackingActive;
  }

  /**
   * Handle tab update events (URL changes, page loads)
   */
  private async handleTabUpdate(
    _tabId: number,
    changeInfo: TabChangeInfo,
    tab: TabInfo
  ): Promise<void> {
    try {
      // Only track when the tab status is 'complete' and URL is present
      if (changeInfo.status === 'complete' && tab.url) {
        await this.recordVisit(tab.url, tab.title);
      }
    } catch (error) {
      // Don't add to error manager for tab update failures as they can be frequent
      console.warn('Failed to handle tab update:', error);
    }
  }

  /**
   * Handle tab activation events (tab switches)
   */
  private async handleTabActivated(activeInfo: TabActiveInfo): Promise<void> {
    try {
      if (!chrome?.tabs?.get) {
        return; // Graceful degradation if tabs API is not available
      }

      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab.url) {
        await this.recordVisit(tab.url, tab.title);
      }
    } catch (error) {
      // Don't add to error manager for tab activation failures as they're common
      // and could spam the user with errors
      console.warn('Failed to handle tab activation:', error);
    }
  }

  /**
   * Check if Chrome tabs API is available
   */
  private isChromeTabsApiAvailable(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      chrome.tabs &&
      typeof chrome.tabs.onUpdated !== 'undefined' &&
      typeof chrome.tabs.onActivated !== 'undefined'
    );
  }

  /**
   * Check if URL is a valid HTTP/HTTPS URL
   */
  private isValidHttpUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

// Export singleton instance for convenience
export const visitTracker = new VisitTracker();
