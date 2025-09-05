import { IBookmarkTreeNode } from '../types';
import { escapeHtml, getFaviconUrl, truncateUrl } from './utils';

export class BookmarkRenderer {
  private static readonly MAX_RESULTS = 8;

  static renderBookmarks(bookarks: IBookmarkTreeNode[]): string {
    if (bookarks.length === 0) {
      return '<div class="no-results">No bookmarks found</div>';
    }

    const displayBookmarks = bookarks.slice(0, this.MAX_RESULTS);
    return displayBookmarks.map(this.renderBookmark).join('');
  }

  private static renderBookmark(bookmark: IBookmarkTreeNode): string {
    const faviconUrl = getFaviconUrl(bookmark.url || '');
    const truncatedUrl = truncateUrl(bookmark.url || '');

    return `
        <div class="bookmark-item" data-url="${bookmark.url}">
            <img class="bookmark-favicon" src="${faviconUrl}" />
            <div class="bookmark-content">
                <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
                <div class="bookmark-url">${escapeHtml(truncatedUrl)}</div>
            </div>
        </div>
        `;
  }
}
