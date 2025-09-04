export type IBookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;

export interface ISearchResult {
  item: IBookmarkTreeNode;
  score?: number;
}

export interface IClickData {
  [normalizedUrl: string]: {
    count: number;
    lastClicked: number; // timestamp
  };
}

export interface IScoringWeights {
  fuzzySearchWeight: number; // 0.7
  clickCountWeight: number; // 0.3 (now represents visit count weight)
  maxClickBoost: number; // 2.0 (now represents max visit boost)
}

export interface IVisitDataBody {
  count: number; // Number of visits
  lastVisited: number; // Timestamp of last visit
  title?: string; // Page title for search (optional)
  originalUrl?: string;
}
// Visit tracking interfaces
export interface IVisitData {
  [normalizedUrl: string]: IVisitDataBody;
}

export interface IVisitSearchResult {
  url: string;
  title: string;
  visitCount: number;
  lastVisited: number;
  type: 'visit';
}

export interface IUnifiedSearchResult {
  item: IBookmarkTreeNode | IVisitSearchResult;
  score: number;
  type: 'bookmark' | 'visit';
  visitCount?: number;
  finalScore?: number; // Combined relevance + visit frequency
}

// Progress tracking interfaces for history initialization
export interface IHistoryInitializationProgress {
  phase:
    | 'checking'
    | 'requesting_permission'
    | 'reading_history'
    | 'processing'
    | 'saving'
    | 'complete'
    | 'error';
  totalItems?: number;
  processedItems?: number;
  currentBatch?: number;
  totalBatches?: number;
  message?: string;
  error?: string;
  startTime?: number;
  estimatedTimeRemaining?: number;
}

export interface IProgressCallback {
  (progress: IHistoryInitializationProgress): void;
}

export interface IHistoryInitializationResult {
  success: boolean;
  itemsProcessed?: number;
  uniqueUrls?: number;
  error?: string;
  skippedItems?: number;
  processingTimeMs?: number;
}
