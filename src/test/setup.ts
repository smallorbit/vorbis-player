import '@testing-library/jest-dom';

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SPOTIFY_CLIENT_ID: 'test-client-id',
    VITE_SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:3000/auth/spotify/callback',
    MODE: 'test',
    PROD: false,
    DEV: false
  },
  writable: true
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://127.0.0.1:3000',
    pathname: '/',
    search: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn()
  },
  writable: true
});

// Mock window.history
Object.defineProperty(window, 'history', {
  value: {
    replaceState: vi.fn(),
    pushState: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    go: vi.fn()
  },
  writable: true
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock crypto for Spotify PKCE
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      digest: vi.fn(() => Promise.resolve(new ArrayBuffer(32)))
    }
  },
  writable: true
});

// Mock btoa/atob
global.btoa = vi.fn((str) => Buffer.from(str, 'binary').toString('base64'));
global.atob = vi.fn((b64) => Buffer.from(b64, 'base64').toString('binary'));

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();
});