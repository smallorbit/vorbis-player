/**
 * Persistent cache for parsed ID3 metadata.
 * Stores extracted metadata (title, artist, album, cover art data URL) in
 * IndexedDB so the expensive Range-fetch + ID3 parse only happens once per
 * track, not on every play.
 */

import { getDb } from './dropboxArtCache';

const STORE = 'metadata';
export const METADATA_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CachedMetadata {
  /** Dropbox file path (track.playbackRef.ref) */
  path: string;
  name?: string;
  artists?: string;
  album?: string;
  image?: string;
  cachedAt: number;
}

export async function getMetadata(path: string): Promise<CachedMetadata | null> {
  const database = await getDb();
  if (!database) return null;
  if (!database.objectStoreNames.contains(STORE)) return null;
  return new Promise((resolve) => {
    try {
      const req = database.transaction(STORE, 'readonly').objectStore(STORE).get(path);
      req.onsuccess = () => {
        const entry = req.result as CachedMetadata | undefined;
        resolve(entry && Date.now() - entry.cachedAt < METADATA_TTL_MS ? entry : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putMetadata(entry: CachedMetadata): Promise<void> {
  const database = await getDb();
  if (!database) return;
  if (!database.objectStoreNames.contains(STORE)) return;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
