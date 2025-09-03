import { escapeHtml } from './searching/utils';

/**
 * ErrorManager - Centralized error handling with localStorage persistence
 * Manages error messages that are displayed in the extension popup
 */

export interface IErrorManager {
  addError(message: string): void;
  addHistoryInitializationError(message: string, phase?: string): void;
  addPermissionError(message: string): void;
  getErrors(): string[];
  clearErrors(): void;
  displayErrors(): void;
  initializeErrorDisplay(): void;
}

export class ErrorManager implements IErrorManager {
  private static readonly ERROR_STORAGE_KEY = 'tidy_tabs_errors';
  private errors: string[] = [];

  constructor() {
    this.loadErrorsFromStorage();
  }

  /**
   * Add a new error message to the error array and persist to localStorage
   * @param message - Error message to add
   */
  addError(message: string): void {
    if (!message || message.trim().length === 0) {
      return;
    }

    this.errors.push(message.trim());
    this.saveErrorsToStorage();
  }

  /**
   * Add a history initialization specific error with context
   * @param message - Error message to add
   * @param phase - Optional phase where the error occurred
   */
  addHistoryInitializationError(message: string, phase?: string): void {
    if (!message || message.trim().length === 0) {
      return;
    }

    const contextualMessage = phase 
      ? `History Initialization (${phase}): ${message.trim()}`
      : `History Initialization: ${message.trim()}`;
    
    this.errors.push(contextualMessage);
    this.saveErrorsToStorage();
  }

  /**
   * Add a permission-related error with specific formatting
   * @param message - Permission error message to add
   */
  addPermissionError(message: string): void {
    if (!message || message.trim().length === 0) {
      return;
    }

    const permissionMessage = `Permission Error: ${message.trim()}`;
    this.errors.push(permissionMessage);
    this.saveErrorsToStorage();
  }

  /**
   * Get all current error messages
   * @returns Array of error messages
   */
  getErrors(): string[] {
    return [...this.errors]; // Return a copy to prevent external modification
  }

  /**
   * Clear all error messages from memory and localStorage
   */
  clearErrors(): void {
    this.errors = [];
    this.removeErrorsFromStorage();
  }

  /**
   * Display all current error messages in the popup UI
   * Creates or updates the error display block
   */
  displayErrors(): void {
    const errorContainer = this.getOrCreateErrorContainer();
    
    if (this.errors.length === 0) {
      errorContainer.style.display = 'none';
      return;
    }

    errorContainer.style.display = 'block';
    errorContainer.innerHTML = this.generateErrorHTML();
  }

  /**
   * Initialize error display on popup load
   * Clears stored errors and sets up the error display
   */
  initializeErrorDisplay(): void {
    this.clearErrors();
    this.displayErrors();
  }

  /**
   * Load errors from localStorage
   */
  private loadErrorsFromStorage(): void {
    try {
      const storedErrors = localStorage.getItem(ErrorManager.ERROR_STORAGE_KEY);
      if (storedErrors) {
        const parsedErrors = JSON.parse(storedErrors);
        if (Array.isArray(parsedErrors)) {
          this.errors = parsedErrors.filter(error => typeof error === 'string');
        }
      }
    } catch {
      // If we can't load errors, start with empty array
      this.errors = [];
    }
  }

  /**
   * Save errors to localStorage
   */
  private saveErrorsToStorage(): void {
    try {
      localStorage.setItem(ErrorManager.ERROR_STORAGE_KEY, JSON.stringify(this.errors));
    } catch (error) {
      // If we can't save errors, continue without persistence
      console.warn('Failed to save errors to localStorage:', error);
    }
  }

  /**
   * Remove errors from localStorage
   */
  private removeErrorsFromStorage(): void {
    try {
      localStorage.removeItem(ErrorManager.ERROR_STORAGE_KEY);
    } catch (error) {
      // If we can't remove errors, continue silently
      console.warn('Failed to remove errors from localStorage:', error);
    }
  }

  /**
   * Get or create the error container element in the popup
   */
  private getOrCreateErrorContainer(): HTMLElement {
    let errorContainer = document.getElementById('error-container');
    
    if (!errorContainer) {
      errorContainer = document.createElement('div');
      errorContainer.id = 'error-container';
      errorContainer.className = 'error-container';
      
      // Insert at the top of the popup body
      const body = document.body;
      if (body.firstChild) {
        body.insertBefore(errorContainer, body.firstChild);
      } else {
        body.appendChild(errorContainer);
      }
    }
    
    return errorContainer;
  }

  /**
   * Generate HTML for displaying error messages
   */
  private generateErrorHTML(): string {
    if (this.errors.length === 0) {
      return '';
    }

    const errorItems = this.errors
      .map(error => `<div class="error-item">${escapeHtml(error)}</div>`)
      .join('');

    return `
      <div class="error-header">
        <span class="error-title">Extension Errors:</span>
      </div>
      <div class="error-list">
        ${errorItems}
      </div>
    `;
  }


}

// Export singleton instance
export const errorManager = new ErrorManager();