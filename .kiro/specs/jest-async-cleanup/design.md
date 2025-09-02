# Design Document

## Overview

The Jest async cleanup issue stems from the ClickTracker's use of setTimeout in production code that continues executing after tests complete. The solution involves enhancing the test mode functionality to ensure all async operations complete synchronously during testing, while maintaining the non-blocking behavior in production.

## Architecture

The fix involves three main components:

1. **Enhanced Test Mode Handling**: Modify the ClickTracker to handle async operations differently in test vs production mode
2. **Synchronous Test Execution**: Ensure all async operations complete before test methods return when in test mode
3. **Jest Test Cleanup**: Add proper cleanup mechanisms in Jest tests to handle any remaining async operations

## Components and Interfaces

### ClickTracker Modifications

#### Current Issue
- `saveClickDataAsync()` uses `setTimeout(..., 0)` even in test mode
- Error handling in async operations continues after test completion
- `tryLocalStorageFallback()` logs errors asynchronously

#### Enhanced Test Mode Implementation
```typescript
private saveClickDataAsync(): void {
  if (this.testMode) {
    // In test mode, execute immediately and return a promise that tests can await
    return this.saveClickData().catch(error => {
      const errorInfo = this.getErrorInfo(error);
      console.warn(`Test mode save failed: ${errorInfo.type}`, errorInfo.details);
    });
  } else {
    // Production mode: use setTimeout for non-blocking behavior
    setTimeout(async () => {
      try {
        await this.saveClickData();
      } catch (error) {
        const errorInfo = this.getErrorInfo(error);
        console.warn(`Async save failed: ${errorInfo.type}`, errorInfo.details);
      }
    }, 0);
  }
}
```

#### Method Signature Changes
- `saveClickDataAsync()` should return `Promise<void>` in test mode, `void` in production
- `recordClick()` should await `saveClickDataAsync()` when in test mode

### Jest Test Enhancements

#### Test Setup Modifications
```typescript
beforeEach(() => {
  // Clear any existing timers
  jest.clearAllTimers();
  
  // Enable fake timers for better control
  jest.useFakeTimers();
  
  clickTracker = new ClickTracker();
  clickTracker.enableTestMode();
});

afterEach(async () => {
  // Run any pending timers
  jest.runOnlyPendingTimers();
  
  // Restore real timers
  jest.useRealTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
});
```

#### Async Operation Handling
- Tests should await all async operations to completion
- Use `jest.runAllTimers()` when testing timeout behavior
- Ensure all promises are resolved before test completion

## Data Models

No new data models are required. The existing `IClickData` interface remains unchanged.

## Error Handling

### Test Mode Error Handling
- Errors in test mode should be handled synchronously
- Console logging should complete before method returns
- No setTimeout should be used for error callbacks in test mode

### Production Mode Error Handling
- Maintain existing async error handling for non-blocking behavior
- Continue using setTimeout for error callbacks to avoid blocking UI

### Error Logging Strategy
```typescript
private logError(message: string, details?: string): void {
  if (this.testMode) {
    // Synchronous logging in test mode
    console.warn(message, details || '');
  } else {
    // Async logging in production (existing behavior)
    setTimeout(() => console.warn(message, details || ''), 0);
  }
}
```

## Testing Strategy

### Unit Tests
- Test that `saveClickDataAsync()` behaves synchronously in test mode
- Test that `saveClickDataAsync()` uses setTimeout in production mode
- Verify that all async operations complete before test methods return

### Integration Tests
- Ensure Jest tests complete without "Cannot log after tests are done" errors
- Verify that test mode doesn't affect production behavior
- Test error handling in both modes

### Test Cleanup Verification
- Add tests that verify no timers are left running after test completion
- Test that multiple rapid async operations complete properly in test mode

### Mock Strategy
- Use `jest.useFakeTimers()` to control setTimeout behavior in tests
- Mock console methods to verify logging behavior
- Use `jest.runAllTimers()` to flush any remaining timers

## Implementation Notes

### Backward Compatibility
- Production behavior remains unchanged
- Test mode is opt-in via `enableTestMode()`
- No breaking changes to public API

### Performance Considerations
- Test mode adds minimal overhead (one boolean check)
- Production performance is unaffected
- Synchronous test execution may be slightly slower but more reliable

### Error Recovery
- If sync operations fail in test mode, fallback to existing async behavior
- Maintain existing retry logic for both modes
- Ensure storage errors don't break test execution