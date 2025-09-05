# Project Structure & Architecture

## Directory Layout

```
├── src/                    # Source code
│   ├── searching/          # Search system components
├── assets/                 # Extension icons (16px, 48px, 128px)
├── dist/                   # Build output (generated)
├── archive/                # Legacy assets and screenshots
├── test/                   # Test files
├── node_modules/           # Dependencies
└── manifest.json           # Chrome extension manifest
```

## Source Code Organization (`src/`)

### Core Files

- **popup.html**: Extension popup UI template
- **popup.ts**: Main application entry point and UI coordinator
- **background.ts**: Service worker for continuous visit tracking
- **styles.css**: UI styling
- **tab_management.ts**: Tab operations (sort, dedupe, merge)
- **error-manager.ts**: Centralized error handling and user feedback
- **error_handling.ts**: Error handling utilities

### Search System (`src/searching/`)

- **searching.ts**: Main search coordinator and unified search engine
- **bookmark-renderer.ts**: Bookmark display and rendering logic
- **keyboard-handler.ts**: Keyboard navigation and shortcuts
- **selection-manager.ts**: UI selection state management
- **visit-tracker.ts**: Automatic URL visit detection and recording
- **visit-storage-controller.ts**: Data persistence and retrieval
- **storage-controller.ts**: Enhanced storage operations with error handling
- **history-initializer.ts**: First-run history data population
- **initialization-state-manager.ts**: Initialization progress tracking
- **progress-display-manager.ts**: User feedback during long operations
- **search-scorer.ts**: Search ranking and scoring algorithms
- **types.ts**: TypeScript interfaces and type definitions
- **utils.ts**: Utility functions (HTML escaping, URL handling, favicon)

### Test Organization (`test/`)

- **Unit Tests**: Component-specific functionality testing
- **Integration Tests**: Complete workflow testing
- **Mock Helpers**: Chrome API mocking utilities
- **Test Setup**: Jest configuration and shared test utilities

## Architecture Patterns

### Modular Design

- **Separation of Concerns**: Dedicated modules for search, tracking, storage, and UI
- **Single Responsibility**: Each class handles one specific aspect of functionality
- **Interface-Driven**: Clear contracts between components via TypeScript interfaces
- **Dependency Injection**: Components receive dependencies rather than creating them

### Chrome Extension Structure

- **Manifest V3**: Modern service worker architecture
- **Background Script**: Continuous visit tracking via service worker
- **Popup Interface**: Main UI with comprehensive search and tab management
- **Permission Management**: Dynamic permission requests for optional features
- **Storage Strategy**: Local storage with sync capabilities and fallback modes

### Data Flow Architecture

```
User Input → Popup Interface → Search Engine → Storage Manager → Chrome APIs
                ↓                    ↓              ↓
         UI Components ← Search Results ← Visit Data ← Background Tracker
```

### Error Handling Strategy

- **Centralized Error Management**: Single error manager for consistent user feedback
- **Graceful Degradation**: Fallback modes when Chrome APIs are unavailable
- **Retry Mechanisms**: Exponential backoff for transient failures
- **User Communication**: Clear error messages with actionable guidance

## Code Conventions

### TypeScript Standards

- **Interface Naming**: Prefixed with `I` (e.g., `IBookmarkTreeNode`, `IVisitData`)
- **Strict Configuration**: Comprehensive type checking enabled
- **Generic Types**: Used for reusable components and data structures
- **Union Types**: Proper handling with type guards and assertions

### Component Structure

```typescript
interface IComponent {
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  // Component-specific methods
}

class Component implements IComponent {
  constructor(private dependencies: IDependencies) {}
  // Implementation
}
```

### Storage Key Conventions

- **Namespace Prefix**: All keys prefixed with `y_nav_`
- **Descriptive Names**: Clear indication of data purpose
- **Version Management**: Data format versioning for migrations

### Error Handling Patterns

```typescript
try {
  await operation();
} catch (error) {
  this.errorManager.addError(`Operation failed: ${error.message}`);
  // Graceful fallback
}
```

## Build Output Structure

```
dist/
├── popup.js              # Main application bundle
├── background.js         # Service worker bundle
├── popup.html           # UI template
├── styles.css           # Compiled styles
├── assets/              # Extension icons
└── manifest.json        # Extension manifest
```

### Build Process

- **Webpack**: Bundles TypeScript to JavaScript with optimization
- **Asset Pipeline**: Copies and optimizes static assets
- **Source Maps**: Generated for development builds only
- **Minification**: Production builds are minified and optimized
- **Type Checking**: Full TypeScript compilation with strict mode

## Testing Architecture

### Test Categories

- **Unit Tests**: Individual component functionality
- **Integration Tests**: Component interaction and workflows
- **Chrome API Tests**: Extension API integration with comprehensive mocking
- **Error Scenario Tests**: Failure modes and recovery mechanisms

### Mock Strategy

- **Chrome API Mocking**: Complete Chrome extension API simulation
- **Storage Mocking**: In-memory storage for test isolation
- **Async Operation Mocking**: Controlled timing for reliable tests
- **Error Injection**: Simulated failures for error handling validation
