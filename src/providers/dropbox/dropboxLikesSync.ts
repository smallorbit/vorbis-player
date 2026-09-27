/**
 * Syncs Dropbox liked songs to /.vorbis/likes.json in the user's Dropbox account.
 * Uses IndexedDB as a fast local cache with tombstones for deletion tracking.
 * Merge strategy: last-write-wins per trackId (likedAt vs deletedAt).
 */

import type { DropboxAuthHandle } from './dropboxAuthHandle';
import type { LikedEntry, Tombstone } from './dropboxLikesCache';
import {
  getLikedEntries,
  replaceLikes,
  getTombstones,
  setTombstones,
} from './dropboxLikesCache';
import { RemoteJsonFileStore } from './remoteJsonFileStore';
import { logDropboxSync } from '@/lib/debugLog';

export interface RemoteLikesFile {
  version: 1;
  updatedAt: string;
  likes: LikedEntry[];
  tombstones: Tombstone[];
}

const SYNC_FILE_PATH = '/.vorbis/likes.json';
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
  private readonly store: RemoteJsonFileStore<RemoteLikesFile>;

  constructor(auth: DropboxAuthHandle) {
    this.store = new RemoteJsonFileStore<RemoteLikesFile>({
      auth,
      path: SYNC_FILE_PATH,
      expectedVersion: 1,
      logLabel: 'DropboxLikesSync',
      buildPayload: () => this.buildRemoteFile(),
      onUploadSuccess: async (data) => {
        await setTombstones(data.tombstones);
      },
    });
  }

  private likesEqual(a: LikedEntry[], b: LikedEntry[]): boolean {
    return entriesEqual(a, b, (ea, eb) =>
      ea.likedAt === eb.likedAt && JSON.stringify(ea.track) === JSON.stringify(eb.track),
    );
  }

  private tombstonesEqual(a: Tombstone[], b: Tombstone[]): boolean {
    return entriesEqual(a, b, (ea, eb) => ea.deletedAt === eb.deletedAt);
  }

  /** @internal test seam — delegates to RemoteJsonFileStore */
  downloadLikesFile(): Promise<RemoteLikesFile | null> {
    return this.store.download();
  }

  /** @internal test seam — delegates to RemoteJsonFileStore */
  uploadLikesFile(data: RemoteLikesFile): Promise<boolean> {
    return this.store.upload(data);
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

  private async buildRemoteFile(): Promise<RemoteLikesFile> {
    const [entries, tombstones] = await Promise.all([
      getLikedEntries(),
      getTombstones(),
    ]);

    // Prune old tombstones before pushing
    const now = Date.now();
    const activeTombstones = tombstones.filter(
      (t) => now - t.deletedAt < TOMBSTONE_TTL_MS,
    );

    const leanEntries = entries.map(({ trackId, track, likedAt }) => {
      // Strip the (large, presigned) Dropbox image URL before uploading; the playbackRef
      // path is the permanent identifier. MediaTrack.image is optional, so we omit it.
      const { image: _image, ...rest } = track;
      return { trackId, track: rest, likedAt };
    });

    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      likes: leanEntries,
      tombstones: activeTombstones,
    };
  }

  /**
   * Initial sync: download remote → merge with local → update IDB → push if local had changes.
   */
  async initialSync(): Promise<void> {
    try {
      const [remoteData, localEntries, localTombstones] = await Promise.all([
        this.store.download(),
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
        await this.store.pushNow();
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
    this.store.schedulePush();
  }

  destroy(): void {
    this.store.destroy();
  }
}

// ── Singleton ────────────────────────────────────────────────────────

let syncInstance: DropboxLikesSyncService | null = null;

export function initLikesSync(auth: DropboxAuthHandle): DropboxLikesSyncService {
  if (syncInstance) {
    syncInstance.destroy();
  }
  syncInstance = new DropboxLikesSyncService(auth);
  return syncInstance;
}

export function getLikesSync(): DropboxLikesSyncService | null {
  return syncInstance;
}

/** Tear down the likes sync singleton (logout purge). */
export function destroyLikesSync(): void {
  if (syncInstance) {
    syncInstance.destroy();
    syncInstance = null;
  }
}
