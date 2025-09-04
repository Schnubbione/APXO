// Jest setup file - runs before all tests
// This file sets up global mocks that need to be available before test files are loaded

// Mock import.meta globally
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_SERVER_URL: 'http://localhost:3001'
      }
    }
  },
  configurable: true,
  writable: true
});

// Ensure import.meta is also available as a direct property
if (typeof globalThis !== 'undefined') {
  globalThis.import = globalThis.import || {
    meta: {
      env: {
        VITE_SERVER_URL: 'http://localhost:3001'
      }
    }
  };
}
