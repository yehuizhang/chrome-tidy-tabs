# Implementation Plan

- [x] 1. Modify ClickTracker saveClickDataAsync method for test mode synchronous execution
  - Update `saveClickDataAsync()` method to return Promise<void> in test mode and void in production mode
  - Remove setTimeout usage when testMode is enabled
  - Ensure async operations complete synchronously in test mode
  - _Requirements: 2.1, 2.2_

- [x] 2. Update recordClick method to properly await async operations in test mode
  - Modify `recordClick()` to await `saveClickDataAsync()` when in test mode
  - Ensure method returns Promise that resolves after all operations complete in test mode
  - Maintain existing behavior for production mode
  - _Requirements: 2.1, 2.3_

- [x] 3. Implement synchronous error handling for test mode
  - Create helper method for conditional error logging based on test mode
  - Update `tryLocalStorageFallback()` to handle errors synchronously in test mode
  - Ensure no setTimeout is used for error callbacks when testMode is enabled
  - _Requirements: 4.1, 4.3_

- [x] 4. Add Jest timer management to test setup
  - Update test setup to use `jest.useFakeTimers()` in beforeEach
  - Add `jest.runOnlyPendingTimers()` and `jest.useRealTimers()` in afterEach
  - Clear all timers between tests to prevent interference
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 5. Update existing tests to properly await async operations
  - Modify click tracking integration tests to await all async operations
  - Ensure tests wait for `recordClick()` to complete fully in test mode
  - Add verification that no timers are left running after test completion
  - _Requirements: 1.1, 1.3, 3.3_

- [ ] 6. Add unit tests for test mode vs production mode behavior
  - Write tests to verify `saveClickDataAsync()` executes synchronously in test mode
  - Write tests to verify `saveClickDataAsync()` uses setTimeout in production mode
  - Test error handling differences between test and production modes
  - _Requirements: 2.1, 2.2, 4.1, 4.2_

- [ ] 7. Create comprehensive test cleanup verification
  - Add test utilities to check for pending timers after test completion
  - Write tests that verify no console logging occurs after test methods return
  - Add integration test that reproduces and verifies fix for "Cannot log after tests are done" error
  - _Requirements: 1.1, 1.3, 3.1_
