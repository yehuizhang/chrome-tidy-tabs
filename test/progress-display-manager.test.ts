import { ProgressDisplayManager } from '../src/searching/progress-display-manager';
import { IHistoryInitializationProgress } from '../src/searching/types';

// Simple DOM mock with working createElement for escapeHtml
const createMockElement = () => ({
  id: '',
  className: '',
  innerHTML: '',
  style: { display: 'none' },
  parentNode: null,
  insertBefore: jest.fn(),
  appendChild: jest.fn(),
  set textContent(value: string) {
    this.innerHTML = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  get textContent() {
    return this.innerHTML;
  }
});

const mockDocument = {
  getElementById: jest.fn(),
  createElement: jest.fn(() => createMockElement()),
  querySelector: jest.fn(),
  body: createMockElement(),
};

(global as any).document = mockDocument;

describe('ProgressDisplayManager', () => {
  let progressDisplayManager: ProgressDisplayManager;
  let mockContainer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContainer = createMockElement();
    mockContainer.id = 'progress-container';
    mockContainer.className = 'progress-container';
    
    mockDocument.getElementById.mockReturnValue(null);
    mockDocument.createElement.mockReturnValue(mockContainer);
    mockDocument.querySelector.mockReturnValue(createMockElement());

    progressDisplayManager = new ProgressDisplayManager();
  });

  describe('Initialization', () => {
    it('should initialize without errors', () => {
      expect(() => progressDisplayManager.initializeProgressDisplay()).not.toThrow();
    });

    it('should start with progress hidden', () => {
      progressDisplayManager.initializeProgressDisplay();
      expect(progressDisplayManager.isProgressVisible()).toBe(false);
    });
  });

  describe('Progress Display', () => {
    beforeEach(() => {
      progressDisplayManager.initializeProgressDisplay();
    });

    it('should show progress and update visibility state', () => {
      const progress: IHistoryInitializationProgress = {
        phase: 'checking',
        message: 'Checking if history initialization is needed...',
        startTime: Date.now(),
      };

      progressDisplayManager.showProgress(progress);

      expect(progressDisplayManager.isProgressVisible()).toBe(true);
      expect(mockContainer.style.display).toBe('block');
      expect(mockContainer.innerHTML).toContain('Checking History Status');
    });

    it('should show processing phase with progress information', () => {
      const progress: IHistoryInitializationProgress = {
        phase: 'processing',
        totalItems: 1000,
        processedItems: 350,
        currentBatch: 35,
        totalBatches: 100,
        message: 'Processing history items...',
        startTime: Date.now(),
      };

      progressDisplayManager.showProgress(progress);

      expect(mockContainer.innerHTML).toContain('Processing History Data');
      expect(mockContainer.innerHTML).toContain('35%');
      expect(mockContainer.innerHTML).toContain('350');
      expect(mockContainer.innerHTML).toContain('1,000');
      expect(mockContainer.innerHTML).toContain('Batch 35 of 100');
    });

    it('should show time estimates for long operations', () => {
      const progress: IHistoryInitializationProgress = {
        phase: 'processing',
        totalItems: 5000,
        processedItems: 1000,
        estimatedTimeRemaining: 75000, // 75 seconds
        startTime: Date.now(),
      };

      progressDisplayManager.showProgress(progress);

      expect(mockContainer.innerHTML).toContain('Est. 1m 15s remaining');
    });
  });

  describe('Error Display', () => {
    beforeEach(() => {
      progressDisplayManager.initializeProgressDisplay();
    });

    it('should show error state correctly', () => {
      const progress: IHistoryInitializationProgress = {
        phase: 'error',
        error: 'Chrome history API is not available',
        startTime: Date.now(),
      };

      progressDisplayManager.showProgress(progress);

      expect(mockContainer.innerHTML).toContain('History Initialization Error');
      expect(mockContainer.innerHTML).toContain('Chrome history API is not available');
    });
  });

  describe('Success Display', () => {
    beforeEach(() => {
      progressDisplayManager.initializeProgressDisplay();
    });

    it('should show completion state correctly', () => {
      const progress: IHistoryInitializationProgress = {
        phase: 'complete',
        message: 'History initialization completed successfully.',
        startTime: Date.now(),
      };

      progressDisplayManager.showProgress(progress);

      expect(mockContainer.innerHTML).toContain('History Initialization Complete');
      expect(mockContainer.innerHTML).toContain('completed successfully');
    });
  });

  describe('Hide Functionality', () => {
    beforeEach(() => {
      progressDisplayManager.initializeProgressDisplay();
    });

    it('should hide progress display', () => {
      const progress: IHistoryInitializationProgress = {
        phase: 'processing',
        totalItems: 100,
        processedItems: 50,
        startTime: Date.now(),
      };

      progressDisplayManager.showProgress(progress);
      expect(progressDisplayManager.isProgressVisible()).toBe(true);

      progressDisplayManager.hideProgress();
      expect(progressDisplayManager.isProgressVisible()).toBe(false);
    });
  });
});