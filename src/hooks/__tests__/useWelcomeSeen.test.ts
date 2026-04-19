import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWelcomeSeen, WELCOME_SEEN_STORAGE_KEY } from '../useWelcomeSeen';

describe('useWelcomeSeen', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it('defaults to false when localStorage is empty', () => {
    // #when
    const { result } = renderHook(() => useWelcomeSeen());

    // #then
    expect(result.current[0]).toBe(false);
  });

  it('can be set to true', () => {
    // #given
    const { result } = renderHook(() => useWelcomeSeen());

    // #when
    act(() => {
      result.current[1](true);
    });

    // #then
    expect(result.current[0]).toBe(true);
  });

  it('persists to localStorage under the vorbis-player-welcome-seen key', () => {
    // #given
    const { result } = renderHook(() => useWelcomeSeen());

    // #when
    act(() => {
      result.current[1](true);
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      WELCOME_SEEN_STORAGE_KEY,
      'true',
    );
  });

  it('reads initial value from localStorage when already seen', () => {
    // #given
    vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
      if (key === WELCOME_SEEN_STORAGE_KEY) return 'true';
      return null;
    });

    // #when
    const { result } = renderHook(() => useWelcomeSeen());

    // #then
    expect(result.current[0]).toBe(true);
  });

  it('exposes the correct storage key constant', () => {
    // #then
    expect(WELCOME_SEEN_STORAGE_KEY).toBe('vorbis-player-welcome-seen');
  });
});
