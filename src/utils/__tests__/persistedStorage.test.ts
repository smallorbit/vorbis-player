import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LOCAL_STORAGE_CHANGE_EVENT } from '@/constants/events';
import {
  isLocalStorageChangeDetail,
  readLocalStorageRaw,
  removeLocalStorageKey,
  writeLocalStorageJson,
  writeLocalStorageRaw,
} from '@/utils/persistedStorage';

describe('persistedStorage', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReset();
    vi.mocked(window.localStorage.setItem).mockReset();
    vi.mocked(window.localStorage.removeItem).mockReset();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it('writeLocalStorageRaw persists the string and broadcasts the same-tab event', () => {
    // #given
    const seen: unknown[] = [];
    const onChange = (event: Event) => seen.push(event);
    window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, onChange);

    // #when
    writeLocalStorageRaw('test-key', 'raw-value');

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalledWith('test-key', 'raw-value');
    expect(seen).toHaveLength(1);
    const event = seen[0];
    expect(event).toBeInstanceOf(CustomEvent);
    if (event instanceof CustomEvent) {
      expect(isLocalStorageChangeDetail(event.detail)).toBe(true);
      expect(event.detail).toEqual({ key: 'test-key', newValue: 'raw-value' });
    }

    window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, onChange);
  });

  it('writeLocalStorageJson JSON-encodes the value before persisting', () => {
    // #when
    writeLocalStorageJson('test-key', { a: 1 });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalledWith('test-key', JSON.stringify({ a: 1 }));
  });

  it('removeLocalStorageKey deletes the key and broadcasts newValue null', () => {
    // #given
    const seen: unknown[] = [];
    const onChange = (event: Event) => seen.push(event);
    window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, onChange);

    // #when
    removeLocalStorageKey('test-key');

    // #then
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('test-key');
    const event = seen[0];
    expect(event).toBeInstanceOf(CustomEvent);
    if (event instanceof CustomEvent) {
      expect(event.detail).toEqual({ key: 'test-key', newValue: null });
    }

    window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, onChange);
  });

  it('readLocalStorageRaw returns the stored string', () => {
    // #given
    vi.mocked(window.localStorage.getItem).mockReturnValue('stored');

    // #then
    expect(readLocalStorageRaw('test-key')).toBe('stored');
  });

  it('writeLocalStorageRaw still broadcasts when setItem throws', () => {
    // #given
    vi.mocked(window.localStorage.setItem).mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onChange = vi.fn();
    window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, onChange);

    // #when
    writeLocalStorageRaw('test-key', 'value');

    // #then
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('test-key'), expect.anything());
    expect(onChange).toHaveBeenCalledOnce();

    window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, onChange);
    warnSpy.mockRestore();
  });

  it('isLocalStorageChangeDetail rejects malformed payloads', () => {
    expect(isLocalStorageChangeDetail(null)).toBe(false);
    expect(isLocalStorageChangeDetail({ key: 'x' })).toBe(false);
    expect(isLocalStorageChangeDetail({ key: 'x', newValue: 1 })).toBe(false);
    expect(isLocalStorageChangeDetail({ key: 'x', newValue: null })).toBe(true);
  });
});
