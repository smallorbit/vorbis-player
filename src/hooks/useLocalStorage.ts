/**
 * @fileoverview useLocalStorage Hook
 * 
 * Generic hook for managing persistent state with localStorage.
 * Handles JSON serialization, error handling, and automatic persistence.
 * 
 * @architecture
 * This hook provides a simple API similar to useState but with automatic
 * localStorage persistence. It centralizes all localStorage logic and makes
 * it easy to mock/test.
 * 
 * @usage
 * ```typescript
 * const [value, setValue] = useLocalStorage('my-key', defaultValue);
 * ```
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * useLocalStorage - Generic hook for persistent state with localStorage
 * 
 * Manages state that persists across browser sessions using localStorage.
 * Handles JSON serialization, error handling, and multi-tab synchronization.
 * 
 * @template T - The type of value being stored
 * @param key - The localStorage key
 * @param initialValue - The default value if nothing is stored
 * @returns [value, setValue] - Similar to useState but with persistence
 * 
 * @example
 * ```typescript
 * const [theme, setTheme] = useLocalStorage('app-theme', 'light');
 * const [filters, setFilters] = useLocalStorage('album-filters', defaultFilters);
 * ```
 */
export const useLocalStorage = <T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] => {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      if (item) {
        return JSON.parse(item);
      }
      return initialValue;
    } catch (error) {
      console.warn(`Failed to read "${key}" from localStorage:`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      // Allow value to be a function so we have same API as useState
      setStoredValue((prevStoredValue) => {
        const valueToStore = value instanceof Function ? value(prevStoredValue) : value;
        
        try {
          // Save to local storage
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
          console.warn(`Failed to write "${key}" to localStorage:`, error);
        }
        
        return valueToStore;
      });
    },
    [key]
  );

  // Listen for changes in other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.warn(`Failed to parse "${key}" from storage event:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  return [storedValue, setValue];
};
