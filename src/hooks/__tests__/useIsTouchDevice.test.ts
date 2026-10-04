import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsTouchDevice } from '../useIsTouchDevice';

function mediaQueryList(matches: boolean) {
  return {
    matches,
    media: '(pointer: coarse)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

describe('useIsTouchDevice', () => {
  afterEach(() => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      ...mediaQueryList(false),
      media: query,
    }));
  });

  it('reads pointer: coarse on the first render', () => {
    // #given
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      ...mediaQueryList(true),
      media: query,
    }));

    // #when
    const { result } = renderHook(() => useIsTouchDevice());

    // #then
    expect(result.current).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(pointer: coarse)');
  });

  it('updates when the coarse-pointer query changes', () => {
    // #given
    const queryList = mediaQueryList(false);
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      ...queryList,
      media: query,
    }));
    const { result } = renderHook(() => useIsTouchDevice());
    expect(result.current).toBe(false);

    // #when
    const handler = queryList.addEventListener.mock.calls[0]?.[1];
    act(() => {
      if (typeof handler === 'function') handler({ matches: true });
    });

    // #then
    expect(result.current).toBe(true);
  });
});
