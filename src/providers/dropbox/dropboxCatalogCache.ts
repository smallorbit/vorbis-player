import type { MediaCollection } from '@/types/domain';
import { getDb } from './dropboxArtCache';

const STORE = 'catalog';
const KEY = 'collections';

export const CATALOG_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedCatalog {
  key: string;
  collections: MediaCollection[];
  cachedAt: number;
}

export async function getCachedCatalog(): Promise<{
  collections: MediaCollection[];
  cachedAt: number;
  isStale: boolean;
} | null> {
  const database = await getDb();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const req = database.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => {
        const entry = req.result as CachedCatalog | undefined;
        if (!entry) {
          resolve(null);
          return;
        }
        resolve({
          collections: entry.collections,
          cachedAt: entry.cachedAt,
          isStale: Date.now() - entry.cachedAt > CATALOG_TTL_MS,
        });
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putCatalogCache(collections: MediaCollection[]): Promise<void> {
  const database = await getDb();
  if (!database) return;
  try {
    const entry: CachedCatalog = { key: KEY, collections, cachedAt: Date.now() };
    const tx = database.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
  } catch {
    // fire-and-forget
  }
}

export async function clearCatalogCache(): Promise<void> {
  const database = await getDb();
  if (!database) return;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
