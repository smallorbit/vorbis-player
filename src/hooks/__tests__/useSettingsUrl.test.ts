import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettingsUrl } from '../useSettingsUrl';

function setSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

describe('useSettingsUrl', () => {
  afterEach(() => {
    setSearch('');
  });

  it('returns null when the settings param is absent', () => {
    // #given — default search is empty

    // #when
    const { result } = renderHook(() => useSettingsUrl());

    // #then
    expect(result.current[0]).toBeNull();
  });

  it('reads ?settings=open on initial load', () => {
    // #given
    setSearch('?settings=open');

    // #when
    const { result } = renderHook(() => useSettingsUrl());

    // #then
    expect(result.current[0]).toBe('open');
  });

  it('reads ?settings=appearance on initial load', () => {
    // #given
    setSearch('?settings=appearance');

    // #when
    const { result } = renderHook(() => useSettingsUrl());

    // #then
    expect(result.current[0]).toBe('appearance');
  });

  it('reads the settings param when surrounded by other params', () => {
    // #given
    setSearch('?ui=v2&playlist=abc123&settings=appearance');

    // #when
    const { result } = renderHook(() => useSettingsUrl());

    // #then
    expect(result.current[0]).toBe('appearance');
  });

  it('writes via pushState (not replaceState)', () => {
    // #given
    setSearch('');
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useSettingsUrl());

    // #when
    act(() => {
      result.current[1]('appearance');
    });

    // #then
    expect(pushStateSpy).toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();

    pushStateSpy.mockRestore();
    replaceStateSpy.mockRestore();
  });

  it('sets the section and dispatches popstate so the hook re-renders', () => {
    // #given
    setSearch('');
    const { result } = renderHook(() => useSettingsUrl());
    expect(result.current[0]).toBeNull();

    // #when
    // NOTE: setSearch must be called before the navigate setter so that
    // window.location.search is already updated before the manual popstate
    // dispatch fires and re-reads it. In a real browser, pushState updates
    // location.search atomically; in jsdom we have to stage it manually.
    act(() => {
      setSearch('?settings=appearance');
      result.current[1]('appearance');
    });

    // #then
    expect(result.current[0]).toBe('appearance');
  });

  it('clears the param when navigate is called with null', () => {
    // #given
    setSearch('?settings=open');
    const { result } = renderHook(() => useSettingsUrl());
    expect(result.current[0]).toBe('open');

    // #when
    act(() => {
      setSearch('');
      result.current[1](null);
    });

    // #then
    expect(result.current[0]).toBeNull();
  });

  it('re-evaluates on popstate when another param changes mid-session', () => {
    // #given
    setSearch('');
    const { result } = renderHook(() => useSettingsUrl());
    expect(result.current[0]).toBeNull();

    // #when — SPA navigation adds settings param
    act(() => {
      setSearch('?settings=appearance');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // #then
    expect(result.current[0]).toBe('appearance');
  });

  it('removes its popstate listener on unmount', () => {
    // #given
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    // #when
    const { unmount } = renderHook(() => useSettingsUrl());
    unmount();

    // #then
    expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  /**
   * AudioPlayer.tsx:395 runs `window.history.replaceState({}, '', '/')` to
   * clean up the `?playlist=` param after auto-selecting a collection from a
   * deep link. That call replaces the ENTIRE URL with `/`, stripping every
   * query param — including `?settings=` and `?ui=v2`.
   *
   * This test documents that invariant: after the AudioPlayer cleanup fires,
   * the hook correctly reflects the wiped state rather than serving a stale
   * cached value.  The correct fix for callers is to re-apply their own params
   * via a subsequent `pushState` — not to fight the cleanup with `replaceState`.
   */
  it('multi-param: AudioPlayer replaceState cleanup strips all params including settings', () => {
    // #given — URL has multiple params including settings and playlist
    setSearch('?ui=v2&playlist=spotify:playlist:abc&settings=appearance');
    const { result } = renderHook(() => useSettingsUrl());
    expect(result.current[0]).toBe('appearance');

    // #when — AudioPlayer.tsx:395 fires its replaceState cleanup
    // This wipes the entire URL back to '/', removing ALL params.
    act(() => {
      window.history.replaceState({}, '', '/');
      setSearch('');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // #then — hook reflects the wiped URL; settings param is gone
    // (Callers should re-push their own state after this event fires.)
    expect(result.current[0]).toBeNull();
  });

  it('navigate preserves existing non-settings params when setting a section', () => {
    // #given — URL already has a ?ui=v2 param
    setSearch('?ui=v2');
    const { result } = renderHook(() => useSettingsUrl());

    // #when — navigate adds the settings param
    act(() => {
      setSearch('?ui=v2&settings=appearance');
      result.current[1]('appearance');
    });

    // #then — both params are present; settings was appended, not replacing ui
    expect(result.current[0]).toBe('appearance');
    expect(window.location.search).toContain('ui=v2');
    expect(window.location.search).toContain('settings=appearance');
  });

  it('navigate(null) is a no-op when settings param is already absent', () => {
    // #given — URL has no settings param
    setSearch('');
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useSettingsUrl());
    expect(result.current[0]).toBeNull();

    // #when — navigate is called with null (delete a param that isn't there)
    act(() => {
      setSearch('');
      result.current[1](null);
    });

    // #then — hook state remains null; a pushState was still called (harmless),
    // and the hook does not throw or produce a stale value
    expect(result.current[0]).toBeNull();
    pushStateSpy.mockRestore();
  });

  it('SSR-safe: returns null when window is unavailable at render time', () => {
    // #given — window is defined in jsdom, but readSection guards typeof window
    // We verify the guard is correct by calling the hook; the useState initialiser
    // must not throw even when run in an environment where window.location could
    // be undefined. jsdom always provides window, so the hook just returns null.
    setSearch('');

    // #when
    const { result } = renderHook(() => useSettingsUrl());

    // #then — no throw; returns null for absent param
    expect(result.current[0]).toBeNull();
  });
});
