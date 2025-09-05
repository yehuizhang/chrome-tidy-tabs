import { SearchEntry } from '../types';
import { escapeHtml, getFaviconUrl, truncateUrl } from '../searching/utils';
import { SEARCH_MAX_RESULT_TO_DISPLAY } from '../utils/constants';

export class SearchResultRenderer {
  static renderSearchResults(searchResults: SearchEntry[]): string {
    if (searchResults.length === 0) {
      return '<div class="no-results">No record found</div>';
    }

    return searchResults
      .slice(0, SEARCH_MAX_RESULT_TO_DISPLAY)
      .map(this.renderResultEntry)
      .join('');
  }

  private static renderResultEntry(result: SearchEntry): string {
    const faviconUrl = getFaviconUrl(result.url || '');
    const truncatedUrl = truncateUrl(result.url || '');

    return `
        <div class="search-result-item" data-url="${result.url}">
            <img class="search-result-favicon" src="${faviconUrl}"  alt="${result.title}"/>
            <div class="search-result-content">
                <div class="search-result-title">${escapeHtml(result.title)}</div>
                <div class="search-result-url">${escapeHtml(truncatedUrl)}</div>
            </div>
        </div>
        `;
  }
}
