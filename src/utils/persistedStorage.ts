import { LOCAL_STORAGE_CHANGE_EVENT } from '@/constants/events';

export interface LocalStorageChangeDetail {
  key: string;
  /** Serialized payload, or `null` when the key was removed (reset to initial). */
  newValue: string | null;
}

export function isLocalStorageChangeDetail(value: unknown): value is LocalStorageChangeDetail {
  if (typeof value !== 'object' || value === null) return false;
  if (!('key' in value) || !('newValue' in value)) return false;
  return typeof value.key === 'string' && (value.newValue === null || typeof value.newValue === 'string');
}

function dispatchLocalStorageChange(key: string, newValue: string | null): void {
  window.dispatchEvent(
    new CustomEvent<LocalStorageChangeDetail>(LOCAL_STORAGE_CHANGE_EVENT, {
      detail: { key, newValue },
    }),
  );
}

export function readLocalStorageRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`Failed to read "${key}" from localStorage:`, error);
    return null;
  }
}

export function writeLocalStorageRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Failed to write "${key}" to localStorage:`, error);
  }
  dispatchLocalStorageChange(key, value);
}

export function writeLocalStorageJson(key: string, value: unknown): void {
  writeLocalStorageRaw(key, JSON.stringify(value));
}

export function removeLocalStorageKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove "${key}" from localStorage:`, error);
  }
  dispatchLocalStorageChange(key, null);
}
