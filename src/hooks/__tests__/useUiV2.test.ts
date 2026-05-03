import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/constants/storage';
import { useUiV2 } from '../useUiV2';

function setSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

const memoryStorage = new Map<string, string>();

function installMemoryLocalStorage(): void {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => memoryStorage.set(key, value),
      removeItem: (key: string) => memoryStorage.delete(key),
      clear: () => memoryStorage.clear(),
    },
    writable: true,
    configurable: true,
  });
}

describe('useUiV2', () => {
  beforeEach(() => {
    memoryStorage.clear();
    installMemoryLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    setSearch('');
    memoryStorage.clear();
  });

  it('returns false when neither env nor query param nor persistence is set', () => {
    // #given — default test setup leaves all signals unset

    // #when
    const { result } = renderHook(() => useUiV2());

    // #then
    expect(result.current).toBe(false);
  });

  it('returns true when VITE_UI_V2 env var is set to "true"', () => {
    // #given
    vi.stubEnv('VITE_UI_V2', 'true');

    // #when
    const { result } = renderHook(() => useUiV2());

    // #then
    expect(result.current).toBe(true);
  });

  it('returns false when VITE_UI_V2 is set to a non-"true" value', () => {
    // #given
    vi.stubEnv('VITE_UI_V2', 'false');

    // #when
    const { result } = renderHook(() => useUiV2());

    // #then
    expect(result.current).toBe(false);
  });

  it('returns true when location.search contains ui=v2', () => {
    // #given
    setSearch('?ui=v2');

    // #when
    const { result } = renderHook(() => useUiV2());

    // #then
    expect(result.current).toBe(true);
  });

  it('returns true when ui=v2 is one of several query params', () => {
    // #given
    setSearch('?foo=bar&ui=v2&baz=1');

    // #when
    const { result } = renderHook(() => useUiV2());

    // #then
    expect(result.current).toBe(true);
  });

  it('returns false for ui values other than "v2"', () => {
    // #given
    setSearch('?ui=v3');

    // #when
    const { result } = renderHook(() => useUiV2());

    // #then
    expect(result.current).toBe(false);
  });

  it('re-evaluates on popstate when query param changes mid-session', () => {
    // #given
    setSearch('');
    const { result } = renderHook(() => useUiV2());
    expect(result.current).toBe(false);

    // #when — SPA navigation flips the flag without a reload
    act(() => {
      setSearch('?ui=v2');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // #then
    expect(result.current).toBe(true);
  });

  it('removes its popstate and storage listeners on unmount', () => {
    // #given
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    // #when
    const { unmount } = renderHook(() => useUiV2());
    unmount();

    // #then
    expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  describe('localStorage persistence signal', () => {
    it('returns true when the persistence key is set, even without ui=v2 in the URL', () => {
      // #given
      memoryStorage.set(STORAGE_KEYS.SETTINGS_V2_ENABLED, JSON.stringify(true));
      setSearch('');

      // #when
      const { result } = renderHook(() => useUiV2());

      // #then
      expect(result.current).toBe(true);
    });

    it('returns false when the persistence key is set to false and no other signal is on', () => {
      // #given
      memoryStorage.set(STORAGE_KEYS.SETTINGS_V2_ENABLED, JSON.stringify(false));
      setSearch('');

      // #when
      const { result } = renderHook(() => useUiV2());

      // #then
      expect(result.current).toBe(false);
    });

    it('returns true when persistence is true even if URL lacks ui=v2 (OR semantics)', () => {
      // #given — URL has no opt-in flag, but persistence is on
      memoryStorage.set(STORAGE_KEYS.SETTINGS_V2_ENABLED, JSON.stringify(true));
      setSearch('?other=param');

      // #when
      const { result } = renderHook(() => useUiV2());

      // #then — there is no URL-based opt-out path; persistence wins
      expect(result.current).toBe(true);
    });

    it('returns false when persistence is unset (null) and no other signal is on', () => {
      // #given — key absent from storage
      setSearch('');

      // #when
      const { result } = renderHook(() => useUiV2());

      // #then
      expect(result.current).toBe(false);
    });

    it('re-evaluates on cross-tab storage events when the persistence key flips', () => {
      // #given
      setSearch('');
      const { result } = renderHook(() => useUiV2());
      expect(result.current).toBe(false);

      // #when — another tab writes the key and emits a storage event
      act(() => {
        memoryStorage.set(STORAGE_KEYS.SETTINGS_V2_ENABLED, JSON.stringify(true));
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: STORAGE_KEYS.SETTINGS_V2_ENABLED,
            newValue: JSON.stringify(true),
          }),
        );
      });

      // #then
      expect(result.current).toBe(true);
    });

    it('ignores storage events for unrelated keys', () => {
      // #given
      setSearch('');
      const { result } = renderHook(() => useUiV2());
      expect(result.current).toBe(false);

      // #when — an unrelated key changes
      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'some-other-key',
            newValue: 'true',
          }),
        );
      });

      // #then
      expect(result.current).toBe(false);
    });

    it('treats malformed JSON in the persistence key as not-enabled', () => {
      // #given
      memoryStorage.set(STORAGE_KEYS.SETTINGS_V2_ENABLED, '{not-json');
      setSearch('');

      // #when
      const { result } = renderHook(() => useUiV2());

      // #then
      expect(result.current).toBe(false);
    });
  });
});
