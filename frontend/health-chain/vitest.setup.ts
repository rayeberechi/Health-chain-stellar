import { beforeAll, afterEach, afterAll } from 'vitest';

// Setup global test environment
beforeAll(() => {
  // Mock sessionStorage
  const sessionStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
  });
});

afterEach(() => {
  // Clear sessionStorage after each test
  window.sessionStorage.clear();
});

afterAll(() => {
  // Cleanup
});
