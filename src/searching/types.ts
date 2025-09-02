export type IBookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;

export interface ISearchResult {
  item: IBookmarkTreeNode;
  score?: number;
}

export interface IFaviconCache {
  [url: string]: string;
}

export interface IClickData {
  [normalizedUrl: string]: {
    count: number;
    lastClicked: number; // timestamp
  };
}

export interface IEnhancedSearchResult extends ISearchResult {
  clickCount: number;
  finalScore: number; // Combined fuzzy + click score
}

export interface IScoringWeights {
  fuzzySearchWeight: number; // 0.7
  clickCountWeight: number; // 0.3
  maxClickBoost: number; // 0.5 (max boost from clicks)
}
