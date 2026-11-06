import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  purgeLegacyServiceWorkerCaches,
  purgeRuntimeCaches,
} from '../serviceWorkerCaches';

const CACHE_NAMES = [
  'vap-static-v2.1.0',
  'vap-dynamic-v2.1.0-spotify',
  'workbox-precache-v2-http://127.0.0.1:3000/',
  'spotify-artwork',
];

function stubCacheStorage(names: string[]) {
  const remaining = new Set(names);
  const cacheStorage = {
    keys: vi.fn(async () => [...remaining]),
    delete: vi.fn(async (name: string) => remaining.delete(name)),
  };
  vi.stubGlobal('caches', cacheStorage);
  return remaining;
}

describe('serviceWorkerCaches', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('purgeLegacyServiceWorkerCaches', () => {
    it('deletes only the pre-Workbox vap-* caches', async () => {
      // #given
      const remaining = stubCacheStorage(CACHE_NAMES);

      // #when
      await purgeLegacyServiceWorkerCaches();

      // #then
      expect([...remaining]).toEqual([
        'workbox-precache-v2-http://127.0.0.1:3000/',
        'spotify-artwork',
      ]);
    });
  });

  describe('purgeRuntimeCaches', () => {
    it('keeps the app-shell precache and deletes every other cache', async () => {
      // #given
      const remaining = stubCacheStorage(CACHE_NAMES);

      // #when
      await purgeRuntimeCaches();

      // #then
      expect([...remaining]).toEqual(['workbox-precache-v2-http://127.0.0.1:3000/']);
    });
  });

  describe('without Cache Storage', () => {
    beforeEach(() => {
      vi.stubGlobal('caches', undefined);
    });

    it('resolves without throwing', async () => {
      // #when / #then
      await expect(purgeRuntimeCaches()).resolves.toBeUndefined();
    });
  });

  it('swallows and logs Cache Storage failures', async () => {
    // #given
    vi.stubGlobal('caches', { keys: vi.fn().mockRejectedValue(new Error('SecurityError')) });

    // #when / #then
    await expect(purgeRuntimeCaches()).resolves.toBeUndefined();
  });
});
