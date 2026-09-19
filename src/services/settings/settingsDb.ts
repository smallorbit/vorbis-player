/**
 * IndexedDB-based persistent store for application settings (pins, preferences, etc.).
 *
 * Built on the shared IndexedDB foundation (`src/services/idb`) — same lifecycle
 * and degradation policy as the library cache and Dropbox caches.
 */

import { createIdbDatabase, type IdbDatabaseHandle } from '@/services/idb';

export const STORE_NAMES = { PINS: 'pins' } as const;

const DB_NAME = 'vorbis-player-settings';
const DB_VERSION = 1;

const handle: IdbDatabaseHandle = createIdbDatabase({
  name: DB_NAME,
  version: DB_VERSION,
  logLabel: 'settingsDb',
  stores: [
    {
      name: STORE_NAMES.PINS,
      keyMode: { kind: 'keyPath', keyPath: 'key' },
    },
  ],
});

const pins = handle.getStore<{ key: string } & Record<string, unknown>>(STORE_NAMES.PINS);

/**
 * Initialize the settings database.
 * Safe to call multiple times -- subsequent calls return the same promise.
 */
export async function initSettingsDb(): Promise<void> {
  return handle.init();
}

export async function settingsGet<T>(store: string, key: string): Promise<T | undefined> {
  if (store !== STORE_NAMES.PINS) {
    throw new Error(`[settingsDb] Unknown store: ${store}`);
  }
  return pins.get(key) as Promise<T | undefined>;
}

export async function settingsPut<T extends { key: string }>(store: string, value: T): Promise<void> {
  if (store !== STORE_NAMES.PINS) {
    throw new Error(`[settingsDb] Unknown store: ${store}`);
  }
  await pins.put(value.key, value);
}

export async function settingsClearStore(store: string): Promise<void> {
  if (store !== STORE_NAMES.PINS) {
    throw new Error(`[settingsDb] Unknown store: ${store}`);
  }
  await pins.clear();
}

/** Exported for testing only. */
export const _settingsDbTesting = {
  get fallbackMode() {
    return handle.isFallback();
  },
  get db() {
    return handle.getDb();
  },
  get fallbackStores() {
    return {
      [STORE_NAMES.PINS]: handle.getFallbackMap(STORE_NAMES.PINS),
    };
  },
  reset(): void {
    handle.close();
  },
};
