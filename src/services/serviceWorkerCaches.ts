/**
 * Cache Storage housekeeping for the Workbox service worker (#1716).
 *
 * Workbox owns its precache (`workbox-precache-*`) and expires its runtime
 * caches, but two things are left to the page: deleting the caches the
 * pre-Workbox `sw.js` created (`vap-*`, which held authenticated Spotify API
 * responses), and dropping runtime caches on logout so the next account does
 * not inherit the previous one's artwork.
 */

import { logCaughtError } from '@/utils/logCaughtError';

const LEGACY_CACHE_PREFIX = 'vap-';
const WORKBOX_PRECACHE_PREFIX = 'workbox-precache';

async function deleteCachesWhere(shouldDelete: (name: string) => boolean): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter(shouldDelete).map((name) => caches.delete(name)));
  } catch (err) {
    logCaughtError('serviceWorkerCaches.deleteCachesWhere', err);
  }
}

export function purgeLegacyServiceWorkerCaches(): Promise<void> {
  return deleteCachesWhere((name) => name.startsWith(LEGACY_CACHE_PREFIX));
}

/** Everything except the app-shell precache, which holds no user data. */
export function purgeRuntimeCaches(): Promise<void> {
  return deleteCachesWhere((name) => !name.startsWith(WORKBOX_PRECACHE_PREFIX));
}
