import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  settingsGet,
  settingsPut,
  settingsClearStore,
  initSettingsDb,
  STORE_NAMES,
  _settingsDbTesting,
} from '@/services/settings/settingsDb';

async function resetDb(): Promise<void> {
  await initSettingsDb();

  const { db, fallbackStores } = _settingsDbTesting;
  fallbackStores[STORE_NAMES.PINS].clear();

  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAMES.PINS, 'readwrite');
      tx.objectStore(STORE_NAMES.PINS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  _settingsDbTesting.reset();
}

describe('settingsDb (IDB happy path)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns undefined for a key that has never been stored', async () => {
    // #when
    const result = await settingsGet(STORE_NAMES.PINS, 'missing-key');

    // #then
    expect(result).toBeUndefined();
  });

  it('round-trips a value: settingsPut then settingsGet returns the stored record', async () => {
    // #given
    const record = { key: 'pin-1', ids: ['a', 'b', 'c'] };

    // #when
    await settingsPut(STORE_NAMES.PINS, record);
    const result = await settingsGet<typeof record>(STORE_NAMES.PINS, 'pin-1');

    // #then
    expect(result).toEqual(record);
  });

  it('overwrites an existing record when settingsPut is called with the same key', async () => {
    // #given
    await settingsPut(STORE_NAMES.PINS, { key: 'pin-1', ids: ['old'] });

    // #when
    await settingsPut(STORE_NAMES.PINS, { key: 'pin-1', ids: ['new'] });
    const result = await settingsGet<{ key: string; ids: string[] }>(STORE_NAMES.PINS, 'pin-1');

    // #then
    expect(result?.ids).toEqual(['new']);
  });

  it('clears all records in the store after settingsClearStore', async () => {
    // #given
    await settingsPut(STORE_NAMES.PINS, { key: 'pin-1', ids: ['a'] });
    await settingsPut(STORE_NAMES.PINS, { key: 'pin-2', ids: ['b'] });

    // #when
    await settingsClearStore(STORE_NAMES.PINS);

    // #then
    expect(await settingsGet(STORE_NAMES.PINS, 'pin-1')).toBeUndefined();
    expect(await settingsGet(STORE_NAMES.PINS, 'pin-2')).toBeUndefined();
  });
});

describe('settingsDb (in-memory fallback mode)', () => {
  beforeEach(async () => {
    await resetDb();
    _settingsDbTesting.reset();
    // Force fallback mode by making initSettingsDb think IDB is missing
    Object.defineProperty(_settingsDbTesting, 'fallbackMode', {
      get() { return true; },
      configurable: true,
    });
    // Bypass the normal init by patching the module-level flag via reset + manual state
    // The cleanest way is to reset and then simulate fallback via the testing helper
    _settingsDbTesting.reset();
    // Patch indexedDB to force the error path on next init
    const originalIndexedDB = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    await initSettingsDb();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: originalIndexedDB,
      configurable: true,
      writable: true,
    });
  });

  it('returns undefined for a missing key in fallback mode', async () => {
    // #when
    const result = await settingsGet(STORE_NAMES.PINS, 'nonexistent');

    // #then
    expect(result).toBeUndefined();
  });

  it('round-trips a value using the in-memory store when IDB is unavailable', async () => {
    // #given
    const record = { key: 'fallback-pin', ids: ['x', 'y'] };

    // #when
    await settingsPut(STORE_NAMES.PINS, record);
    const result = await settingsGet<typeof record>(STORE_NAMES.PINS, 'fallback-pin');

    // #then
    expect(result).toEqual(record);
  });

  it('clears the in-memory store when settingsClearStore is called in fallback mode', async () => {
    // #given
    await settingsPut(STORE_NAMES.PINS, { key: 'fb-1', ids: ['a'] });

    // #when
    await settingsClearStore(STORE_NAMES.PINS);

    // #then
    expect(await settingsGet(STORE_NAMES.PINS, 'fb-1')).toBeUndefined();
  });
});
