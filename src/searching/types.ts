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

// Visit tracking interfaces
export interface IVisitData {
  [normalizedUrl: string]: {
    count: number; // Number of visits
    lastVisited: number; // Timestamp of last visit
    title?: string; // Page title for search (optional)
  };
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
