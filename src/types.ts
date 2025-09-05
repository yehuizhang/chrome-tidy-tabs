export type IBookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;

export interface IScoringWeights {
  fuzzySearchWeight: number; // 0.7
  clickCountWeight: number; // 0.3 (now represents visit count weight)
  maxClickBoost: number; // 2.0 (now represents max visit boost)
}

export interface IVisitDataBody {
  count: number; // Number of visits
  lastVisited: number; // Timestamp of last visit
  title?: string; // Page title for search (optional)
  customTitle?: string;
}

export interface IVisitData {
  [normalizedUrl: string]: IVisitDataBody;
}

export interface IVisitSearchEntry {
  url: string;
  title: string;
  visitCount: number;
  lastVisited: number;
}

export interface IUnifiedSearchResult {
  item: IBookmarkTreeNode | IVisitSearchEntry;
  score: number;
  type: 'bookmark' | 'visit';
  visitCount?: number;
  finalScore?: number; // Combined relevance + visit frequency
}
