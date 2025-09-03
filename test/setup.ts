/**
 * Jest setup file for Chrome extension testing
 * Mocks Chrome APIs and global objects
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock Chrome storage API with persistent data
const mockStorageData: { [key: string]: any } = {};

const mockChromeStorage = {
  sync: {
    get: jest.fn().mockImplementation((keys?: string | string[] | null) => {
      if (!keys) {
        return Promise.resolve(mockStorageData);
      }
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: mockStorageData[keys] });
      }
      if (Array.isArray(keys)) {
        const result: { [key: string]: any } = {};
        keys.forEach(key => {
          if (key in mockStorageData) {
            result[key] = mockStorageData[key];
          }
        });
        return Promise.resolve(result);
      }
      return Promise.resolve({});
    }),
    set: jest.fn().mockImplementation((items: { [key: string]: any }) => {
      Object.assign(mockStorageData, items);
      return Promise.resolve();
    }),
    remove: jest.fn().mockImplementation((keys: string | string[]) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => delete mockStorageData[key]);
      return Promise.resolve();
    }),
    getBytesInUse: jest.fn().mockResolvedValue(0),
    QUOTA_BYTES: 102400, // 100KB quota
    clear: jest.fn().mockImplementation(() => {
      Object.keys(mockStorageData).forEach(key => delete mockStorageData[key]);
      return Promise.resolve();
    }),
  },
  local: {
    get: jest.fn().mockImplementation((keys?: string | string[] | null) => {
      if (!keys) {
        return Promise.resolve(mockStorageData);
      }
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: mockStorageData[keys] });
      }
      if (Array.isArray(keys)) {
        const result: { [key: string]: any } = {};
        keys.forEach(key => {
          if (key in mockStorageData) {
            result[key] = mockStorageData[key];
          }
        });
        return Promise.resolve(result);
      }
      return Promise.resolve({});
    }),
    set: jest.fn().mockImplementation((items: { [key: string]: any }) => {
      Object.assign(mockStorageData, items);
      return Promise.resolve();
    }),
    remove: jest.fn().mockImplementation((keys: string | string[]) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => delete mockStorageData[key]);
      return Promise.resolve();
    }),
    getBytesInUse: jest.fn().mockResolvedValue(0),
    clear: jest.fn().mockImplementation(() => {
      Object.keys(mockStorageData).forEach(key => delete mockStorageData[key]);
      return Promise.resolve();
    }),
  },
};

// Mock Chrome API
const mockChrome = {
  storage: mockChromeStorage,
};

// Set up global Chrome object (override the chrome-types declaration for testing)
(global as any).chrome = mockChrome;

// Mock console methods to reduce noise in tests
const originalConsole = {
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  error: console.error,
};

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();

  // Clear mock storage data completely
  Object.keys(mockStorageData).forEach(key => delete mockStorageData[key]);

  // Reset mock implementations to ensure clean state
  mockChromeStorage.sync.get.mockReset().mockImplementation((keys?: string | string[] | null) => {
    if (!keys) {
      return Promise.resolve(mockStorageData);
    }
    if (typeof keys === 'string') {
      return Promise.resolve({ [keys]: mockStorageData[keys] });
    }
    if (Array.isArray(keys)) {
      const result: { [key: string]: any } = {};
      keys.forEach(key => {
        if (key in mockStorageData) {
          result[key] = mockStorageData[key];
        }
      });
      return Promise.resolve(result);
    }
    return Promise.resolve({});
  });

  mockChromeStorage.sync.set.mockReset().mockImplementation((items: { [key: string]: any }) => {
    Object.assign(mockStorageData, items);
    return Promise.resolve();
  });

  // Reset local storage mocks as well
  mockChromeStorage.local.get.mockReset().mockImplementation((keys?: string | string[] | null) => {
    if (!keys) {
      return Promise.resolve(mockStorageData);
    }
    if (typeof keys === 'string') {
      return Promise.resolve({ [keys]: mockStorageData[keys] });
    }
    if (Array.isArray(keys)) {
      const result: { [key: string]: any } = {};
      keys.forEach(key => {
        if (key in mockStorageData) {
          result[key] = mockStorageData[key];
        }
      });
      return Promise.resolve(result);
    }
    return Promise.resolve({});
  });

  mockChromeStorage.local.set.mockReset().mockImplementation((items: { [key: string]: any }) => {
    Object.assign(mockStorageData, items);
    return Promise.resolve();
  });

  // Use real timers for async operations to work properly
  jest.useRealTimers();
});

// Suppress console output during tests (optional)
beforeAll(() => {
  console.warn = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  // Clean up any remaining timers
  jest.clearAllTimers();
});

afterAll(() => {
  // Restore original console methods
  Object.assign(console, originalConsole);
});

// Export mocks for use in tests
export { mockChromeStorage, mockStorageData };