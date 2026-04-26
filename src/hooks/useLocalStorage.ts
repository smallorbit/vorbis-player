import { useState, useEffect, useCallback } from 'react';

const SAME_TAB_STORAGE_EVENT = 'vorbis-player:localStorage';

interface SameTabStorageDetail {
  key: string;
  newValue: string;
}

export const useLocalStorage = <T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
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

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      // Dispatch lives inside the updater so callers can batch many setValue
      // calls in one render (e.g. a `for` loop in `act`) and have each one
      // observe the previously-queued value via `prevStoredValue`. Other
      // instances' listeners receive the synchronous dispatch and call
      // `setStoredValue` on themselves; React 18 absorbs that nested update
      // into the same batch.
      setStoredValue((prevStoredValue) => {
        const valueToStore = value instanceof Function ? value(prevStoredValue) : value;
        const serialized = JSON.stringify(valueToStore);

        try {
          window.localStorage.setItem(key, serialized);
          window.dispatchEvent(
            new CustomEvent<SameTabStorageDetail>(SAME_TAB_STORAGE_EVENT, {
              detail: { key, newValue: serialized },
            }),
          );
        } catch (error) {
          console.warn(`Failed to write "${key}" to localStorage:`, error);
        }

        return valueToStore;
      });
    },
    [key]
  );

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

    const handleSameTabChange = (e: Event) => {
      const detail = (e as CustomEvent<SameTabStorageDetail>).detail;
      if (!detail || detail.key !== key) return;
      try {
        setStoredValue(JSON.parse(detail.newValue));
      } catch (error) {
        console.warn(`Failed to parse "${key}" from same-tab storage event:`, error);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(SAME_TAB_STORAGE_EVENT, handleSameTabChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(SAME_TAB_STORAGE_EVENT, handleSameTabChange);
    };
  }, [key]);

  return [storedValue, setValue];
};
