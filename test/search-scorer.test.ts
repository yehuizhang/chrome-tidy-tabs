import { SearchScorer } from '../src/searching/search-scorer';
import { ISearchResult, IClickData } from '../src/searching/types';
import { createMockBookmark } from './test-helpers';

describe('SearchScorer', () => {
  let scorer: SearchScorer;

  beforeEach(() => {
    scorer = new SearchScorer();
  });

  describe('enhanceSearchResults', () => {
    it('should return empty array for empty search results', () => {
      const clickData: IClickData = {};
      const results = scorer.enhanceSearchResults([], clickData);
      expect(results).toEqual([]);
    });

    it('should enhance search results with click counts and final scores', () => {
      const searchResults: ISearchResult[] = [
        {
          item: { id: '1', title: 'Test 1', url: 'https://example.com/page1' },
          score: 0.5,
        },
        {
          item: { id: '2', title: 'Test 2', url: 'https://example.com/page2' },
          score: 0.3,
        },
      ];

      const clickData: IClickData = {
        'example.com/page1': { count: 10, lastClicked: Date.now() },
        'example.com/page2': { count: 5, lastClicked: Date.now() },
      };

      const results = scorer.enhanceSearchResults(searchResults, clickData);

      expect(results).toHaveLength(2);
      expect(results[0]?.clickCount).toBe(10); // page1 should be first (more clicks, lower final score)
      expect(results[1]?.clickCount).toBe(5);  // page2 should be second
      expect(results[0]?.finalScore).toBeDefined();
      expect(results[1]?.finalScore).toBeDefined();
    });

    it('should handle bookmarks without URLs', () => {
      const searchResults: ISearchResult[] = [
        {
          item: { id: '1', title: 'Folder', children: [] },
          score: 0.5,
        },
      ];

      const clickData: IClickData = {};
      const results = scorer.enhanceSearchResults(searchResults, clickData);

      expect(results).toHaveLength(1);
      expect(results[0]?.clickCount).toBe(0);
    });

    it('should handle bookmarks with no click history', () => {
      const searchResults: ISearchResult[] = [
        {
          item: { id: '1', title: 'Test', url: 'https://newsite.com' },
          score: 0.4,
        },
      ];

      const clickData: IClickData = {};
      const results = scorer.enhanceSearchResults(searchResults, clickData);

      expect(results).toHaveLength(1);
      expect(results[0]?.clickCount).toBe(0);
    });

    it('should sort results by final score (lower is better)', () => {
      const searchResults: ISearchResult[] = [
        {
          item: { id: '1', title: 'Less relevant', url: 'https://example.com/page1' },
          score: 0.8, // Higher fuzzy score (less relevant)
        },
        {
          item: { id: '2', title: 'More relevant', url: 'https://example.com/page2' },
          score: 0.2, // Lower fuzzy score (more relevant)
        },
      ];

      const clickData: IClickData = {
        'example.com/page1': { count: 20, lastClicked: Date.now() }, // High clicks
        'example.com/page2': { count: 1, lastClicked: Date.now() },  // Low clicks
      };

      const results = scorer.enhanceSearchResults(searchResults, clickData);

      // The result with high clicks should be boosted despite lower fuzzy relevance
      expect(results[0]?.item.id).toBe('1'); // High click count should boost this to first place
      expect(results[1]?.item.id).toBe('2');
    });
  });

  describe('calculateFinalScore', () => {
    it('should combine fuzzy and click scores with correct weights', () => {
      const scorer = new SearchScorer();
      const weights = scorer.getWeights();
      
      // Test with known values
      const fuzzyScore = 0.5;
      const normalizedClickScore = 0.8;
      
      // Access private method for testing
      const finalScore = (scorer as unknown as { calculateFinalScore: (fuzzy: number, click: number) => number }).calculateFinalScore(fuzzyScore, normalizedClickScore);
      
      // Expected calculation:
      // clickBoost = 0.8 * 2.0 = 1.6
      // finalScore = (0.5 * 0.7) - (1.6 * 0.3) = 0.35 - 0.48 = -0.13
      const expectedScore = (fuzzyScore * weights.fuzzySearchWeight) - 
                           ((normalizedClickScore * weights.maxClickBoost) * weights.clickCountWeight);
      
      expect(finalScore).toBeCloseTo(expectedScore, 5);
    });
  });

  describe('normalizeClickCount', () => {
    it('should normalize click counts to 0-1 range', () => {
      const scorer = new SearchScorer();
      const scorerWithPrivate = scorer as unknown as { normalizeClickCount: (count: number, max: number) => number };
      
      // Test normalization with max count of 100
      expect(scorerWithPrivate.normalizeClickCount(0, 100)).toBe(0);
      expect(scorerWithPrivate.normalizeClickCount(50, 100)).toBe(0.5);
      expect(scorerWithPrivate.normalizeClickCount(100, 100)).toBe(1);
      expect(scorerWithPrivate.normalizeClickCount(150, 100)).toBe(1); // Capped at 1
    });

    it('should handle zero max click count', () => {
      const scorer = new SearchScorer();
      const scorerWithPrivate = scorer as unknown as { normalizeClickCount: (count: number, max: number) => number };
      expect(scorerWithPrivate.normalizeClickCount(5, 0)).toBe(0);
    });
  });

  describe('getMaxClickCount', () => {
    it('should find maximum click count from click data', () => {
      const scorer = new SearchScorer();
      const scorerWithPrivate = scorer as unknown as { getMaxClickCount: (data: IClickData) => number };
      const clickData: IClickData = {
        'site1.com/': { count: 5, lastClicked: Date.now() },
        'site2.com/': { count: 15, lastClicked: Date.now() },
        'site3.com/': { count: 3, lastClicked: Date.now() },
      };

      const maxCount = scorerWithPrivate.getMaxClickCount(clickData);
      expect(maxCount).toBe(15);
    });

    it('should return 0 for empty click data', () => {
      const scorer = new SearchScorer();
      const scorerWithPrivate = scorer as unknown as { getMaxClickCount: (data: IClickData) => number };
      const maxCount = scorerWithPrivate.getMaxClickCount({});
      expect(maxCount).toBe(0);
    });
  });

  describe('getClickCountForBookmark', () => {
    it('should return correct click count for bookmark with URL', () => {
      const scorer = new SearchScorer();
      const scorerWithPrivate = scorer as unknown as { getClickCountForBookmark: (result: ISearchResult, data: IClickData) => number };
      const searchResult: ISearchResult = {
        item: { id: '1', title: 'Test', url: 'https://example.com/page' },
        score: 0.5,
      };
      const clickData: IClickData = {
        'example.com/page': { count: 7, lastClicked: Date.now() },
      };

      const clickCount = scorerWithPrivate.getClickCountForBookmark(searchResult, clickData);
      expect(clickCount).toBe(7);
    });

    it('should return 0 for bookmark without URL', () => {
      const scorer = new SearchScorer();
      const scorerWithPrivate = scorer as unknown as { getClickCountForBookmark: (result: ISearchResult, data: IClickData) => number };
      const searchResult: ISearchResult = {
        item: { id: '1', title: 'Folder', children: [] },
        score: 0.5,
      };
      const clickData: IClickData = {};

      const clickCount = scorerWithPrivate.getClickCountForBookmark(searchResult, clickData);
      expect(clickCount).toBe(0);
    });

    it('should return 0 for bookmark with no click history', () => {
      const scorer = new SearchScorer();
      const scorerWithPrivate = scorer as unknown as { getClickCountForBookmark: (result: ISearchResult, data: IClickData) => number };
      const searchResult: ISearchResult = {
        item: { id: '1', title: 'Test', url: 'https://newsite.com' },
        score: 0.5,
      };
      const clickData: IClickData = {};

      const clickCount = scorerWithPrivate.getClickCountForBookmark(searchResult, clickData);
      expect(clickCount).toBe(0);
    });
  });

  describe('weights configuration', () => {
    it('should return default weights', () => {
      const weights = scorer.getWeights();
      expect(weights.fuzzySearchWeight).toBe(0.7);
      expect(weights.clickCountWeight).toBe(0.3);
      expect(weights.maxClickBoost).toBe(2.0);
    });

    it('should allow updating weights', () => {
      scorer.updateWeights({ fuzzySearchWeight: 0.8, clickCountWeight: 0.2 });
      const weights = scorer.getWeights();
      expect(weights.fuzzySearchWeight).toBe(0.8);
      expect(weights.clickCountWeight).toBe(0.2);
      expect(weights.maxClickBoost).toBe(2.0); // Unchanged
    });

    it('should preserve unchanged weights when updating', () => {
      scorer.updateWeights({ maxClickBoost: 0.6 });
      const weights = scorer.getWeights();
      expect(weights.fuzzySearchWeight).toBe(0.7); // Unchanged
      expect(weights.clickCountWeight).toBe(0.3);  // Unchanged
      expect(weights.maxClickBoost).toBe(0.6);     // Updated
    });
  });

  describe('integration scenarios', () => {
    it('should boost frequently clicked bookmarks with poor fuzzy scores', () => {
      const searchResults: ISearchResult[] = [
        {
          item: { id: '1', title: 'Rarely used but relevant', url: 'https://example.com/relevant' },
          score: 0.1, // Very relevant fuzzy match
        },
        {
          item: { id: '2', title: 'Frequently used but less relevant', url: 'https://example.com/frequent' },
          score: 0.7, // Poor fuzzy match
        },
      ];

      const clickData: IClickData = {
        'example.com/relevant': { count: 1, lastClicked: Date.now() },
        'example.com/frequent': { count: 100, lastClicked: Date.now() }, // Very high usage
      };

      const results = scorer.enhanceSearchResults(searchResults, clickData);

      // The frequently used bookmark should get a significant boost
      expect(results[0]?.item.id).toBe('2'); // Frequent should be first due to high clicks
      expect(results[0]?.finalScore).toBeLessThan(results[1]?.finalScore || 0);
    });

    it('should handle mixed scenarios with some bookmarks having no clicks', () => {
      const searchResults: ISearchResult[] = [
        {
          item: { id: '1', title: 'New bookmark', url: 'https://new.com' },
          score: 0.2,
        },
        {
          item: { id: '2', title: 'Old bookmark', url: 'https://old.com' },
          score: 0.4,
        },
      ];

      const clickData: IClickData = {
        'old.com/': { count: 10, lastClicked: Date.now() },
        // new.com has no click history
      };

      const results = scorer.enhanceSearchResults(searchResults, clickData);

      expect(results).toHaveLength(2);
      expect(results[0]?.clickCount).toBe(10); // old.com should be boosted
      expect(results[1]?.clickCount).toBe(0);  // new.com has no clicks
    });
  });
});