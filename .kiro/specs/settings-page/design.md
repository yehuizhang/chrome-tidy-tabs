# Design Document

## Overview

The settings page feature will add a configuration interface to the Tidy Tabs extension, allowing users to customize extension behavior. The design follows the existing popup-based architecture and maintains visual consistency with the current interface. The primary setting will control the number of search results displayed, with the architecture designed to easily accommodate additional settings in the future.

## Architecture

### Component Structure

The settings functionality will be implemented using a multi-page approach within the existing popup:

1. **Settings Navigation**: A gear button added to the main popup's tab tooling container
2. **Settings Page**: A new view that replaces the main popup content when accessed
3. **Settings Manager**: A TypeScript class to handle settings persistence and retrieval
4. **Settings Storage**: Chrome's sync storage API for cross-device synchronization

### Navigation Flow

```
Main Popup → [Gear Button] → Settings Page → [Back Button] → Main Popup
```

The navigation will be handled by showing/hiding DOM elements rather than creating separate HTML files, maintaining the single-popup architecture.

## Components and Interfaces

### Settings Manager Class

```typescript
interface ISettingsManager {
  loadSettings(): Promise<IExtensionSettings>;
  saveSettings(settings: Partial<IExtensionSettings>): Promise<void>;
  resetToDefaults(): Promise<IExtensionSettings>;
  getSetting<K extends keyof IExtensionSettings>(key: K): IExtensionSettings[K];
}

interface IExtensionSettings {
  searchResultsLimit: number;
  // Future settings can be added here
}
```

### Settings UI Components

1. **Settings Container**: Main wrapper for the settings page
2. **Setting Item**: Reusable component for individual settings
3. **Number Input**: Specialized input for the search results limit
4. **Action Buttons**: Reset, Back/Done buttons

### Integration Points

- **Popup Class**: Modified to handle navigation between main and settings views
- **Searching Class**: Updated to respect the search results limit setting
- **Chrome Storage**: Used for persistence with sync storage for cross-device support

## Data Models

### Settings Schema

```typescript
const DEFAULT_SETTINGS: IExtensionSettings = {
  searchResultsLimit: 10
};

const SETTINGS_CONSTRAINTS = {
  searchResultsLimit: {
    min: 1,
    max: 100,
    default: 10
  }
};
```

### Storage Structure

Settings will be stored in Chrome's sync storage under the key `tidyTabsSettings`:

```json
{
  "tidyTabsSettings": {
    "searchResultsLimit": 10,
    "version": "1.0"
  }
}
```

## User Interface Design

### Settings Page Layout

```html
<div class="settings-container">
  <div class="settings-header">
    <h2>Settings</h2>
    <button class="back-button">← Back</button>
  </div>
  
  <div class="settings-content">
    <div class="setting-item">
      <label for="searchLimit">Search Results Limit</label>
      <input type="number" id="searchLimit" min="1" max="100" />
      <span class="setting-description">Number of results to show in bookmark search</span>
    </div>
  </div>
  
  <div class="settings-actions">
    <button class="reset-button">Reset to Defaults</button>
  </div>
</div>
```

### Visual Design Principles

- **Consistency**: Use existing CSS classes and color scheme from `styles.css`
- **Accessibility**: Proper labels, focus management, and keyboard navigation
- **Responsive**: Maintain the popup's width constraints (420px)
- **Visual Hierarchy**: Clear sections with appropriate spacing and typography

### CSS Integration

New CSS classes will extend the existing design system:

```css
.settings-container {
  /* Inherits from existing popup styling */
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-item {
  /* Similar to bookmark-item styling */
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
}
```

## Error Handling

### Validation Strategy

1. **Input Validation**: Real-time validation for number inputs with visual feedback
2. **Storage Errors**: Graceful degradation when storage is unavailable
3. **Default Fallbacks**: Use default values when settings cannot be loaded

### Error Recovery

- **Storage Failures**: Continue with default settings and show user notification
- **Invalid Settings**: Reset to defaults and notify user
- **Navigation Errors**: Ensure user can always return to main popup

### Error Display

Integrate with the existing error manager system:

```typescript
try {
  await settingsManager.saveSettings(newSettings);
} catch (error) {
  errorManager.addError(`Failed to save settings: ${error.message}`);
  // Show inline error message in settings UI
}
```

## Testing Strategy

### Unit Tests

1. **Settings Manager**: Test all CRUD operations and validation
2. **Settings UI**: Test form interactions and validation
3. **Storage Integration**: Mock Chrome storage API for testing
4. **Navigation**: Test switching between main and settings views

### Integration Tests

1. **End-to-End Settings Flow**: Complete user journey from main popup to settings and back
2. **Search Results Limiting**: Verify that search respects the configured limit
3. **Cross-Session Persistence**: Test settings survival across browser restarts
4. **Error Scenarios**: Test behavior when storage fails or settings are corrupted

### Test Files Structure

```
test/
├── settings-manager.test.ts
├── settings-ui.test.ts
├── settings-integration.test.ts
└── settings-storage.test.ts
```

## Implementation Considerations

### Performance

- **Lazy Loading**: Settings UI only created when accessed
- **Debounced Saving**: Prevent excessive storage writes during user input
- **Minimal DOM Manipulation**: Efficient show/hide for navigation

### Browser Compatibility

- **Chrome Storage API**: Use chrome.storage.sync with fallback to local storage
- **Modern JavaScript**: Maintain ES2020 target compatibility
- **CSS Features**: Use features supported in Chrome extension context

### Security

- **Input Sanitization**: Validate all user inputs before storage
- **Storage Permissions**: Leverage existing "storage" permission in manifest
- **XSS Prevention**: Use textContent instead of innerHTML where possible

### Accessibility

- **Keyboard Navigation**: Tab order and keyboard shortcuts
- **Screen Readers**: Proper ARIA labels and descriptions
- **Focus Management**: Maintain focus when navigating between views
- **High Contrast**: Ensure settings UI works with high contrast themes

## Future Extensibility

The settings architecture is designed to easily accommodate additional settings:

### Planned Extension Points

1. **Theme Selection**: Light/dark mode toggle
2. **Keyboard Shortcuts**: Customizable hotkeys
3. **Search Behavior**: Additional search configuration options
4. **Tab Management**: Preferences for sorting and deduplication

### Settings Categories

Future settings can be organized into categories:

```typescript
interface IExtensionSettings {
  search: {
    resultsLimit: number;
    fuzzyThreshold: number;
  };
  appearance: {
    theme: 'light' | 'dark' | 'auto';
  };
  behavior: {
    autoClose: boolean;
  };
}
```

This design provides a solid foundation for the initial settings implementation while maintaining flexibility for future enhancements.