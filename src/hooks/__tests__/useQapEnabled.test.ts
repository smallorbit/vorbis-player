import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQapEnabled } from '../useQapEnabled';

describe('useQapEnabled', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it('defaults to false when localStorage is empty', () => {
    // #when
    const { result } = renderHook(() => useQapEnabled());

    // #then
    expect(result.current[0]).toBe(false);
  });

  it('can be set to true', () => {
    // #given
    const { result } = renderHook(() => useQapEnabled());

    // #when
    act(() => {
      result.current[1](true);
    });

    // #then
    expect(result.current[0]).toBe(true);
  });

  it('persists to localStorage under the correct key', () => {
    // #given
    const { result } = renderHook(() => useQapEnabled());

    // #when
    act(() => {
      result.current[1](true);
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'vorbis-player-qap-enabled',
      'true'
    );
  });

  it('reads initial value from localStorage', () => {
    // #given
    vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'vorbis-player-qap-enabled') return 'true';
      return null;
    });

    // #when
    const { result } = renderHook(() => useQapEnabled());

    // #then
    expect(result.current[0]).toBe(true);
  });
});
