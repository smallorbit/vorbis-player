import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MediaCollection } from '@/types/domain';

vi.mock('../dropboxArtCache', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '../dropboxArtCache';
import {
  getCachedCatalog,
  putCatalogCache,
  clearCatalogCache,
  CATALOG_TTL_MS,
} from '../dropboxCatalogCache';

const DB_NAME = 'vorbis-dropbox-art-test';
const DB_VERSION = 2;

function openTestDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME + '-' + Math.random(), DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('art')) {
        db.createObjectStore('art', { keyPath: 'path' });
      }
      if (!db.objectStoreNames.contains('catalog')) {
        db.createObjectStore('catalog', { keyPath: 'key' });
      }
    };
  });
}

function makeCollection(id: string, name?: string): MediaCollection {
  return {
    id,
    provider: 'dropbox',
    kind: 'folder',
    name: name ?? `Collection ${id}`,
  };
}

let testDb: IDBDatabase;

beforeEach(async () => {
  testDb = await openTestDb();
  vi.mocked(getDb).mockResolvedValue(testDb);
});

describe('dropboxCatalogCache', () => {
  describe('getCachedCatalog', () => {
    it('returns null when nothing cached', async () => {
      // #when
      const result = await getCachedCatalog();

      // #then
      expect(result).toBeNull();
    });
  });

  describe('putCatalogCache / getCachedCatalog', () => {
    it('returns the stored collections with isStale: false immediately after writing', async () => {
      // #given
      const collections = [makeCollection('c1', 'Jazz'), makeCollection('c2', 'Rock')];

      // #when
      await putCatalogCache(collections);

      // wait for the fire-and-forget transaction to finish
      await new Promise((resolve) => setTimeout(resolve, 20));

      const result = await getCachedCatalog();

      // #then
      expect(result).not.toBeNull();
      expect(result!.collections).toHaveLength(2);
      expect(result!.collections.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
      expect(result!.isStale).toBe(false);
    });

    it('returns isStale: true when cache is older than CATALOG_TTL_MS', async () => {
      // #given — write a cache entry backdated past the TTL
      const collections = [makeCollection('c1')];
      const oldTimestamp = Date.now() - CATALOG_TTL_MS - 1000;

      await new Promise<void>((resolve, reject) => {
        const tx = testDb.transaction('catalog', 'readwrite');
        tx.objectStore('catalog').put({ key: 'collections', collections, cachedAt: oldTimestamp });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // #when
      const result = await getCachedCatalog();

      // #then
      expect(result).not.toBeNull();
      expect(result!.isStale).toBe(true);
      expect(result!.collections).toHaveLength(1);
    });
  });

  describe('clearCatalogCache', () => {
    it('removes cached data so subsequent getCachedCatalog returns null', async () => {
      // #given
      const collections = [makeCollection('c1')];
      await putCatalogCache(collections);
      await new Promise((resolve) => setTimeout(resolve, 20));

      // #when
      await clearCatalogCache();
      const result = await getCachedCatalog();

      // #then
      expect(result).toBeNull();
    });
  });

  describe('IDB unavailable', () => {
    it('getCachedCatalog returns null without throwing when getDb returns null', async () => {
      // #given
      vi.mocked(getDb).mockResolvedValue(null);

      // #when / #then
      await expect(getCachedCatalog()).resolves.toBeNull();
    });

    it('putCatalogCache does not throw when getDb returns null', async () => {
      // #given
      vi.mocked(getDb).mockResolvedValue(null);

      // #when / #then
      await expect(putCatalogCache([makeCollection('c1')])).resolves.toBeUndefined();
    });

    it('clearCatalogCache does not throw when getDb returns null', async () => {
      // #given
      vi.mocked(getDb).mockResolvedValue(null);

      // #when / #then
      await expect(clearCatalogCache()).resolves.toBeUndefined();
    });
  });
});
