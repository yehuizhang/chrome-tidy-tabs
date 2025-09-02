# Design Document

## Overview

The bookmark history tracking feature enhances the existing bookmark search by adding click count tracking and personalized search ranking. The design integrates seamlessly with the current Fuse.js-based fuzzy search while adding a new layer of user behavior analytics stored in Chrome's storage API.

## Architecture

### High-Level Components

1. **ClickTracker**: Manages click count storage and retrieval
2. **Enhanced Search Scoring**: Combines fuzzy search scores with click count data
3. **Storage Manager**: Handles Chrome storage operations with error handling
4. **Search Result Ranker**: Applies weighted scoring algorithm for final rankings

### Data Flow

```
User clicks bookmark → ClickTracker.recordClick() → Chrome Storage
                                                        ↓
Search query → Fuse.js fuzzy search → Enhanced Scorer → Ranked Results
                                           ↑
                              ClickTracker.getClickCounts()
```

## Components and Interfaces

### ClickTracker Class

```typescript
interface IClickData {
  [normalizedUrl: string]: {
    count: number;
    lastClicked: number; // timestamp
  };
}

class ClickTracker {
  private clickData: IClickData = {};
  
  async loadClickData(): Promise<void>
  async recordClick(url: string): Promise<void>
  getClickCount(url: string): number
  private normalizeUrl(url: string): string // Extract hostname + pathname only
  private async saveClickData(): Promise<void>
}
```

### Enhanced Search Result Interface

```typescript
interface IEnhancedSearchResult extends ISearchResult {
  clickCount: number;
  finalScore: number; // Combined fuzzy + click score
}
```

### Search Scoring Algorithm

```typescript
interface IScoringWeights {
  fuzzySearchWeight: number; // 0.7
  clickCountWeight: number;  // 0.3
  maxClickBoost: number;     // 0.5 (max boost from clicks)
}
```

## Data Models

### Click Data Storage Structure

```typescript
// Stored in Chrome storage.sync
// URLs are normalized to hostname + pathname only (no query params, fragments, or protocol)
{
  "webpage_click_data": {
    "example.com/": {
      "count": 15,
      "lastClicked": 1703123456789
    },
    "github.com/user/repo": {
      "count": 8,
      "lastClicked": 1703098765432
    }
  }
}
```

### Enhanced Bookmark Interface

The existing `IBookmarkTreeNode` interface remains unchanged, but search results will be enhanced with click data during processing.

## Error Handling

### Storage Error Scenarios

1. **Storage Quota Exceeded**: Gracefully degrade to fuzzy search only
2. **Storage Access Denied**: Log error and continue with basic functionality
3. **Corrupted Data**: Reset click data and start fresh
4. **Network Issues (sync)**: Fall back to local storage

### Error Handling Strategy

```typescript
class StorageErrorHandler {
  static async handleStorageError(error: Error, operation: string): Promise<void> {
    console.warn(`Storage operation '${operation}' failed:`, error);
    // Continue with degraded functionality
  }
}
```

## Testing Strategy

### Unit Tests

1. **ClickTracker Tests**
   - Test click count increment
   - Test data persistence
   - Test error handling scenarios

2. **Search Scoring Tests**
   - Test score combination algorithm
   - Test ranking with various click count scenarios
   - Test fallback to fuzzy search only

3. **Storage Manager Tests**
   - Test Chrome storage API integration
   - Test error recovery mechanisms
   - Test data migration scenarios

### Integration Tests

1. **End-to-End Search Flow**
   - Search → Click → Re-search → Verify ranking change
   - Test keyboard navigation click tracking
   - Test mouse click tracking

2. **Storage Persistence Tests**
   - Extension reload scenarios
   - Browser restart scenarios
   - Storage quota limit scenarios

### Performance Tests

1. **Search Performance**
   - Measure search latency with click data integration
   - Test with large click history datasets
   - Memory usage monitoring

## Implementation Details

### Scoring Algorithm

The final score combines fuzzy search relevance with click count data:

```typescript
finalScore = (fuzzyScore * fuzzyWeight) + (normalizedClickScore * clickWeight)

where:
- fuzzyScore: Fuse.js relevance score (0-1, lower is better)
- normalizedClickScore: Click count normalized to 0-1 range
- fuzzyWeight: 0.7 (prioritize relevance)
- clickWeight: 0.3 (boost frequently used bookmarks)
```

### Click Count Normalization

```typescript
normalizedClickScore = Math.min(clickCount / maxObservedClicks, 1.0)
```

### Storage Strategy

- Use `chrome.storage.sync` for cross-device synchronization
- Implement batched writes to minimize storage operations
- Use debouncing for rapid successive clicks
- Implement data cleanup for old/unused entries

### Integration Points

1. **BookmarkSearch.openBookmark()**: Add click tracking call
2. **BookmarkSearch.openSelectedBookmark()**: Add click tracking for keyboard navigation
3. **BookmarkSearch.searchBookmarks()**: Integrate enhanced scoring
4. **Fuse.js configuration**: Modify to work with enhanced scoring system

## Security Considerations

1. **Data Privacy**: Click data remains local to user's Chrome profile
2. **Storage Limits**: Implement data cleanup to prevent storage abuse
3. **URL Normalization**: Store only hostname + pathname to improve privacy and reduce storage usage
4. **Error Information**: Avoid logging sensitive bookmark URLs in error messages
##
# URL Normalization Strategy

To improve privacy and data consistency, URLs are normalized before storage:

```typescript
private normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname;
  } catch (error) {
    console.warn('Invalid URL for normalization:', url);
    return url; // Fallback to original URL if parsing fails
  }
}
```

**Benefits**:
- **Privacy**: Removes query parameters that may contain sensitive data
- **Consistency**: Same page with different query params counts as one entry
- **Storage Efficiency**: Reduces storage usage by eliminating URL variations
- **Better Analytics**: Groups related page visits together