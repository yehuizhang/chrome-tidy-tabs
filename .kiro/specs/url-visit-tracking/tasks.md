# Implementation Plan

- [x] 1. Create core visit tracking data structures and interfaces
  - Define IVisitData, IVisitSearchResult, and IUnifiedSearchResult interfaces in types.ts
  - Add visit tracking related type definitions
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 2. Implement VisitStorageManager class
  - Create visit-storage-manager.ts with chrome.storage.local integration
  - Implement loadVisitData, saveVisitData, recordVisit, and getVisitCount methods
  - Add data validation and error handling for storage operations
  - _Requirements: 1.1, 1.2, 4.1, 4.3, 4.4_

- [x] 3. Create ErrorManager for centralized error handling
  - Implement error-manager.ts with localStorage persistence
  - Add methods for addError, getErrors, clearErrors, and displayErrors
  - Create error storage and retrieval functionality
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 4. Add error display UI to popup
  - Modify popup.html to include error display block
  - Add CSS styles for error messages in styles.css
  - Implement error clearing on popup initialization
  - _Requirements: 6.1, 6.5, 6.6_

- [x] 5. Implement VisitTracker class
  - Create visit-tracker.ts with URL normalization and visit recording
  - Add methods for recordVisit and visit count management
  - Integrate with VisitStorageManager and ErrorManager
  - _Requirements: 1.1, 1.2, 1.3, 4.4_

- [x] 6. Create background script for automatic visit tracking
  - Create background.ts with Chrome tabs API event listeners
  - Implement tab update and activation event handlers
  - Add VisitTracker integration for automatic visit recording
  - Update manifest.json to include background script
  - _Requirements: 1.1, 1.2_

- [x] 7. Enhance search system to include visit data
  - Modify searching.ts to integrate visit data in search results
  - Implement unified search that combines bookmarks and visited URLs
  - Add deduplication logic to prevent duplicate entries
  - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.3_

- [x] 8. Implement search result ranking with visit frequency
  - Update search-scorer.ts to include visit count weighting
  - Add ranking algorithm that combines fuzzy search score with visit frequency
  - Implement result sorting based on combined scores
  - _Requirements: 2.3, 5.1, 5.2_

- [x] 9. Remove click tracking logic from selection-manager
  - Remove click recording functionality from selection-manager.ts
  - Clean up click-related method calls in searching.ts
  - Update openBookmark method to rely on visit tracking instead
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 10. Update storage-manager to handle migration
  - Modify storage-manager.ts to support gradual transition
  - Add backward compatibility for existing click data
  - Implement cleanup methods for old click tracking data
  - _Requirements: 3.3, 3.4_

- [x] 11. Add comprehensive error handling throughout the system
  - Update all components to use ErrorManager for error reporting
  - Add try-catch blocks around storage operations
  - Implement graceful degradation when chrome.storage.local is unavailable
  - _Requirements: 4.2, 6.1, 6.2_

- [ ] 12. Create unit tests for visit tracking components
  - Write tests for VisitStorageManager storage operations and error handling
  - Create tests for VisitTracker URL normalization and visit recording
  - Add tests for ErrorManager error storage and display functionality
  - _Requirements: 1.1, 1.2, 4.1, 6.1_

- [ ] 13. Create integration tests for enhanced search
  - Write tests for unified search combining bookmarks and visit data
  - Test deduplication logic and result ranking
  - Add tests for search performance with large visit datasets
  - _Requirements: 2.1, 2.2, 2.3, 5.1_

- [ ] 14. Add end-to-end tests for visit tracking workflow
  - Create tests for background script tab event handling
  - Test complete visit recording and search integration flow
  - Add tests for error scenarios and graceful degradation
  - _Requirements: 1.1, 1.2, 2.1, 4.2_

- [x] 15. Update build configuration and validate implementation
  - Ensure background script is properly bundled by webpack
  - Run full build process and verify no compilation errors
  - Test extension loading and functionality in Chrome
  - _Requirements: All requirements validation_
