import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it('returns the initial value when localStorage has no entry for the key', () => {
    // #when
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // #then
    expect(result.current[0]).toBe('initial');
  });

  it('returns the stored value when localStorage has data for the key', () => {
    // #given
    vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify('stored-value'));

    // #when
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // #then
    expect(result.current[0]).toBe('stored-value');
  });

  it('writes to localStorage when setValue is called with a direct value', () => {
    // #given
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // #when
    act(() => {
      result.current[1]('updated');
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('updated'));
    expect(result.current[0]).toBe('updated');
  });

  it('writes to localStorage when setValue is called with an updater function', () => {
    // #given
    vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify(10));
    const { result } = renderHook(() => useLocalStorage('counter', 0));

    // #when
    act(() => {
      result.current[1]((prev) => prev + 5);
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalledWith('counter', JSON.stringify(15));
    expect(result.current[0]).toBe(15);
  });

  it('falls back to the initial value and warns when stored JSON is malformed', () => {
    // #given
    vi.mocked(window.localStorage.getItem).mockReturnValue('not-valid-json{{');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // #when
    const { result } = renderHook(() => useLocalStorage('bad-json', 'fallback'));

    // #then
    expect(result.current[0]).toBe('fallback');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('bad-json'), expect.anything());

    warnSpy.mockRestore();
  });

  it('warns and still updates React state when localStorage.setItem throws', () => {
    // #given
    vi.mocked(window.localStorage.setItem).mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useLocalStorage('test-key', 'original'));

    // #when
    act(() => {
      result.current[1]('new-value');
    });

    // #then
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('test-key'), expect.anything());
    expect(result.current[0]).toBe('new-value');

    warnSpy.mockRestore();
  });

  it('syncs state from a StorageEvent fired by another tab', () => {
    // #given
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // #when
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'test-key',
          newValue: JSON.stringify('from-other-tab'),
        }),
      );
    });

    // #then
    expect(result.current[0]).toBe('from-other-tab');
  });

  it('ignores StorageEvents for unrelated keys', () => {
    // #given
    const { result } = renderHook(() => useLocalStorage('test-key', 'original'));

    // #when
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'other-key',
          newValue: JSON.stringify('should-not-apply'),
        }),
      );
    });

    // #then
    expect(result.current[0]).toBe('original');
  });

  it('removes the storage event listener when the hook unmounts', () => {
    // #given
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useLocalStorage('test-key', 0));

    // #when
    unmount();

    // #then
    expect(removeListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));

    removeListenerSpy.mockRestore();
  });
});
