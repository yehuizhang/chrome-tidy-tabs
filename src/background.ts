import { visitTracker } from './searching/visit-tracker';
import { errorManager } from './error-manager';

/**
 * Background script for automatic URL visit tracking
 * Initializes visit tracking when the extension starts
 */
class BackgroundVisitTracker {
  constructor() {
    this.initializeVisitTracking();
  }

  /**
   * Initialize visit tracking on extension startup
   */
  private initializeVisitTracking(): void {
    try {
      // Check if Chrome APIs are available
      if (!chrome?.tabs) {
        throw new Error('Chrome tabs API is not available');
      }

      // Start visit tracking immediately
      visitTracker.startTracking();
      
      console.log('Visit tracking initialized successfully');
    } catch (error) {
      const errorMsg = `Failed to initialize visit tracking: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errorManager.addError(errorMsg);
      
      // Implement graceful degradation - continue without visit tracking
      console.warn('Extension will continue without automatic visit tracking');
    }
  }
}

// Initialize the background visit tracker when the script loads
try {
  new BackgroundVisitTracker();
} catch (error) {
  console.error('Failed to initialize background visit tracker:', error);
  errorManager.addError(`Background script initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
}