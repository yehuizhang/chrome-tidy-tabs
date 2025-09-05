import {
  IScoringWeights,
  IVisitData,
  IUnifiedSearchResult,
  IBookmarkTreeNode,
  IVisitSearchEntry,
} from '../types';

export class SearchScorer {
  private readonly weights: IScoringWeights = {
    fuzzySearchWeight: 0.7,
    clickCountWeight: 0.3, // Now represents visit count weight
    maxClickBoost: 2.0, // Now represents max visit boost
  };

  /**
   * Enhance unified search results by combining fuzzy search scores with visit frequency data
   */
  enhanceUnifiedSearchResults(
    unifiedResults: IUnifiedSearchResult[],
    visitData: IVisitData
  ): IUnifiedSearchResult[] {
    if (unifiedResults.length === 0) {
      return [];
    }

    try {
      // Validate visit data
      const validatedVisitData = this.validateVisitData(visitData);

      // Get max visit count for normalization
      const maxVisitCount = this.getMaxVisitCount(validatedVisitData);

      // Enhance each result with visit data and final score
      const enhancedResults = unifiedResults.map(result => {
        try {
          const visitCount = this.getVisitCountForResult(
            result,
            validatedVisitData
          );
          const normalizedVisitScore = this.normalizeVisitCount(
            visitCount,
            maxVisitCount
          );
          const finalScore = this.calculateFinalScore(
            result.score || 1,
            normalizedVisitScore
          );

          return {
            ...result,
            visitCount,
            finalScore,
          };
        } catch {
          // If individual result processing fails, fall back to fuzzy score only
          console.debug(
            'Failed to enhance individual unified search result, using fuzzy score only'
          );
          return {
            ...result,
            visitCount: result.visitCount || 0,
            finalScore: result.score || 1,
          };
        }
      });

      // Sort by final score (lower is better, like Fuse.js)
      return enhancedResults.sort(
        (a, b) => (a.finalScore || 1) - (b.finalScore || 1)
      );
    } catch (error) {
      // If enhancement fails completely, fall back to original results
      console.warn(
        'Unified search enhancement failed, falling back to fuzzy search only:',
        error
      );
      return unifiedResults.map(result => ({
        ...result,
        visitCount: result.visitCount || 0,
        finalScore: result.score || 1,
      }));
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
   * Get visit count for a unified search result
   */
  private getVisitCountForResult(
    result: IUnifiedSearchResult,
    visitData: IVisitData
  ): number {
    let url: string | undefined;

    if (result.type === 'bookmark') {
      const bookmark = result.item as IBookmarkTreeNode;
      url = bookmark.url;
    } else if (result.type === 'visit') {
      const visitResult = result.item as IVisitSearchEntry;
      url = visitResult.url;
    }

    if (!url) {
      return result.visitCount || 0;
    }

    return visitData[url]?.count || result.visitCount || 0;
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

  /**
   * Find the maximum visit count across all stored data
   */
  private getMaxVisitCount(visitData: IVisitData): number {
    const visitCounts = Object.values(visitData).map(data => data.count);
    return visitCounts.length > 0 ? Math.max(...visitCounts) : 0;
  }

  /**
   * Validate visit data structure and handle corrupted data
   */
  private validateVisitData(visitData: IVisitData): IVisitData {
    if (!visitData || typeof visitData !== 'object') {
      console.debug('Invalid visit data structure, using empty data');
      return {};
    }

    const validatedData: IVisitData = {};

    for (const [url, visitInfo] of Object.entries(visitData)) {
      validatedData[url] = visitInfo;
    }

    return validatedData;
  }
}
