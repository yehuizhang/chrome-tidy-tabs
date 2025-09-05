import { SearchResult, SearchEntry } from '../types';
import {
  SEARCH_FUSE_RESULT_WEIGHT,
  SEARCH_MAX_CLICK_BOOST,
  SEARCH_MAX_RESULTS,
  SEARCH_VISIT_COUNT_WEIGHT,
} from '../utils/constants';

export class SearchRank {
  /**
   * Enhance unified search results by combining fuzzy search scores with visit frequency data
   */
  rankSearchResults(searchResults: SearchResult[]): SearchEntry[] {
    if (searchResults.length === 0) {
      return [];
    }

    // Find the maximum visit count from search results
    const maxVisitCount = Math.max(
      ...searchResults.map(result => result.item.visitCount || 0)
    );

    searchResults.forEach(result => {
      const visitCount = result.item.visitCount || 0;

      const normalizedVisitScore = this.normalizeVisitCount(
        visitCount,
        maxVisitCount
      );
      result.finalScore = this.calculateFinalScore(
        result.fuseScore,
        normalizedVisitScore
      );
    });

    // Sort by final score (lower is better, like Fuse.js)
    return searchResults
      .sort((a, b) => (a.finalScore || 1) - (b.finalScore || 1))
      .map(result => result.item)
      .slice(0, SEARCH_MAX_RESULTS);
  }

  /**
   * Calculate the final score combining fuzzy search and click count
   */
  private calculateFinalScore(
    fuzzyScore: number,
    normalizedClickScore: number
  ): number {
    // Fuzzy score is 0-1 where lower is better
    // Click score is 0-1 where higher is better, so we subtract it to boost frequently clicked items
    const clickBoost = normalizedClickScore * SEARCH_MAX_CLICK_BOOST;

    return (
      fuzzyScore * SEARCH_FUSE_RESULT_WEIGHT -
      clickBoost * SEARCH_VISIT_COUNT_WEIGHT
    );
  }

  /**
   * Normalize visit count to 0-1 range based on maximum observed visits
   */
  private normalizeVisitCount(
    visitCount: number,
    maxVisitCount: number
  ): number {
    if (maxVisitCount === 0) {
      return 0;
    }
    return Math.min(visitCount / maxVisitCount, 1.0);
  }
}
