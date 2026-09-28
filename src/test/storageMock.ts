import { vi } from 'vitest';

/**
 * In-memory Storage backed by a Map. Methods are `vi.fn` wrappers so tests can
 * assert call counts while still persisting values (unlike bare mocks in setup).
 */
export function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    key: vi.fn((index: number): string | null => {
      const keys = [...store.keys()];
      return keys[index] ?? null;
    }),
    getItem: vi.fn((key: string): string | null => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string): void => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string): void => {
      store.delete(key);
    }),
    clear: vi.fn((): void => {
      store.clear();
    }),
  };
}
