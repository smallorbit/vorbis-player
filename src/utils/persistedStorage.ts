import { LOCAL_STORAGE_CHANGE_EVENT } from '@/constants/events';
import { logCaughtError } from '@/utils/logCaughtError';

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
    logCaughtError(`persistedStorage.read(${key})`, error);
    return null;
  }
}

export function writeLocalStorageRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // Still broadcast so same-tab listeners stay consistent with the writer's
    // in-memory intent (quota / private-mode failures).
    logCaughtError(`persistedStorage.write(${key})`, error);
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
    logCaughtError(`persistedStorage.remove(${key})`, error);
  }
  dispatchLocalStorageChange(key, null);
}
