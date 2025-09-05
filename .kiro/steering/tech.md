# Tech Stack & Build System

## Core Technologies

- **TypeScript**: Strict configuration with ES2020 target
- **Chrome Extension Manifest V3**: Modern extension API
- **Fuse.js**: Fuzzy search library for bookmark searching
- **Webpack**: Module bundler and build system

## Development Tools

- **ESLint**: Code linting with TypeScript support
- **Prettier**: Code formatting
- **Chrome Types**: TypeScript definitions for Chrome APIs

## Build Configuration

- **Webpack**: Bundles TypeScript to JavaScript, copies static assets
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Source Maps**: Enabled in development mode only

## Common Commands

### Development

```bash
npm run dev          # Watch mode development build
npm run build:fast   # Quick production build without linting
```

### Production

```bash
npm run build        # Full production build (format + lint + build)
npm run clean        # Remove dist directory
```

### Code Quality

```bash
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix ESLint issues
npm run format       # Format code with Prettier
npm run format:check # Check formatting without changes
```

### Testing & Packaging

```bash
npm test                                    # Run all tests
npm run test:watch                          # Run tests in watch mode
npx jest --testPathPatterns="test/specific" # Run specific test files
npx jest --testNamePattern="pattern"        # Run tests matching name pattern
npx jest --coverage                         # Run tests with coverage report
npm run zip                                 # Package extension for Chrome Store
```

## Chrome Extension Specifics

### Manifest V3 Architecture

- **Service Worker**: Background script for continuous visit tracking
- **Required Permissions**: tabs, activeTab, bookmarks, storage
- **Optional Permissions**: history (requested dynamically for initialization)
- **Popup-based UI**: Main interface with keyboard shortcuts

### Chrome APIs Used

- **chrome.tabs**: Tab management, visit tracking, and navigation
- **chrome.bookmarks**: Bookmark search and access
- **chrome.windows**: Window management for merge operations
- **chrome.storage**: Data persistence (local and sync)
- **chrome.history**: Optional history initialization
- **chrome.permissions**: Dynamic permission requests

### Extension Features

- **Background Processing**: Continuous visit tracking via service worker
- **Dynamic Permissions**: Runtime permission requests for optional features
- **Storage Management**: Local storage with sync capabilities and quota management
- **Error Recovery**: Graceful degradation when APIs are unavailable

## Testing Framework

- **Jest**: Test runner with TypeScript support via ts-jest
- **Configuration**: Located in `jest.config.js` with TypeScript preset
- **Test Files**: Located in `test/` directory with `.test.ts` extension
- **Coverage**: Configured to collect from `src/**/*.ts` files

### Jest CLI Best Practices

- Use `--testPathPatterns` (plural) for filtering test files by path
- Use `--testNamePattern` for filtering tests by name
- Use `--watch` for development, `--watchAll` to watch all files
- Use `--coverage` for coverage reports, not `--collectCoverage`
- Avoid deprecated options like `--run` (not a valid Jest option)

### Test Failure Debugging Protocol

When unit tests fail, follow this systematic approach to identify root causes before attempting fixes:

#### 1. Analyze the Test Failure Output

- **Read the complete error message** - don't just look at the assertion failure
- **Check for compilation errors** - TypeScript errors often cause test failures
- **Look for setup/teardown issues** - missing mocks, incorrect test environment
- **Identify the specific assertion** that failed and understand what it was testing

#### 2. Examine the Test Code

- **Verify test logic** - ensure the test is testing what it claims to test
- **Check test data** - validate input data, mocks, and expected outputs
- **Review test structure** - proper setup, execution, and assertion phases
- **Look for async issues** - missing `await`, incorrect Promise handling

#### 3. Inspect the Implementation Code

- **Read the actual implementation** being tested thoroughly
- **Trace the execution path** from test input to the failing assertion
- **Check for edge cases** the implementation might not handle
- **Verify type compatibility** between test expectations and actual return types

#### 4. Common Root Cause Categories

- **Interface mismatches**: Test expects different method signatures than implemented
- **Type errors**: Incorrect TypeScript types causing runtime issues
- **Mock configuration**: Incomplete or incorrect mock setup
- **Async handling**: Missing Promise resolution, incorrect timing
- **Chrome API mocking**: Extension APIs not properly mocked in test environment
- **State management**: Tests affecting each other, improper cleanup

#### 5. Debugging Steps Before Fixing

1. **Run the specific failing test in isolation** using `--testNamePattern`
2. **Add console.log statements** to trace execution flow
3. **Use Jest's `--verbose` flag** for detailed test output
4. **Check if multiple tests fail** - indicates broader implementation issues
5. **Verify the test works with a minimal implementation** to validate test logic

#### 6. Fix Strategy

- **Fix the root cause**, not just the symptom
- **Update both implementation and tests** if interface changes are needed
- **Ensure fix doesn't break other tests** by running full test suite
- **Add additional test cases** if the failure revealed missing coverage

### API Evolution Test Debugging Patterns

When tests fail due to API changes or refactoring, follow these specific patterns learned from real debugging sessions:

#### 1. Import and Interface Mismatches

**Common Issue**: Tests import old interfaces or classes that have been renamed/refactored

- **Pattern**: Look for `Cannot find module` or `does not exist on type` errors
- **Solution**: Update imports to match current API (e.g., `EnhancedStorageManager` → `StorageController`)
- **Check**: Verify the actual class/interface names in the source files

#### 2. Method Signature Changes

**Common Issue**: Tests call methods that have been renamed or have different signatures

- **Pattern**: `Property 'methodName' does not exist on type` errors
- **Solution**: Update method calls to match current API (e.g., `enhanceSearchResults` → `enhanceUnifiedSearchResults`)
- **Check**: Read the actual implementation to understand the new method signatures

#### 3. Data Structure Evolution

**Common Issue**: Tests use old data structures that have been replaced

- **Pattern**: Type mismatches between test data and expected interfaces
- **Solution**: Update test data to match new interfaces (e.g., `IClickData` → `IVisitData`, `lastClicked` → `lastVisited`)
- **Check**: Compare old and new type definitions to understand the mapping

#### 4. Chrome API Type Requirements

**Common Issue**: Mock objects missing required properties from Chrome types

- **Pattern**: `Property 'syncing' is missing in type` errors for BookmarkTreeNode
- **Solution**: Add all required properties to mock objects (e.g., `syncing: false`)
- **Check**: Look at the Chrome types definition to see all required properties

#### 5. Union Type Property Access

**Common Issue**: Accessing properties on union types without proper type guards

- **Pattern**: `Property 'id' does not exist on type 'A | B'` errors
- **Solution**: Use type assertions `(item as any).id` or proper type guards
- **Check**: Understand which properties exist on all union members vs. specific ones

#### 6. Storage Key Changes

**Common Issue**: Tests use old storage keys that don't match implementation

- **Pattern**: Tests pass but data isn't loaded correctly
- **Solution**: Update mock storage keys to match current implementation (e.g., `webpage_click_data` → `y_nav_click_data`)
- **Check**: Look at the actual storage manager constants

#### 7. Test Adaptation Strategy

When adapting tests to evolved APIs:

1. **Start with compilation errors** - fix imports and type issues first
2. **Update method calls** - change to new method names and signatures
3. **Transform data structures** - convert old interfaces to new ones
4. **Add missing properties** - ensure mock objects have all required fields
5. **Handle type unions** - use appropriate type assertions or guards
6. **Verify storage keys** - match test mocks to actual implementation keys
7. **Test the behavior** - ensure tests still validate the intended functionality

#### 8. Systematic Test Migration Checklist

- [ ] Update all imports to current module names
- [ ] Change method calls to new API signatures
- [ ] Convert data structures to new interfaces
- [ ] Add required properties to mock objects
- [ ] Fix union type property access
- [ ] Update storage keys and constants
- [ ] Verify test logic still matches intended behavior
- [ ] Run tests to confirm all compilation errors are resolved
- [ ] Validate that tests actually test the right functionality

## Build Requirements for AI Agents

### Post-Development Validation

1. **Always run `npm run build`** after completing any code changes
2. **Verify build success** - ensure no compilation errors or warnings
3. **Provide confidence score** (1-10) for the implemented changes based on:
   - Code quality and adherence to project patterns
   - Build success without errors
   - Completeness of implementation
   - Testing coverage (if applicable)

### Code Quality Standards

- **Concise and elegant code**: Prefer readable, minimal implementations
- **Avoid unnecessary complexity**: Keep both feature design and implementation logic simple and straightforward - resist over-engineering solutions
- Follow existing patterns and conventions in the codebase
- Use TypeScript strict typing throughout
- Maintain separation of concerns across modules
- Write self-documenting code with clear variable and function names

## Configuration & Constants

### Search Configuration

Defined in `src/utils/constants.ts`:

- `SEARCH_MAX_RESULTS`: Maximum search results to process (20)
- `SEARCH_MAX_RESULT_TO_DISPLAY`: Maximum results shown in UI (8)
- `SEARCH_FUSE_RESULT_WEIGHT`: Weight for fuzzy search score (0.7)
- `SEARCH_VISIT_COUNT_WEIGHT`: Weight for visit count in ranking (0.3)
- `SEARCH_MAX_CLICK_BOOST`: Maximum boost factor for frequently visited URLs (2.0)

### History Configuration

- `MAX_BROWSER_HISTORY_AGE_IN_DAYS`: Maximum age of history entries to process (365 days)
- `MAX_BROWSER_HISTORY_COUNT`: Maximum number of history entries to process (1,000,000)

## Advanced Features & Components

### Visit Tracking System

- **Automatic URL Detection**: Background script monitors tab changes and page loads
- **Data Normalization**: URL cleanup to remove query parameters and fragments
- **Storage Optimization**: Efficient data structures with automatic cleanup
- **Cross-session Persistence**: Data maintained across browser restarts

### Search Enhancement

- **Unified Search**: Combines bookmarks and visit data in single interface
- **Fuzzy Matching**: Fuse.js integration for flexible search queries
- **Personalized Ranking**: Visit frequency influences search result ordering
- **Real-time Updates**: Search results update as user types

### Error Management

- **Centralized Handling**: Single error manager for consistent user experience
- **Graceful Degradation**: Fallback modes when Chrome APIs are limited
- **User Feedback**: Clear error messages with actionable guidance
- **Recovery Mechanisms**: Automatic retry with exponential backoff

### Performance Optimization

- **Batch Processing**: Large operations handled in chunks to avoid UI blocking
- **Memory Management**: Efficient data structures and cleanup strategies
- **Storage Quota**: Automatic cleanup when storage limits are approached
- **Async Operations**: Non-blocking operations with proper error handling

## Data Models & Storage

### Storage Keys

Defined in `StorageKeys` enum in `src/utils/constants.ts`:

- `VISIT_DATA`: Visit tracking data with counts and timestamps
- `ERROR_MESSAGES`: Error messages for UI display
- `EXCLUDED_URLS`: URLs to exclude from tracking and search

### Data Structures

```typescript
interface IVisitDataBody {
  count: number; // Number of visits
  lastVisited: number; // Timestamp of last visit
  title?: string; // Page title for search (optional)
  customTitle?: string; // Custom title override
}

interface IVisitData {
  [normalizedUrl: string]: IVisitDataBody;
}

interface SearchEntry {
  url: string;
  title: string;
  visitCount: number;
  lastVisited: number;
}

interface SearchResult {
  item: SearchEntry;
  fuseScore: number;
  finalScore?: number;
}
```

### Storage Management

- **Primary Storage**: chrome.storage.local for visit data
- **Fallback Mode**: Memory-only operation when storage unavailable
- **Data Validation**: Comprehensive validation and cleanup
- **Quota Management**: Automatic cleanup of oldest entries when needed
