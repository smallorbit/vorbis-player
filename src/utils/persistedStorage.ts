import { LOCAL_STORAGE_CHANGE_EVENT, dispatchAppEvent } from '@/constants/events';
import type { LocalStorageChangeDetail } from '@/constants/events';
import { logCaughtError } from '@/utils/logCaughtError';

export function isLocalStorageChangeDetail(value: unknown): value is LocalStorageChangeDetail {
  if (typeof value !== 'object' || value === null) return false;
  if (!('key' in value) || !('newValue' in value)) return false;
  return typeof value.key === 'string' && (value.newValue === null || typeof value.newValue === 'string');
}

function dispatchLocalStorageChange(key: string, newValue: string | null): void {
  dispatchAppEvent(LOCAL_STORAGE_CHANGE_EVENT, { key, newValue });
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
