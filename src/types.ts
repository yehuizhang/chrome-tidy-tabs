export type IBookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;



export interface IVisitDataBody {
  count: number; // Number of visits
  lastVisited: number; // Timestamp of last visit
  title?: string; // Page title for search (optional)
  customTitle?: string;
}

export interface IVisitData {
  [normalizedUrl: string]: IVisitDataBody;
}

export interface SearchEntry {
  url: string;
  title: string;
  visitCount: number;
  lastVisited: number;
}

export interface SearchResult {
  item: SearchEntry;
  fuseScore: number;
  finalScore?: number;
}
