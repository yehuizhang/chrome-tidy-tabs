import { IHistoryInitializationProgress } from './types';

// Local HTML escaping function with fallback for test environments
const escapeHtml = (text: string): string => {
  if (!text) return '';

  try {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  } catch {
    // Fallback for test environments
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

/**
 * ProgressDisplayManager - Manages the display of history initialization progress in the popup
 */
export interface IProgressDisplayManager {
  showProgress(progress: IHistoryInitializationProgress): void;
  hideProgress(): void;
  isProgressVisible(): boolean;
  initializeProgressDisplay(): void;
}

export class ProgressDisplayManager implements IProgressDisplayManager {
  private progressContainer: HTMLElement | null = null;
  private isVisible = false;

  /**
   * Initialize the progress display on popup load
   */
  initializeProgressDisplay(): void {
    this.createProgressContainer();
    this.hideProgress(); // Start hidden
  }

  /**
   * Show progress information in the popup
   */
  showProgress(progress: IHistoryInitializationProgress): void {
    if (!this.progressContainer) {
      this.createProgressContainer();
    }

    this.isVisible = true;
    this.progressContainer!.style.display = 'block';
    this.progressContainer!.innerHTML = this.generateProgressHTML(progress);
  }

  /**
   * Hide the progress display
   */
  hideProgress(): void {
    if (this.progressContainer) {
      this.progressContainer.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * Check if progress is currently visible
   */
  isProgressVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Create or get the progress container element
   */
  private createProgressContainer(): void {
    if (this.progressContainer) {
      return;
    }

    this.progressContainer = document.getElementById('progress-container');

    if (!this.progressContainer) {
      this.progressContainer = document.createElement('div');
      this.progressContainer.id = 'progress-container';
      this.progressContainer.className = 'progress-container';

      // Insert after the tab tooling container but before search
      const tabToolingContainer = document.querySelector(
        '.tab-tooling-container'
      );
      const searchContainer = document.querySelector('.search-container');

      if (tabToolingContainer && searchContainer) {
        tabToolingContainer.parentNode?.insertBefore(
          this.progressContainer,
          searchContainer
        );
      } else {
        // Fallback: insert at the top of the body
        const body = document.body;
        if (body.firstChild) {
          body.insertBefore(this.progressContainer, body.firstChild);
        } else {
          body.appendChild(this.progressContainer);
        }
      }
    }
  }

  /**
   * Generate HTML for displaying progress information
   */
  private generateProgressHTML(
    progress: IHistoryInitializationProgress
  ): string {
    const {
      phase,
      message,
      error,
      totalItems,
      processedItems,
      currentBatch,
      totalBatches,
      estimatedTimeRemaining,
    } = progress;

    // Handle error state
    if (phase === 'error' && error) {
      const escapedError = escapeHtml(error);
      return `
        <div class="progress-header error">
          <span class="progress-title">History Initialization Error</span>
        </div>
        <div class="progress-content">
          <div class="error-message">${escapedError}</div>
        </div>
      `;
    }

    // Handle completion state
    if (phase === 'complete') {
      const successMessage = message || 'Initialization completed successfully';
      const escapedMessage = escapeHtml(successMessage);
      return `
        <div class="progress-header success">
          <span class="progress-title">History Initialization Complete</span>
        </div>
        <div class="progress-content">
          <div class="success-message">${escapedMessage}</div>
        </div>
      `;
    }

    // Handle active progress states
    let progressBar = '';
    let progressText = '';
    let timeEstimate = '';

    if (totalItems && processedItems !== undefined) {
      const percentage = Math.round((processedItems / totalItems) * 100);
      progressBar = `
        <div class="progress-bar-container">
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width: ${percentage}%"></div>
          </div>
          <div class="progress-percentage">${percentage}%</div>
        </div>
      `;
      progressText = `<div class="progress-text">${processedItems.toLocaleString()} / ${totalItems.toLocaleString()} items</div>`;
    }

    if (currentBatch && totalBatches) {
      progressText += `<div class="batch-info">Batch ${currentBatch} of ${totalBatches}</div>`;
    }

    if (estimatedTimeRemaining && estimatedTimeRemaining > 1000) {
      const seconds = Math.round(estimatedTimeRemaining / 1000);
      const timeText =
        seconds > 60
          ? `${Math.round(seconds / 60)}m ${seconds % 60}s`
          : `${seconds}s`;
      timeEstimate = `<div class="time-estimate">Est. ${timeText} remaining</div>`;
    }

    const phaseTitle = this.getPhaseTitle(phase);
    const statusMessage = message ? escapeHtml(message) : '';

    return `
      <div class="progress-header">
        <span class="progress-title">${phaseTitle}</span>
      </div>
      <div class="progress-content">
        ${statusMessage ? `<div class="status-message">${statusMessage}</div>` : ''}
        ${progressBar}
        ${progressText}
        ${timeEstimate}
      </div>
    `;
  }

  /**
   * Get user-friendly title for each phase
   */
  private getPhaseTitle(phase: string): string {
    switch (phase) {
      case 'checking':
        return 'Checking History Status';
      case 'requesting_permission':
        return 'Requesting Permissions';
      case 'reading_history':
        return 'Reading Browser History';
      case 'processing':
        return 'Processing History Data';
      case 'saving':
        return 'Saving to Storage';
      case 'complete':
        return 'Initialization Complete';
      case 'error':
        return 'Initialization Error';
      default:
        return 'Initializing History';
    }
  }
}

// Export singleton instance
export const progressDisplayManager = new ProgressDisplayManager();
