import { Searching } from './searching/searching';
import { TabManagement } from './tab_management';
import { errorManager } from './error-manager';

class Popup {
  constructor() {
    try {
      // Initialize error display and clear any stored errors
      errorManager.initializeErrorDisplay();
      
      // Check if Chrome storage is available for graceful degradation
      this.checkStorageAvailability();
      
      // Initialize components with error handling
      this.initializeComponents();
    } catch (error) {
      const errorMsg = `Failed to initialize popup: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errorManager.addError(errorMsg);
      
      // Show error in UI
      this.showCriticalError('Extension failed to initialize. Please reload the extension.');
    }
  }

  private checkStorageAvailability(): void {
    try {
      if (!chrome?.storage?.local) {
        errorManager.addError('Chrome storage API is not available - some features may not work properly');
        console.warn('Chrome storage API not available, extension will run with limited functionality');
      }
    } catch {
      errorManager.addError('Failed to check storage availability - some features may not work properly');
    }
  }

  private initializeComponents(): void {
    try {
      new TabManagement();
    } catch (error) {
      const errorMsg = `Failed to initialize tab management: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errorManager.addError(errorMsg);
    }

    try {
      new Searching(errorManager);
    } catch (error) {
      const errorMsg = `Failed to initialize search functionality: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errorManager.addError(errorMsg);
      
      // Show fallback UI if search fails to initialize
      this.showSearchFallback();
    }
  }

  private showCriticalError(message: string): void {
    try {
      const body = document.body;
      if (body) {
        body.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #d32f2f;">
            <h3>Extension Error</h3>
            <p>${message}</p>
            <button onclick="chrome.runtime.reload()" style="margin-top: 10px; padding: 8px 16px;">
              Reload Extension
            </button>
          </div>
        `;
      }
    } catch (error) {
      console.error('Failed to show critical error UI:', error);
    }
  }

  private showSearchFallback(): void {
    try {
      const searchResult = document.getElementById('search-result');
      if (searchResult) {
        searchResult.innerHTML = `
          <div class="no-results" style="padding: 20px; text-align: center;">
            Search functionality is temporarily unavailable.
            <br>
            <small>You can still use the tab management features above.</small>
          </div>
        `;
      }
    } catch (error) {
      console.error('Failed to show search fallback UI:', error);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    new Popup();
  } catch (error) {
    console.error('Failed to initialize popup on DOMContentLoaded:', error);
    // Last resort error handling
    try {
      errorManager.addError(`Critical initialization failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorManager.displayErrors();
    } catch (displayError) {
      console.error('Failed to display errors:', displayError);
    }
  }
});
