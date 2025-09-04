/// <reference types="jest" />
import '@testing-library/jest-dom';

// Zusätzliche Sicherstellung für import.meta (falls jest.setup.js nicht ausreicht)
if (typeof globalThis !== 'undefined' && !(globalThis as any).import?.meta) {
  (globalThis as any).import = {
    meta: {
      env: {
        VITE_SERVER_URL: 'http://localhost:3001'
      }
    }
  };
}

// Mock für Socket.IO
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    close: jest.fn(),
    id: 'test-socket-id'
  }))
}));

// Mock für localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
globalThis.localStorage = localStorageMock as any;

// Mock für matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Cleanup nach jedem Test
afterEach(() => {
  jest.clearAllMocks();
});
