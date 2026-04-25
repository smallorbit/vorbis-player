import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUiV2 } from '../useUiV2';

function setSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

describe('useUiV2', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setSearch('');
  });

  it('returns false when neither env nor query param is set', () => {
    // #given — default test setup leaves search empty and VITE_UI_V2 unset

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

  it('removes its popstate listener on unmount', () => {
    // #given
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    // #when
    const { unmount } = renderHook(() => useUiV2());
    unmount();

    // #then
    expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
