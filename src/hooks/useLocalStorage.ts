import { useState, useEffect, useCallback, useRef } from 'react';
import { LOCAL_STORAGE_CHANGE_EVENT } from '@/constants/events';
import {
  isLocalStorageChangeDetail,
  readLocalStorageRaw,
  writeLocalStorageJson,
} from '@/utils/persistedStorage';

export const useLocalStorage = <T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] => {
  // Capture the mount-time default only. Reset-on-remove must not adopt a
  // freshly allocated object/literal from a later render.
  const initialValueRef = useRef(initialValue);

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = readLocalStorageRaw(key);
      if (item) {
        return JSON.parse(item) as T;
      }
      return initialValue;
    } catch (error) {
      console.warn(`Failed to read "${key}" from localStorage:`, error);
      return initialValue;
    }
  });

  const storedValueRef = useRef(storedValue);
  storedValueRef.current = storedValue;
  const skipEchoRef = useRef(false);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      const valueToStore = value instanceof Function ? value(storedValueRef.current) : value;
      storedValueRef.current = valueToStore;
      skipEchoRef.current = true;
      writeLocalStorageJson(key, valueToStore);
      setStoredValue(valueToStore);
    },
    [key],
  );

  const applyIncomingValue = useCallback((newValue: string | null) => {
    if (newValue === null) {
      storedValueRef.current = initialValueRef.current;
      setStoredValue(initialValueRef.current);
      return;
    }
    try {
      const parsed = JSON.parse(newValue) as T;
      storedValueRef.current = parsed;
      setStoredValue(parsed);
    } catch (error) {
      console.warn(`Failed to parse "${key}" from storage event:`, error);
    }
  }, [key]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        applyIncomingValue(e.newValue);
      }
    };

    const handleSameTabChange = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      if (!isLocalStorageChangeDetail(event.detail)) return;
      if (event.detail.key !== key) return;
      if (skipEchoRef.current) {
        skipEchoRef.current = false;
        return;
      }
      applyIncomingValue(event.detail.newValue);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleSameTabChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleSameTabChange);
    };
  }, [key, applyIncomingValue]);

  return [storedValue, setValue];
};
