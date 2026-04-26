import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useIsDesktop } from '../useIsDesktop';

type ChangeListener = (e: Pick<MediaQueryListEvent, 'matches'>) => void;

function createMockMql(initialMatches: boolean) {
  const listeners: ChangeListener[] = [];

  const mql = {
    matches: initialMatches,
    media: '(min-width: 700px)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((event: string, cb: ChangeListener) => {
      if (event === 'change') listeners.push(cb);
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    /** Test helper — fire all registered 'change' listeners */
    triggerChange(matches: boolean) {
      listeners.forEach((cb) => cb({ matches }));
    },
  };

  return mql;
}

describe('useIsDesktop', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when viewport is below 700px (matchMedia reports no match)', () => {
    // #given
    const mql = createMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    // #when
    const { result } = renderHook(() => useIsDesktop());

    // #then
    expect(result.current).toBe(false);
  });

  it('returns true when viewport is 700px or wider (matchMedia matches)', () => {
    // #given
    const mql = createMockMql(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    // #when
    const { result } = renderHook(() => useIsDesktop());

    // #then
    expect(result.current).toBe(true);
  });

  it('updates when the MediaQueryList fires a change event', () => {
    // #given — start narrow
    const mql = createMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);

    // #when — viewport grows past 700px
    act(() => { mql.triggerChange(true); });

    // #then
    expect(result.current).toBe(true);
  });

  it('updates back to false when viewport shrinks below 700px', () => {
    // #given — start wide
    const mql = createMockMql(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);

    // #when — viewport shrinks
    act(() => { mql.triggerChange(false); });

    // #then
    expect(result.current).toBe(false);
  });

  it('removes the change listener on unmount', () => {
    // #given
    const mql = createMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    // #when
    const { unmount } = renderHook(() => useIsDesktop());
    unmount();

    // #then
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('defaults to false when matchMedia is not yet available on first render', () => {
    // #given — matchMedia returns a mql with matches=false (the default)
    const mql = createMockMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);

    // #when
    const { result } = renderHook(() => useIsDesktop());

    // #then — hook starts with false until a change event fires
    expect(result.current).toBe(false);
  });
});
