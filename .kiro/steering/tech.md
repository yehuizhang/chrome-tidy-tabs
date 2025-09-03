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
zip -r tidy_tabs.zip src manifest.json     # Package for Chrome Store
```

## Chrome Extension Specifics

- Uses Manifest V3 with required permissions: tabs, activeTab, bookmarks, storage
- Popup-based UI with keyboard shortcuts
- Chrome APIs: tabs, bookmarks, windows, storage

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
