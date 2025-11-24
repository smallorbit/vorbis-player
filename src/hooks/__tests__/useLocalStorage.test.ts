import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

// Mock localStorage since it's not available in all test environments
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

describe('useLocalStorage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('should initialize with the provided initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [value] = result.current;
    expect(value).toBe('initial');
  });

  it('should read value from localStorage on initialization', () => {
    localStorageMock.setItem('test-key', JSON.stringify('stored-value'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [value] = result.current;
    expect(value).toBe('stored-value');
  });

  it('should update localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    
    act(() => {
      const [, setValue] = result.current;
      setValue('updated');
    });

    const storedValue = localStorageMock.getItem('test-key');
    expect(storedValue).toBe(JSON.stringify('updated'));
  });

  it('should support function updates like useState', () => {
    const { result } = renderHook(() => useLocalStorage('counter', 0));
    
    act(() => {
      const [, setValue] = result.current;
      setValue(prev => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  it('should handle complex objects', () => {
    const initialObj = { name: 'test', values: [1, 2, 3] };
    const { result } = renderHook(() => useLocalStorage('obj-key', initialObj));

    act(() => {
      const [, setValue] = result.current;
      setValue({ name: 'updated', values: [4, 5, 6] });
    });

    const [value] = result.current;
    expect(value).toEqual({ name: 'updated', values: [4, 5, 6] });
    expect(localStorageMock.getItem('obj-key')).toBe(JSON.stringify({ name: 'updated', values: [4, 5, 6] }));
  });

  it('should handle JSON parse errors gracefully', () => {
    localStorageMock.setItem('bad-json', 'not-valid-json');
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useLocalStorage('bad-json', 'fallback'));
    const [value] = result.current;

    expect(value).toBe('fallback');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle localStorage quota exceeded gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Suppress React error boundary warnings for this test
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock localStorage.setItem to throw QuotaExceededError
    const failingStorage = {
      getItem: (key: string) => localStorageMock.getItem(key),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: (key: string) => localStorageMock.removeItem(key),
      clear: () => localStorageMock.clear()
    };

    Object.defineProperty(window, 'localStorage', {
      value: failingStorage,
      writable: true
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    
    try {
      act(() => {
        const [, setValue] = result.current;
        setValue('new-value');
      });
    } catch {
      // Expected error from React boundary
    }

    expect(consoleSpy).toHaveBeenCalled();

    // Restore original localStorage
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should handle different data types', () => {
    const { result: stringResult } = renderHook(() => useLocalStorage('string', 'hello'));
    const { result: numberResult } = renderHook(() => useLocalStorage('number', 42));
    const { result: booleanResult } = renderHook(() => useLocalStorage('boolean', true));
    const { result: arrayResult } = renderHook(() => useLocalStorage('array', [1, 2, 3]));

    expect(stringResult.current[0]).toBe('hello');
    expect(numberResult.current[0]).toBe(42);
    expect(booleanResult.current[0]).toBe(true);
    expect(arrayResult.current[0]).toEqual([1, 2, 3]);
  });
});
