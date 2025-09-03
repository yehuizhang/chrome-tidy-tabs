import { SearchScorer } from '../src/searching/search-scorer';
import { IUnifiedSearchResult, IVisitData } from '../src/searching/types';

describe('SearchScorer', () => {
  let scorer: SearchScorer;

  beforeEach(() => {
    scorer = new SearchScorer();
  });

  describe('enhanceUnifiedSearchResults', () => {
    it('should return empty array for empty search results', () => {
      const visitData: IVisitData = {};
      const results = scorer.enhanceUnifiedSearchResults([], visitData);
      expect(results).toEqual([]);
    });

    it('should enhance search results with visit counts and final scores', () => {
      const searchResults: IUnifiedSearchResult[] = [
        {
          item: { id: '1', title: 'Test 1', url: 'https://example.com/page1', syncing: false },
          score: 0.5,
          type: 'bookmark',
        },
        {
          item: { id: '2', title: 'Test 2', url: 'https://example.com/page2', syncing: false },
          score: 0.3,
          type: 'bookmark',
        },
      ];

      const visitData: IVisitData = {
        'example.com/page1': { count: 10, lastVisited: Date.now() },
        'example.com/page2': { count: 5, lastVisited: Date.now() },
      };

      const results = scorer.enhanceUnifiedSearchResults(searchResults, visitData);

      expect(results).toHaveLength(2);
      expect(results[0]?.visitCount).toBe(10); // page1 should be first (more visits, lower final score)
      expect(results[1]?.visitCount).toBe(5);  // page2 should be second
      expect(results[0]?.finalScore).toBeDefined();
      expect(results[1]?.finalScore).toBeDefined();
    });

    it('should handle bookmarks without URLs', () => {
      const searchResults: IUnifiedSearchResult[] = [
        {
          item: { id: '1', title: 'Folder', children: [], syncing: false },
          score: 0.5,
          type: 'bookmark',
        },
      ];

      const visitData: IVisitData = {};
      const results = scorer.enhanceUnifiedSearchResults(searchResults, visitData);

      expect(results).toHaveLength(1);
      expect(results[0]?.visitCount).toBe(0);
    });

    it('should handle bookmarks with no visit history', () => {
      const searchResults: IUnifiedSearchResult[] = [
        {
          item: { id: '1', title: 'Test', url: 'https://newsite.com', syncing: false },
          score: 0.4,
          type: 'bookmark',
        },
      ];

      const visitData: IVisitData = {};
      const results = scorer.enhanceUnifiedSearchResults(searchResults, visitData);

      expect(results).toHaveLength(1);
      expect(results[0]?.visitCount).toBe(0);
    });

    it('should sort results by final score (lower is better)', () => {
      const searchResults: IUnifiedSearchResult[] = [
        {
          item: { id: '1', title: 'Less relevant', url: 'https://example.com/page1', syncing: false },
          score: 0.8, // Higher fuzzy score (less relevant)
          type: 'bookmark',
        },
        {
          item: { id: '2', title: 'More relevant', url: 'https://example.com/page2', syncing: false },
          score: 0.2, // Lower fuzzy score (more relevant)
          type: 'bookmark',
        },
      ];

      const visitData: IVisitData = {
        'example.com/page1': { count: 20, lastVisited: Date.now() }, // High visits
        'example.com/page2': { count: 1, lastVisited: Date.now() },  // Low visits
      };

      const results = scorer.enhanceUnifiedSearchResults(searchResults, visitData);

      // The result with high visits should be boosted despite lower fuzzy relevance
      expect((results[0]?.item as any).id).toBe('1'); // High visit count should boost this to first place
      expect((results[1]?.item as any).id).toBe('2');
    });
  });

  describe('error handling', () => {
    it('should handle invalid visit data gracefully', () => {
      const searchResults: IUnifiedSearchResult[] = [
        {
          item: { id: '1', title: 'Test', url: 'https://example.com', syncing: false },
          score: 0.5,
          type: 'bookmark',
        },
      ];

      // Test with null visit data
      const results1 = scorer.enhanceUnifiedSearchResults(searchResults, null as any);
      expect(results1).toHaveLength(1);
      expect(results1[0]?.visitCount).toBe(0);

      // Test with invalid visit data structure
      const results2 = scorer.enhanceUnifiedSearchResults(searchResults, { 'invalid': 'data' } as any);
      expect(results2).toHaveLength(1);
      expect(results2[0]?.visitCount).toBe(0);
    });

    it('should handle results with missing scores', () => {
      const searchResults: IUnifiedSearchResult[] = [
        {
          item: { id: '1', title: 'Test', url: 'https://example.com', syncing: false },
          score: undefined as any,
          type: 'bookmark',
        },
      ];

      const visitData: IVisitData = {
        'example.com/': { count: 5, lastVisited: Date.now() },
      };

      const results = scorer.enhanceUnifiedSearchResults(searchResults, visitData);
      expect(results).toHaveLength(1);
      expect(results[0]?.finalScore).toBeDefined();
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
    it('should boost frequently visited bookmarks with poor fuzzy scores', () => {
      const searchResults: IUnifiedSearchResult[] = [
        {
          item: { id: '1', title: 'Rarely used but relevant', url: 'https://example.com/relevant', syncing: false },
          score: 0.1, // Very relevant fuzzy match
          type: 'bookmark',
        },
        {
          item: { id: '2', title: 'Frequently used but less relevant', url: 'https://example.com/frequent', syncing: false },
          score: 0.7, // Poor fuzzy match
          type: 'bookmark',
        },
      ];

      const visitData: IVisitData = {
        'example.com/relevant': { count: 1, lastVisited: Date.now() },
        'example.com/frequent': { count: 100, lastVisited: Date.now() }, // Very high usage
      };

      const results = scorer.enhanceUnifiedSearchResults(searchResults, visitData);

      // The frequently used bookmark should get a significant boost
      expect((results[0]?.item as any).id).toBe('2'); // Frequent should be first due to high visits
      expect(results[0]?.finalScore).toBeLessThan(results[1]?.finalScore || 0);
    });

    it('should handle mixed scenarios with some bookmarks having no visits', () => {
      const searchResults: IUnifiedSearchResult[] = [
        {
          item: { id: '1', title: 'New bookmark', url: 'https://new.com', syncing: false },
          score: 0.2,
          type: 'bookmark',
        },
        {
          item: { id: '2', title: 'Old bookmark', url: 'https://old.com', syncing: false },
          score: 0.4,
          type: 'bookmark',
        },
      ];

      const visitData: IVisitData = {
        'old.com/': { count: 10, lastVisited: Date.now() },
        // new.com has no visit history
      };

      const results = scorer.enhanceUnifiedSearchResults(searchResults, visitData);

      expect(results).toHaveLength(2);
      expect(results[0]?.visitCount).toBe(10); // old.com should be boosted
      expect(results[1]?.visitCount).toBe(0);  // new.com has no visits
    });

    it('should handle visit search results', () => {
      const searchResults: IUnifiedSearchResult[] = [
        {
          item: {
            url: 'https://example.com/page',
            title: 'Example Page',
            visitCount: 5,
            lastVisited: Date.now(),
            type: 'visit',
          },
          score: 0.3,
          type: 'visit',
        },
      ];

      const visitData: IVisitData = {
        'example.com/page': { count: 15, lastVisited: Date.now() },
      };

      const results = scorer.enhanceUnifiedSearchResults(searchResults, visitData);

      expect(results).toHaveLength(1);
      expect(results[0]?.visitCount).toBe(15); // Should use visit data count
      expect(results[0]?.finalScore).toBeDefined();
    });
  });
});