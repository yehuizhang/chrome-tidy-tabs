/**
 * Jest setup file for Chrome extension testing
 * Mocks Chrome APIs and global objects
 */

// Mock Chrome storage API
const mockChromeStorage = {
  sync: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    getBytesInUse: jest.fn(),
    QUOTA_BYTES: 102400, // 100KB quota
    clear: jest.fn()
  }
};

// Mock Chrome API
const mockChrome = {
  storage: mockChromeStorage
};

// Set up global Chrome object (override the chrome-types declaration for testing)
(global as any).chrome = mockChrome;

// Mock console methods to reduce noise in tests
const originalConsole = {
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  error: console.error
};

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Reset mock implementations to default behavior
  mockChromeStorage.sync.get.mockResolvedValue({});
  mockChromeStorage.sync.set.mockResolvedValue(undefined);
  mockChromeStorage.sync.remove.mockResolvedValue(undefined);
  mockChromeStorage.sync.getBytesInUse.mockResolvedValue(0);
  mockChromeStorage.sync.clear.mockResolvedValue(undefined);
});

// Suppress console output during tests (optional)
beforeAll(() => {
  console.warn = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  Object.assign(console, originalConsole);
});

// Export mocks for use in tests
export { mockChromeStorage };