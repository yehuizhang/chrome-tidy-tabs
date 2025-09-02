# Project Structure & Architecture

## Directory Layout
```
├── src/                    # Source code
├── assets/                 # Extension icons (16px, 48px, 128px)
├── dist/                   # Build output (generated)
├── archive/                # Legacy assets and screenshots
├── node_modules/           # Dependencies
└── manifest.json           # Chrome extension manifest
```

## Source Code Organization (`src/`)
- **popup.html**: Extension popup UI template
- **popup.ts**: Main application entry point and bookmark search logic
- **styles.css**: UI styling
- **types.ts**: TypeScript interfaces and type definitions
- **utils.ts**: Utility functions (HTML escaping, URL handling, favicon)
- **bookmark-renderer.ts**: Bookmark display and rendering logic
- **keyboard-handler.ts**: Keyboard navigation and shortcuts
- **selection-manager.ts**: UI selection state management

## Architecture Patterns

### Modular Design
- Separation of concerns with dedicated modules for rendering, keyboard handling, and selection
- Single responsibility classes with clear interfaces
- Utility functions isolated in separate module

### Chrome Extension Structure
- Popup-based extension with single entry point
- Manifest V3 compliance with proper permissions
- Asset copying via Webpack for distribution

### Code Conventions
- TypeScript interfaces prefixed with `I` (e.g., `IBookmarkTreeNode`, `ISearchResult`)
- Strict TypeScript configuration with comprehensive type checking
- ESLint + Prettier for consistent code style
- Chrome globals properly typed and declared

### Build Output
- Webpack bundles TypeScript to `dist/popup.js`
- Static assets copied to `dist/` maintaining structure
- Production builds are minified and optimized