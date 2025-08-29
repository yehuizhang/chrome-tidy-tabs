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
node test/*          # Run tests
zip -r tidy_tabs.zip src manifest.json  # Package for Chrome Store
```

## Chrome Extension Specifics
- Uses Manifest V3 with required permissions: tabs, activeTab, bookmarks, storage
- Popup-based UI with keyboard shortcuts
- Chrome APIs: tabs, bookmarks, windows, storage

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
- Follow existing patterns and conventions in the codebase
- Use TypeScript strict typing throughout
- Maintain separation of concerns across modules
- Write self-documenting code with clear variable and function names