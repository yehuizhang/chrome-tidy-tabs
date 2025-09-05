import {
  IVisitData,
  IHistoryInitializationProgress,
  IProgressCallback,
  IHistoryInitializationResult,
} from '../types';
import {
  IVisitStorageManager,
  VisitStorageManager,
} from './visit-storage-manager';
import {
  IInitializationStateManager,
  InitializationStateManager,
} from './initialization-state-manager';

import {
  IErrorManager,
  errorManager as defaultErrorManager,
} from '../feature/error-manager';
import { removeUrlParams } from './utils';

export interface IHistoryInitializer {
  initialize(
    progressCallback?: IProgressCallback
  ): Promise<IHistoryInitializationResult>;
  isInitializationNeeded(): Promise<boolean>;
  processHistoryItems(
    items: chrome.history.HistoryItem[],
    progressCallback?: IProgressCallback
  ): Promise<IVisitData>;
  markInitializationComplete(): Promise<void>;
}

export interface IHistoryInitializerConfig {
  maxHistoryItems?: number;
  batchSize?: number;
  maxAge?: number; // Maximum age in days for history items to process
}

export class HistoryInitializer implements IHistoryInitializer {
  private static readonly DEFAULT_CONFIG: Required<IHistoryInitializerConfig> =
    {
      maxHistoryItems: 10000,
      batchSize: 1000,
      maxAge: 365, // 1 year
    };

  private visitStorageManager: IVisitStorageManager;
  private initializationStateManager: IInitializationStateManager;

  private errorManager: IErrorManager;
  private config: Required<IHistoryInitializerConfig>;

  constructor(
    visitStorageManager?: IVisitStorageManager,
    initializationStateManager?: IInitializationStateManager,
    errorManager?: IErrorManager,
    config?: IHistoryInitializerConfig
  ) {
    this.visitStorageManager = visitStorageManager || new VisitStorageManager();
    this.initializationStateManager =
      initializationStateManager || new InitializationStateManager();
    this.errorManager = errorManager || defaultErrorManager;
    this.config = { ...HistoryInitializer.DEFAULT_CONFIG, ...config };
  }

  /**
   * Main initialization method that orchestrates the entire history initialization process
   */
  async initialize(
    progressCallback?: IProgressCallback
  ): Promise<IHistoryInitializationResult> {
    const startTime = Date.now();
    let processedItems = 0;
    let uniqueUrls = 0;
    const skippedItems = 0;

    try {
      // Phase 1: Check if initialization is needed
      this.reportProgress(progressCallback, {
        phase: 'checking',
        message: 'Checking if history initialization is needed...',
        startTime,
      });

      if (!(await this.isInitializationNeeded())) {
        this.reportProgress(progressCallback, {
          phase: 'complete',
          message: 'History initialization not needed - already completed',
          startTime,
        });
        return {
          success: true,
          itemsProcessed: 0,
          uniqueUrls: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Phase 2: Check Chrome history API availability
      if (!this.isChromeHistoryApiAvailable()) {
        const errorMessage =
          'Chrome history API is not available - skipping history initialization';
        this.errorManager.addHistoryInitializationError(
          errorMessage,
          'api_check'
        );
        this.reportProgress(progressCallback, {
          phase: 'error',
          error: errorMessage,
          startTime,
        });
        return {
          success: false,
          error: errorMessage,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Phase 3: Read Chrome history
      this.reportProgress(progressCallback, {
        phase: 'reading_history',
        message: 'Reading Chrome browsing history...',
        startTime,
      });

      const historyItems = await this.readChromeHistory();

      if (historyItems.length === 0) {
        const message = 'No history items found to process';
        this.reportProgress(progressCallback, {
          phase: 'complete',
          message,
          startTime,
        });
        await this.markInitializationComplete();
        return {
          success: true,
          itemsProcessed: 0,
          uniqueUrls: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Phase 4: Process history items
      this.reportProgress(progressCallback, {
        phase: 'processing',
        totalItems: historyItems.length,
        processedItems: 0,
        message: `Processing ${historyItems.length} history items...`,
        startTime,
      });

      const processedData = await this.processHistoryItems(
        historyItems,
        progressCallback
      );
      processedItems = historyItems.length;
      uniqueUrls = Object.keys(processedData).length;

      // Phase 5: Save processed data
      this.reportProgress(progressCallback, {
        phase: 'saving',
        totalItems: historyItems.length,
        processedItems,
        message: `Saving ${uniqueUrls} unique URLs to storage...`,
        startTime,
      });

      await this.integrateAndSaveHistoryData(processedData);

      // Phase 6: Mark as complete
      await this.markInitializationComplete();

      const processingTimeMs = Date.now() - startTime;
      const successMessage = `History initialization completed successfully. Processed ${processedItems} items into ${uniqueUrls} unique URLs in ${Math.round(processingTimeMs / 1000)}s.`;

      this.reportProgress(progressCallback, {
        phase: 'complete',
        totalItems: historyItems.length,
        processedItems,
        message: successMessage,
        startTime,
      });

      console.log(successMessage);

      return {
        success: true,
        itemsProcessed: processedItems,
        uniqueUrls,
        skippedItems,
        processingTimeMs,
      };
    } catch (error) {
      const errorMessage = `History initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errorManager.addHistoryInitializationError(errorMessage, 'general');

      const errorProgress: IHistoryInitializationProgress = {
        phase: 'error',
        error: errorMessage,
        startTime,
      };

      if (processedItems > 0) {
        errorProgress.totalItems = processedItems;
        errorProgress.processedItems = processedItems;
      }

      this.reportProgress(progressCallback, errorProgress);

      // Mark as failed so it can be retried later
      await this.initializationStateManager.markPartialCompletion(
        processedItems,
        Date.now()
      );

      return {
        success: false,
        error: errorMessage,
        itemsProcessed: processedItems,
        uniqueUrls,
        skippedItems,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Checks if history initialization is needed
   */
  async isInitializationNeeded(): Promise<boolean> {
    return await this.initializationStateManager.isInitializationNeeded();
  }

  /**
   * Processes Chrome history items and converts them to visit data format
   * Implements visit count aggregation for duplicate URLs with enhanced error handling
   */
  async processHistoryItems(
    items: chrome.history.HistoryItem[],
    progressCallback?: IProgressCallback
  ): Promise<IVisitData> {
    const visitData: IVisitData = {};
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    const totalBatches = Math.ceil(items.length / this.config.batchSize);

    // Process items in batches to avoid blocking
    for (let i = 0; i < items.length; i += this.config.batchSize) {
      const batch = items.slice(i, i + this.config.batchSize);
      const currentBatch = Math.floor(i / this.config.batchSize) + 1;

      for (const item of batch) {
        try {
          // Skip items without URL
          if (!item.url) {
            skippedCount++;
            continue;
          }

          // Skip non-HTTP(S) URLs
          if (!this.isValidHttpUrl(item.url)) {
            skippedCount++;
            continue;
          }

          // Skip items that are too old
          if (item.lastVisitTime && this.isItemTooOld(item.lastVisitTime)) {
            skippedCount++;
            continue;
          }

          const normalizedUrl = this.normalizeUrl(removeUrlParams(item.url));
          const visitCount = Math.max(1, item.visitCount || 1); // Ensure minimum count of 1
          const lastVisited = item.lastVisitTime || Date.now();
          const title = item.title || '';

          // Aggregate visit data for duplicate URLs
          if (visitData[normalizedUrl]) {
            // Add visit counts
            visitData[normalizedUrl].count += visitCount;

            // Keep the most recent visit time and associated title
            if (lastVisited > visitData[normalizedUrl].lastVisited) {
              visitData[normalizedUrl].lastVisited = lastVisited;
              // Update title with the most recent one if it's not empty
              if (title.trim()) {
                visitData[normalizedUrl].title = title;
              }
            }
          } else {
            visitData[normalizedUrl] = {
              count: visitCount,
              lastVisited: lastVisited,
              title: title,
            };
          }

          processedCount++;
        } catch (error) {
          errorCount++;
          // Log individual item processing errors but continue
          console.warn(`Failed to process history item ${item.url}:`, error);

          // If too many errors, add to error manager
          if (errorCount > 100) {
            const errorMessage = `High error rate during history processing: ${errorCount} errors out of ${processedCount + errorCount + skippedCount} items`;
            this.errorManager.addHistoryInitializationError(
              errorMessage,
              'processing'
            );
            errorCount = 0; // Reset counter to avoid spam
          }
        }
      }

      // Report progress after each batch
      const totalProcessed = i + batch.length;
      const progressPercent = Math.round((totalProcessed / items.length) * 100);
      const elapsedTime = Date.now() - startTime;
      const estimatedTimeRemaining =
        totalProcessed > 0
          ? Math.round(
              (elapsedTime / totalProcessed) * (items.length - totalProcessed)
            )
          : undefined;

      const progressUpdate: IHistoryInitializationProgress = {
        phase: 'processing',
        totalItems: items.length,
        processedItems: totalProcessed,
        currentBatch,
        totalBatches,
        message: `Processing batch ${currentBatch}/${totalBatches} (${progressPercent}% complete)`,
        startTime,
      };

      if (estimatedTimeRemaining !== undefined) {
        progressUpdate.estimatedTimeRemaining = estimatedTimeRemaining;
      }

      this.reportProgress(progressCallback, progressUpdate);

      // Yield control periodically to prevent blocking
      if (i % (this.config.batchSize * 5) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Log final processing statistics
    const finalMessage = `History processing completed: ${processedCount} processed, ${skippedCount} skipped, ${errorCount} errors. Resulted in ${Object.keys(visitData).length} unique URLs.`;
    console.log(finalMessage);

    // Report final processing progress
    this.reportProgress(progressCallback, {
      phase: 'processing',
      totalItems: items.length,
      processedItems: items.length,
      currentBatch: totalBatches,
      totalBatches,
      message: finalMessage,
      startTime,
    });

    // Validate the processed data before returning
    this.validateProcessedData(visitData);

    return visitData;
  }

  /**
   * Validates processed visit data to ensure data integrity
   */
  private validateProcessedData(data: IVisitData): void {
    let invalidEntries = 0;

    for (const [url, visitInfo] of Object.entries(data)) {
      // Check for invalid visit counts
      if (visitInfo.count <= 0 || !Number.isInteger(visitInfo.count)) {
        console.warn(`Invalid visit count for ${url}: ${visitInfo.count}`);
        invalidEntries++;
      }

      // Check for invalid timestamps
      if (visitInfo.lastVisited <= 0 || visitInfo.lastVisited > Date.now()) {
        console.warn(`Invalid timestamp for ${url}: ${visitInfo.lastVisited}`);
        invalidEntries++;
      }

      // Check for invalid URL format
      if (!url || typeof url !== 'string' || url.trim().length === 0) {
        console.warn(`Invalid URL key: ${url}`);
        invalidEntries++;
      }
    }

    if (invalidEntries > 0) {
      this.errorManager.addHistoryInitializationError(
        `Found ${invalidEntries} invalid entries in processed history data`,
        'validation'
      );
    }
  }

  /**
   * Integrates history data with existing visit data and saves to storage
   * This method implements data replacement logic to overwrite existing visit data
   * with history-derived counts while handling storage errors and quota management
   */
  async integrateAndSaveHistoryData(historyData: IVisitData): Promise<void> {
    try {
      // Load existing visit data to check for conflicts
      const existingData = await this.visitStorageManager.loadVisitData();

      // Create integrated data by replacing existing data with history-derived data
      // History data takes precedence as it represents the complete browsing history
      const integratedData: IVisitData = { ...existingData };

      // Replace existing visit data with history-derived counts
      for (const [url, historyVisit] of Object.entries(historyData)) {
        integratedData[url] = {
          count: historyVisit.count,
          lastVisited: historyVisit.lastVisited,
          title: historyVisit.title || existingData[url]?.title || '',
        };
      }

      // Save the integrated data with error handling and quota management
      await this.saveWithRetry(integratedData);

      console.log(
        `Integrated ${Object.keys(historyData).length} history URLs with existing visit data. ` +
          `Total URLs in storage: ${Object.keys(integratedData).length}`
      );
    } catch (error) {
      const errorMessage = `Failed to integrate history data with existing visit data: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errorManager.addHistoryInitializationError(
        errorMessage,
        'integration'
      );
      throw error; // Re-throw to be handled by the main initialize method
    }
  }

  /**
   * Saves visit data with retry logic for quota management
   */
  private async saveWithRetry(
    data: IVisitData,
    maxRetries: number = 2
  ): Promise<void> {
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        await this.visitStorageManager.saveVisitData(data);
        return; // Success, exit retry loop
      } catch (error) {
        retryCount++;

        // Check if it's a quota exceeded error
        if (error instanceof Error && error.message.includes('QUOTA_BYTES')) {
          if (retryCount <= maxRetries) {
            // Try to reduce data size by removing oldest entries
            const reducedData = await this.reduceDataForQuota(data);
            data = reducedData;

            this.errorManager.addHistoryInitializationError(
              `Storage quota exceeded during history initialization. Reduced data size and retrying (attempt ${retryCount}/${maxRetries + 1})`,
              'storage'
            );
          } else {
            throw new Error(
              `Storage quota exceeded after ${maxRetries + 1} attempts. Unable to save history data.`
            );
          }
        } else {
          // For non-quota errors, don't retry
          throw error;
        }
      }
    }
  }

  /**
   * Reduces data size for quota management by removing oldest entries
   * Removes 30% of the oldest entries to make room for new data
   */
  private async reduceDataForQuota(data: IVisitData): Promise<IVisitData> {
    const entries = Object.entries(data);

    if (entries.length === 0) {
      return data;
    }

    // Sort by lastVisited timestamp (oldest first)
    entries.sort(([, a], [, b]) => a.lastVisited - b.lastVisited);

    // Remove oldest 30% of entries
    const entriesToRemove = Math.max(1, Math.floor(entries.length * 0.3));
    const entriesToKeep = entries.slice(entriesToRemove);

    // Rebuild visit data with remaining entries
    const reducedData: IVisitData = {};
    for (const [url, visitData] of entriesToKeep) {
      reducedData[url] = visitData;
    }

    console.log(
      `Reduced history data from ${entries.length} to ${entriesToKeep.length} entries due to storage quota constraints`
    );

    return reducedData;
  }

  /**
   * Marks history initialization as complete
   */
  async markInitializationComplete(): Promise<void> {
    const visitData = this.visitStorageManager.getAllVisitData();
    const itemsProcessed = Object.keys(visitData).length;
    await this.initializationStateManager.markInitializationComplete(
      itemsProcessed
    );
  }

  /**
   * Reads Chrome history using the history API
   */
  private async readChromeHistory(): Promise<chrome.history.HistoryItem[]> {
    try {
      const maxAge = this.config.maxAge * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      const startTime = Date.now() - maxAge;

      const historyItems = await chrome.history.search({
        text: '', // Empty text to get all items
        startTime: startTime,
        maxResults: this.config.maxHistoryItems,
      });

      return historyItems || [];
    } catch (error) {
      throw new Error(
        `Failed to read Chrome history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Checks if Chrome history API is available
   */
  private isChromeHistoryApiAvailable(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      chrome.history &&
      typeof chrome.history.search === 'function'
    );
  }

  /**
   * Checks if URL is a valid HTTP/HTTPS URL
   */
  private isValidHttpUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Checks if a history item is too old based on configuration
   */
  private isItemTooOld(lastVisitTime: number): boolean {
    const maxAge = this.config.maxAge * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    const cutoffTime = Date.now() - maxAge;
    return lastVisitTime < cutoffTime;
  }

  /**
   * Normalizes URL using the same logic as VisitStorageManager
   * This ensures consistency between history-derived and real-time visit data
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
   * Reports progress to the callback if provided
   */
  private reportProgress(
    progressCallback: IProgressCallback | undefined,
    progress: IHistoryInitializationProgress
  ): void {
    if (progressCallback) {
      try {
        progressCallback(progress);
      } catch (error) {
        // Don't let progress callback errors break the initialization
        console.warn('Progress callback error:', error);
      }
    }
  }
}
