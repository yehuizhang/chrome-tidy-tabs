# Project Structure & Architecture

## Directory Layout

```
├── src/                    # Source code
│   ├── core/               # Core extension components (popup, background, styles)
│   ├── feature/            # Feature-specific modules (error management, URL exclusion)
│   ├── searching/          # Search system components
│   ├── ui/                 # User interface components
│   ├── utils/              # Utility functions and constants
│   ├── error_handling.ts   # Error handling utilities
│   ├── storage-controller.ts # Storage operations
│   ├── tab_management.ts   # Tab management operations
│   └── types.ts            # TypeScript type definitions
├── assets/                 # Extension icons (16px, 48px, 128px)
├── dist/                   # Build output (generated)
├── archive/                # Legacy assets and screenshots
├── test/                   # Test files
├── node_modules/           # Dependencies
└── manifest.json           # Chrome extension manifest
```

## Source Code Organization (`src/`)

### Core Module (`src/core/`)

- **popup.html**: Extension popup UI template
- **popup.ts**: Main application entry point and UI coordinator
- **background.ts**: Service worker for continuous visit tracking
- **styles.css**: UI styling and visual components

### Root Level Files

- **tab_management.ts**: Tab operations (sort, dedupe, merge)
- **storage-controller.ts**: Enhanced storage operations with error handling
- **error_handling.ts**: Error handling utilities
- **types.ts**: TypeScript interfaces and type definitions

### Feature Module (`src/feature/`)

- **error-manager.ts**: Centralized error handling and user feedback
- **url-exclusion.ts**: URL filtering and exclusion logic

### Search System (`src/searching/`)

- **searching.ts**: Main search coordinator and unified search engine
- **keyboard-handler.ts**: Keyboard navigation and shortcuts
- **selection-manager.ts**: UI selection state management
- **visit-storage-manager.ts**: Visit data persistence and retrieval
- **search-rank.ts**: Search ranking and scoring algorithms
- **utils.ts**: Utility functions (HTML escaping, URL handling, favicon)

### UI Module (`src/ui/`)

- **search-result-renderer.ts**: Search result display and rendering logic

### Utils Module (`src/utils/`)

- **constants.ts**: Application constants and configuration values
- **performance.ts**: Performance monitoring and optimization utilities

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
// Interface-driven design with dependency injection
interface IErrorManager {
  addError(message: string): void;
  getErrors(): string[];
  clearErrors(): void;
  displayErrors(): void;
}

class Component {
  constructor(private errorManager?: IErrorManager) {
    this.errorManager = errorManager || defaultErrorManager;
  }
  // Implementation with error handling
}
```

### Modular Architecture Patterns

- **Feature Modules**: Self-contained modules in `src/feature/` for specific functionality
- **UI Separation**: UI components isolated in `src/ui/` module
- **Utility Centralization**: Common utilities and constants in `src/utils/`
- **Core Isolation**: Essential extension components in `src/core/`

### Storage Key Conventions

- **Enum-based Keys**: Storage keys defined in `StorageKeys` enum in `src/utils/constants.ts`
- **Descriptive Names**: Clear indication of data purpose (e.g., `VISIT_DATA`, `ERROR_MESSAGES`, `EXCLUDED_URLS`)
- **Centralized Management**: All storage keys managed through constants file

### Error Handling Patterns

```typescript
import { errorManager as defaultErrorManager, IErrorManager } from '../feature/error-manager';

class Component {
  constructor(private errorManager?: IErrorManager) {
    this.errorManager = errorManager || defaultErrorManager;
  }

  async performOperation(): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.errorManager.addError(`Operation failed: ${error.message}`);
      // Graceful fallback
    }
  }
}
```

### Storage Key Management

```typescript
import { StorageKeys } from '../utils/constants';

// Use enum-based storage keys
await chrome.storage.local.set({
  [StorageKeys.VISIT_DATA]: visitData,
  [StorageKeys.ERROR_MESSAGES]: errors
});
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
