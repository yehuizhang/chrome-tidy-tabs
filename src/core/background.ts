import { visitTracker } from '../searching/visit-tracker';
import { errorManager } from '../error-manager';
import { HistoryInitializer } from '../searching/history-initializer';

/**
 * Background script for automatic URL visit tracking and history initialization
 * Initializes history data on first run, then starts real-time visit tracking
 */
class BackgroundVisitTracker {
  private historyInitializer: HistoryInitializer;

  constructor() {
    this.historyInitializer = new HistoryInitializer();
    this.initializeExtension();
  }

  /**
   * Initialize the extension with history initialization and visit tracking
   */
  private async initializeExtension(): Promise<void> {
    try {
      console.log('Starting extension initialization...');

      // Check if Chrome APIs are available
      if (!chrome?.tabs) {
        throw new Error('Chrome tabs API is not available');
      }

      // Step 1: Initialize history data if needed
      await this.initializeHistoryData();

      // Step 2: Start real-time visit tracking
      await this.initializeVisitTracking();

      console.log('Extension initialization completed successfully');
    } catch (error) {
      const errorMsg = `Failed to initialize extension: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errorManager.addError(errorMsg);

      // Implement graceful degradation - try to start visit tracking even if history init fails
      console.warn(
        'Attempting to start visit tracking despite initialization errors...'
      );
      try {
        await this.initializeVisitTracking();
      } catch (trackingError) {
        console.error(
          'Failed to start visit tracking as fallback:',
          trackingError
        );
        errorManager.addError(
          `Fallback visit tracking failed: ${trackingError instanceof Error ? trackingError.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Initialize history data on first run
   */
  private async initializeHistoryData(): Promise<void> {
    try {
      console.log('Checking if history initialization is needed...');

      // Check if initialization is needed
      const initNeeded = await this.historyInitializer.isInitializationNeeded();

      if (!initNeeded) {
        console.log('History initialization not needed - skipping');
        return;
      }

      console.log('Starting history initialization...');

      // Perform history initialization with progress tracking
      const result = await this.historyInitializer.initialize(progress => {
        // Log progress updates for debugging
        const message = progress.message || `Phase: ${progress.phase}`;
        console.log(`History Init Progress: ${message}`);

        if (
          progress.phase === 'processing' &&
          progress.processedItems &&
          progress.totalItems
        ) {
          const percent = Math.round(
            (progress.processedItems / progress.totalItems) * 100
          );
          console.log(
            `Processing: ${percent}% (${progress.processedItems}/${progress.totalItems})`
          );
        }

        if (progress.error) {
          console.error(`History Init Error: ${progress.error}`);
        }
      });

      if (result.success) {
        console.log(
          `History initialization completed successfully: ${result.itemsProcessed} items processed into ${result.uniqueUrls} unique URLs`
        );
      } else {
        const errorMsg = `History initialization failed: ${result.error}`;
        console.error(errorMsg);
        errorManager.addError(errorMsg);
      }
    } catch (error) {
      const errorMsg = `History initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errorManager.addError(errorMsg);

      // Don't throw - allow visit tracking to continue even if history init fails
      console.warn(
        'Continuing with real-time visit tracking despite history initialization failure'
      );
    }
  }

  /**
   * Initialize real-time visit tracking
   */
  private async initializeVisitTracking(): Promise<void> {
    try {
      console.log('Starting visit tracking...');

      // Start visit tracking
      visitTracker.startTracking();

      // Verify tracking started successfully
      if (!visitTracker.isTracking()) {
        throw new Error('Visit tracking failed to start');
      }

      console.log('Visit tracking initialized successfully');
    } catch (error) {
      const errorMsg = `Failed to initialize visit tracking: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errorManager.addError(errorMsg);

      // This is a more critical failure - log warning but don't throw
      console.warn('Extension will continue without automatic visit tracking');
    }
  }

  /**
   * Get the history initializer instance (for testing)
   */
  getHistoryInitializer(): HistoryInitializer {
    return this.historyInitializer;
  }
}

// Initialize the background visit tracker when the script loads
let backgroundTracker: BackgroundVisitTracker | undefined;

// Auto-initialize the background tracker
try {
  backgroundTracker = new BackgroundVisitTracker();
} catch (error) {
  console.error('Failed to initialize background visit tracker:', error);
  errorManager.addError(
    `Background script initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  );
}

// Export for testing
export { BackgroundVisitTracker, backgroundTracker };
