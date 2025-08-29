import {
  ISearchResult,
  IEnhancedSearchResult,
  IClickData,
  IScoringWeights,
} from './types';
import { normalizeUrl } from './utils';

export class SearchScorer {
  private readonly weights: IScoringWeights = {
    fuzzySearchWeight: 0.7,
    clickCountWeight: 0.3,
    maxClickBoost: 2.0, // Increased to give more boost to frequently clicked items
  };

  /**
   * Enhance search results by combining fuzzy search scores with click count data
   */
  enhanceSearchResults(
    searchResults: ISearchResult[],
    clickData: IClickData
  ): IEnhancedSearchResult[] {
    if (searchResults.length === 0) {
      return [];
    }

    try {
      // Validate click data
      const validatedClickData = this.validateClickData(clickData);

      // Get max click count for normalization
      const maxClickCount = this.getMaxClickCount(validatedClickData);

      // Enhance each result with click data and final score
      const enhancedResults = searchResults.map(result => {
        try {
          const clickCount = this.getClickCountForBookmark(
            result,
            validatedClickData
          );
          const normalizedClickScore = this.normalizeClickCount(
            clickCount,
            maxClickCount
          );
          const finalScore = this.calculateFinalScore(
            result.score || 1,
            normalizedClickScore
          );

          return {
            ...result,
            clickCount,
            finalScore,
          } as IEnhancedSearchResult;
        } catch {
          // If individual result processing fails, fall back to fuzzy score only
          console.debug(
            'Failed to enhance individual search result, using fuzzy score only'
          );
          return {
            ...result,
            clickCount: 0,
            finalScore: result.score || 1,
          } as IEnhancedSearchResult;
        }
      });

      // Sort by final score (lower is better, like Fuse.js)
      return enhancedResults.sort((a, b) => a.finalScore - b.finalScore);
    } catch (error) {
      // If enhancement fails completely, fall back to original results
      console.warn(
        'Search enhancement failed, falling back to fuzzy search only:',
        error
      );
      return searchResults.map(result => ({
        ...result,
        clickCount: 0,
        finalScore: result.score || 1,
      })) as IEnhancedSearchResult[];
    }
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
    const clickBoost = normalizedClickScore * this.weights.maxClickBoost;

    return (
      fuzzyScore * this.weights.fuzzySearchWeight -
      clickBoost * this.weights.clickCountWeight
    );
  }

  /**
   * Normalize click count to 0-1 range based on maximum observed clicks
   */
  private normalizeClickCount(
    clickCount: number,
    maxClickCount: number
  ): number {
    if (maxClickCount === 0) {
      return 0;
    }
    return Math.min(clickCount / maxClickCount, 1.0);
  }

  /**
   * Get click count for a specific bookmark
   */
  private getClickCountForBookmark(
    searchResult: ISearchResult,
    clickData: IClickData
  ): number {
    if (!searchResult.item.url) {
      return 0;
    }

    const normalizedUrl = normalizeUrl(searchResult.item.url);
    return clickData[normalizedUrl]?.count || 0;
  }

  /**
   * Find the maximum click count across all stored data
   */
  private getMaxClickCount(clickData: IClickData): number {
    const clickCounts = Object.values(clickData).map(data => data.count);
    return clickCounts.length > 0 ? Math.max(...clickCounts) : 0;
  }

  /**
   * Get current scoring weights (for testing and configuration)
   */
  getWeights(): IScoringWeights {
    return { ...this.weights };
  }

  /**
   * Update scoring weights (for testing and configuration)
   */
  updateWeights(newWeights: Partial<IScoringWeights>): void {
    Object.assign(this.weights, newWeights);
  }

  /**
   * Validate click data structure and handle corrupted data
   */
  private validateClickData(clickData: IClickData): IClickData {
    if (!clickData || typeof clickData !== 'object') {
      console.debug('Invalid click data structure, using empty data');
      return {};
    }

    const validatedData: IClickData = {};
    let invalidEntries = 0;

    for (const [url, clickInfo] of Object.entries(clickData)) {
      if (this.isValidClickEntry(url, clickInfo)) {
        validatedData[url] = clickInfo;
      } else {
        invalidEntries++;
      }
    }

    if (invalidEntries > 0) {
      console.debug(`Removed ${invalidEntries} invalid click data entries`);
    }

    return validatedData;
  }

  /**
   * Validate individual click data entry
   */
  private isValidClickEntry(url: string, clickInfo: unknown): boolean {
    return (
      typeof url === 'string' &&
      url.length > 0 &&
      clickInfo !== null &&
      typeof clickInfo === 'object' &&
      'count' in clickInfo &&
      'lastClicked' in clickInfo &&
      typeof (clickInfo as { count: unknown }).count === 'number' &&
      typeof (clickInfo as { lastClicked: unknown }).lastClicked === 'number' &&
      (clickInfo as { count: number }).count >= 0 &&
      (clickInfo as { lastClicked: number }).lastClicked > 0 &&
      Number.isFinite((clickInfo as { count: number }).count) &&
      Number.isFinite((clickInfo as { lastClicked: number }).lastClicked)
    );
  }
}
