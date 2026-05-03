/**
 * Syncs Dropbox liked songs to /.vorbis/likes.json in the user's Dropbox account.
 * Uses IndexedDB as a fast local cache with tombstones for deletion tracking.
 * Merge strategy: last-write-wins per trackId (likedAt vs deletedAt).
 */

import type { DropboxAuthAdapter } from './dropboxAuthAdapter';
import type { LikedEntry, Tombstone } from './dropboxLikesCache';
import {
  getLikedEntries,
  replaceLikes,
  getTombstones,
  setTombstones,
} from './dropboxLikesCache';
import { ensureVorbisFolder } from './dropboxSyncFolder';
import { contentApiRequest } from './dropboxContentApiClient';
import { logDropboxSync } from '@/lib/debugLog';

export interface RemoteLikesFile {
  version: 1;
  updatedAt: string;
  likes: LikedEntry[];
  tombstones: Tombstone[];
}

const SYNC_FILE_PATH = '/.vorbis/likes.json';
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const UPLOAD_DEBOUNCE_MS = 2000;

function entriesEqual<T extends { trackId: string }>(
  a: T[],
  b: T[],
  valuesMatch: (a: T, b: T) => boolean,
): boolean {
  if (a.length !== b.length) return false;
  const mapB = new Map<string, T>();
  for (const entry of b) mapB.set(entry.trackId, entry);
  for (const entryA of a) {
    const entryB = mapB.get(entryA.trackId);
    if (!entryB || !valuesMatch(entryA, entryB)) return false;
  }
  return true;
}

export class DropboxLikesSyncService {
  private auth: DropboxAuthAdapter;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pushing = false;

  constructor(auth: DropboxAuthAdapter) {
    this.auth = auth;
  }

  private likesEqual(a: LikedEntry[], b: LikedEntry[]): boolean {
    return entriesEqual(a, b, (ea, eb) =>
      ea.likedAt === eb.likedAt && JSON.stringify(ea.track) === JSON.stringify(eb.track),
    );
  }

  private tombstonesEqual(a: Tombstone[], b: Tombstone[]): boolean {
    return entriesEqual(a, b, (ea, eb) => ea.deletedAt === eb.deletedAt);
  }

  async downloadLikesFile(): Promise<RemoteLikesFile | null> {
    const apiArg = JSON.stringify({ path: SYNC_FILE_PATH });

    const response = await contentApiRequest(this.auth, (token) =>
      fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Dropbox-API-Arg': apiArg,
        },
      }),
    );

    if (!response) return null;

    if (response.status === 409) {
      // path/not_found — file doesn't exist yet
      return null;
    }

    if (!response.ok) {
      console.warn('[DropboxLikesSync] Download failed:', response.status);
      return null;
    }

    try {
      const data: RemoteLikesFile = await response.json();
      if (data.version !== 1) {
        console.warn('[DropboxLikesSync] Unknown file version:', data.version);
        return null;
      }
      return data;
    } catch {
      console.warn('[DropboxLikesSync] Failed to parse remote likes file');
      return null;
    }
  }

  async uploadLikesFile(data: RemoteLikesFile): Promise<boolean> {
    const folderReady = await ensureVorbisFolder(this.auth);
    if (!folderReady) return false;

    const apiArg = JSON.stringify({
      path: SYNC_FILE_PATH,
      mode: 'overwrite',
    });

    const body = JSON.stringify(data);

    const response = await contentApiRequest(this.auth, (accessToken) =>
      fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Dropbox-API-Arg': apiArg,
          'Content-Type': 'application/octet-stream',
        },
        body,
      }),
    );

    if (!response) return false;

    if (!response.ok) {
      const errText = await response.text();
      let errMsg: string;
      try {
        const errJson = JSON.parse(errText);
        errMsg = (errJson?.error_summary ?? errJson?.error ?? errText) || response.statusText;
      } catch {
        errMsg = errText || response.statusText;
      }
      console.warn('[DropboxLikesSync] Upload failed:', response.status, errMsg);
      if (response.status === 400) console.error('[DropboxLikesSync] 400 response body:', errText);
      return false;
    }

    return true;
  }

  /**
   * Merge local and remote likes using last-write-wins per trackId.
   * A tombstone with deletedAt > likedAt means the track was unliked.
   * Tombstones older than 30 days are pruned.
   */
  mergeLikes(
    localEntries: LikedEntry[],
    remoteData: RemoteLikesFile | null,
    localTombstones: Tombstone[],
  ): {
    mergedLikes: LikedEntry[];
    mergedTombstones: Tombstone[];
    changed: boolean;
    remoteChanged: boolean;
  } {
    const now = Date.now();
    const remoteEntries = remoteData?.likes ?? [];
    const remoteTombstones = remoteData?.tombstones ?? [];

    // Build a map of all tombstones (local + remote), keeping the latest deletedAt
    const tombstoneMap = new Map<string, number>();
    for (const t of [...localTombstones, ...remoteTombstones]) {
      const existing = tombstoneMap.get(t.trackId);
      if (!existing || t.deletedAt > existing) {
        tombstoneMap.set(t.trackId, t.deletedAt);
      }
    }

    // Build a map of all likes (local + remote), keeping the latest likedAt
    const likeMap = new Map<string, LikedEntry>();
    for (const entry of [...remoteEntries, ...localEntries]) {
      const existing = likeMap.get(entry.trackId);
      if (!existing || entry.likedAt > existing.likedAt) {
        likeMap.set(entry.trackId, entry);
      }
    }

    // Apply last-write-wins: if tombstone is newer than like, remove the like
    const mergedLikes: LikedEntry[] = [];
    for (const [trackId, entry] of likeMap) {
      const deletedAt = tombstoneMap.get(trackId);
      if (deletedAt && deletedAt > entry.likedAt) {
        // Tombstone wins — track stays deleted
        continue;
      }
      mergedLikes.push(entry);
      // Like wins — remove tombstone
      tombstoneMap.delete(trackId);
    }

    // Prune old tombstones
    const mergedTombstones: Tombstone[] = [];
    for (const [trackId, deletedAt] of tombstoneMap) {
      if (now - deletedAt < TOMBSTONE_TTL_MS) {
        mergedTombstones.push({ trackId, deletedAt });
      }
    }

    // Determine if anything changed vs local state.
    const changed =
      !this.likesEqual(localEntries, mergedLikes) ||
      !this.tombstonesEqual(localTombstones, mergedTombstones);

    // Track whether remote is out of sync with the merged result.
    const remoteChanged =
      !this.likesEqual(remoteEntries, mergedLikes) ||
      !this.tombstonesEqual(remoteTombstones, mergedTombstones);

    return { mergedLikes, mergedTombstones, changed, remoteChanged };
  }

  /**
   * Initial sync: download remote → merge with local → update IDB → push if local had changes.
   */
  async initialSync(): Promise<void> {
    try {
      const [remoteData, localEntries, localTombstones] = await Promise.all([
        this.downloadLikesFile(),
        getLikedEntries(),
        getTombstones(),
      ]);

      const { mergedLikes, mergedTombstones, remoteChanged } = this.mergeLikes(
        localEntries,
        remoteData,
        localTombstones,
      );

      // Always update local IDB with merged result
      await replaceLikes(mergedLikes);
      await setTombstones(mergedTombstones);

      // Push to remote if it is missing or behind the merged state.
      const shouldPush = !remoteData || remoteChanged;

      if (shouldPush) {
        await this.doPush();
      }

      logDropboxSync('initial sync complete: %d likes, %d tombstones', mergedLikes.length, mergedTombstones.length);
    } catch (error) {
      console.warn('[DropboxLikesSync] Initial sync failed:', error);
    }
  }

  /**
   * Schedule a debounced push to Dropbox after a local change.
   */
  schedulePush(): void {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.doPush().catch((err) => {
        console.warn('[DropboxLikesSync] Push failed:', err);
      });
    }, UPLOAD_DEBOUNCE_MS);
  }

  private async doPush(): Promise<void> {
    if (this.pushing) return;
    this.pushing = true;

    try {
      const [entries, tombstones] = await Promise.all([
        getLikedEntries(),
        getTombstones(),
      ]);

      // Prune old tombstones before pushing
      const now = Date.now();
      const activeTombstones = tombstones.filter(
        (t) => now - t.deletedAt < TOMBSTONE_TTL_MS,
      );

      const leanEntries = entries.map(({ trackId, track, likedAt }) => ({
        trackId,
        track: { ...track, image: undefined },
        likedAt,
      }));

      const data: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: leanEntries,
        tombstones: activeTombstones,
      };

      const success = await this.uploadLikesFile(data);

      if (success) {
        // Update local tombstones to the pruned set
        await setTombstones(activeTombstones);
      }
    } finally {
      this.pushing = false;
    }
  }

  destroy(): void {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────

let syncInstance: DropboxLikesSyncService | null = null;

export function initLikesSync(auth: DropboxAuthAdapter): DropboxLikesSyncService {
  if (syncInstance) {
    syncInstance.destroy();
  }
  syncInstance = new DropboxLikesSyncService(auth);
  return syncInstance;
}

export function getLikesSync(): DropboxLikesSyncService | null {
  return syncInstance;
}
