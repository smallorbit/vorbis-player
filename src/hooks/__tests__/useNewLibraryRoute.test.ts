import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNewLibraryRoute } from '../useNewLibraryRoute';

describe('useNewLibraryRoute', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it('defaults to false when localStorage is empty', () => {
    // #when
    const { result } = renderHook(() => useNewLibraryRoute());

    // #then
    expect(result.current[0]).toBe(false);
  });

  it('can be set to true', () => {
    // #given
    const { result } = renderHook(() => useNewLibraryRoute());

    // #when
    act(() => {
      result.current[1](true);
    });

    // #then
    expect(result.current[0]).toBe(true);
  });

  it('can be set back to false', () => {
    // #given
    const { result } = renderHook(() => useNewLibraryRoute());
    act(() => {
      result.current[1](true);
    });

    // #when
    act(() => {
      result.current[1](false);
    });

    // #then
    expect(result.current[0]).toBe(false);
  });

  it('persists to localStorage under the correct key', () => {
    // #given
    const { result } = renderHook(() => useNewLibraryRoute());

    // #when
    act(() => {
      result.current[1](true);
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'vorbis-player-new-library-route',
      'true'
    );
  });

  it('reads initial value from localStorage', () => {
    // #given
    vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'vorbis-player-new-library-route') return 'true';
      return null;
    });

    // #when
    const { result } = renderHook(() => useNewLibraryRoute());

    // #then
    expect(result.current[0]).toBe(true);
  });

  it('returns a setter as the second tuple element', () => {
    // #when
    const { result } = renderHook(() => useNewLibraryRoute());

    // #then
    expect(typeof result.current[1]).toBe('function');
  });
});
