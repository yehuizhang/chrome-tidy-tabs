# Design Document

## Overview

This design implements URL visit tracking functionality that replaces the existing click tracking system with automatic visit detection. The system will track URL visits using Chrome's tabs API, store visit counts in chrome.storage.local, and enhance the search functionality to include frequently visited URLs alongside bookmarks. Additionally, it introduces a comprehensive error handling system with user-visible error messages.

## Architecture

### Core Components

1. **VisitTracker**: New component responsible for tracking URL visits
2. **VisitStorageManager**: Manages visit count data in chrome.storage.local
3. **Enhanced Search System**: Modified search that includes visited URLs
4. **Error Management System**: Centralized error handling with user feedback
5. **Background Script**: Listens for tab navigation events

### Data Flow

```
Tab Navigation → VisitTracker → VisitStorageManager → chrome.storage.local
                                      ↓
Search Query → Enhanced Search → Bookmarks + Visit Data → Ranked Results
                                      ↓
Error Occurs → ErrorManager → localStorage → UI Error Display
```

## Components and Interfaces

### 1. VisitTracker

**Purpose**: Tracks URL visits by listening to Chrome tab events

```typescript
interface IVisitTracker {
  startTracking(): void;
  stopTracking(): void;
  recordVisit(url: string): Promise<void>;
}

class VisitTracker implements IVisitTracker {
  private visitStorageManager: IVisitStorageManager;
  private errorManager: IErrorManager;
}
```

**Key Methods**:
- `startTracking()`: Sets up Chrome tabs event listeners
- `recordVisit(url)`: Normalizes URL and updates visit count
- Event handlers for `chrome.tabs.onUpdated` and `chrome.tabs.onActivated`

### 2. VisitStorageManager

**Purpose**: Manages visit count data storage and retrieval

```typescript
interface IVisitData {
  [normalizedUrl: string]: {
    count: number;
    lastVisited: number;
    title?: string; // Optional page title for search
  };
}

interface IVisitStorageManager {
  loadVisitData(): Promise<IVisitData>;
  saveVisitData(data: IVisitData): Promise<void>;
  recordVisit(url: string, title?: string): Promise<void>;
  getVisitCount(url: string): number;
  getAllVisitData(): IVisitData;
  clearVisitData(): Promise<void>;
  isStorageAvailable(): boolean;
}
```

**Storage Strategy**:
- Uses `chrome.storage.local` exclusively
- Storage key: `tidy_tabs_visit_data`
- Version key: `tidy_tabs_visit_data_version`
- Implements data validation and cleanup strategies

### 3. Enhanced Search System

**Purpose**: Combines bookmark and visit data for comprehensive search

```typescript
interface IVisitSearchResult {
  url: string;
  title: string;
  visitCount: number;
  lastVisited: number;
  type: 'visit';
}

interface IUnifiedSearchResult {
  item: IBookmarkTreeNode | IVisitSearchResult;
  score: number;
  type: 'bookmark' | 'visit';
  visitCount?: number;
}
```

**Search Enhancement**:
- Searches both bookmarks and visit data
- Deduplicates results (bookmark takes precedence over visit)
- Ranks results by relevance + visit frequency
- Supports fuzzy search on visited page titles

### 4. Error Management System

**Purpose**: Centralized error handling with user-visible feedback

```typescript
interface IErrorManager {
  addError(message: string): void;
  getErrors(): string[];
  clearErrors(): void;
  displayErrors(): void;
  initializeErrorDisplay(): void;
}

class ErrorManager implements IErrorManager {
  private static readonly ERROR_STORAGE_KEY = 'tidy_tabs_errors';
  private errors: string[] = [];
}
```

**Error Display**:
- Error block in popup UI
- Persistent storage in localStorage
- Auto-clear on popup initialization
- Non-blocking error handling

### 5. Background Script Integration

**Purpose**: Enables visit tracking across all tabs

```typescript
// background.ts (new file)
class BackgroundVisitTracker {
  private visitTracker: VisitTracker;
  
  constructor() {
    this.setupTabListeners();
  }
  
  private setupTabListeners(): void {
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate);
    chrome.tabs.onActivated.addListener(this.handleTabActivation);
  }
}
```

## Data Models

### Visit Data Structure

```typescript
interface IVisitData {
  [normalizedUrl: string]: {
    count: number;           // Number of visits
    lastVisited: number;     // Timestamp of last visit
    title?: string;          // Page title for search (optional)
  };
}
```

### Unified Search Result

```typescript
interface IUnifiedSearchResult {
  item: IBookmarkTreeNode | IVisitSearchResult;
  score: number;
  type: 'bookmark' | 'visit';
  visitCount: number;
  finalScore: number;      // Combined relevance + visit frequency
}
```

### Error Storage

```typescript
interface IErrorStorage {
  errors: string[];
  timestamp: number;
}
```

## Error Handling

### Storage Errors
- **chrome.storage.local unavailable**: Display error message in popup
- **Storage quota exceeded**: Implement cleanup strategy (remove oldest 20% of entries)
- **Storage write failures**: Retry with exponential backoff, fallback to memory-only mode

### Visit Tracking Errors
- **Tab API failures**: Log errors, continue with existing data
- **URL normalization errors**: Skip invalid URLs, log for debugging
- **Background script failures**: Graceful degradation to click-based tracking

### Search Enhancement Errors
- **Visit data corruption**: Validate and clean data, fallback to bookmark-only search
- **Search integration failures**: Continue with basic bookmark search
- **Deduplication errors**: Show all results, log error

### Error Display Strategy
- Non-intrusive error block at top of popup
- Errors persist across popup sessions via localStorage
- Clear errors on popup initialization
- Provide actionable error messages where possible

## Testing Strategy

### Unit Tests
- **VisitStorageManager**: Storage operations, data validation, error handling
- **VisitTracker**: URL normalization, visit recording, event handling
- **Enhanced Search**: Result merging, deduplication, ranking
- **ErrorManager**: Error storage, display, clearing

### Integration Tests
- **Background Script**: Tab event handling, visit recording flow
- **Search Integration**: End-to-end search with visit data
- **Storage Migration**: Transition from click data to visit data
- **Error Scenarios**: Storage failures, API unavailability

### Performance Tests
- **Large Visit Dataset**: Search performance with 10k+ visited URLs
- **Storage Efficiency**: Memory usage and storage optimization
- **Search Response Time**: Combined bookmark + visit search latency

### Browser Compatibility Tests
- **Chrome Storage API**: Verify chrome.storage.local behavior
- **Tab Events**: Test across different Chrome versions
- **Manifest V3**: Ensure background script compliance

## Migration Strategy

### Phase 1: Parallel Implementation
- Implement visit tracking alongside existing click tracking
- Both systems record data independently
- Search uses click data as fallback

### Phase 2: Gradual Transition
- Switch search to use visit data primarily
- Keep click tracking for backward compatibility
- Monitor for any functionality regressions

### Phase 3: Cleanup
- Remove click tracking code from selection-manager.ts
- Clean up unused storage keys
- Update tests to use visit tracking

### Data Migration
- No automatic migration needed (different data structures)
- Users will build new visit data organically
- Old click data can be safely ignored/removed