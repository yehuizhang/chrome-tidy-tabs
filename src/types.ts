export interface IBookmark {
  id: string;
  title: string;
  url?: string;
  children?: IBookmark[];
}

export interface ISearchResult {
  item: IBookmark;
  score?: number;
}

export interface IFaviconCache {
  [url: string]: string;
}
