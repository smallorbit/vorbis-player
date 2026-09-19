import type { ProviderId } from '@/types/domain';
import { STORAGE_KEYS } from '@/constants/storage';
import { logCaughtError } from '@/utils/logCaughtError';
import {
  readLocalStorageRaw,
  writeLocalStorageJson,
} from '@/utils/persistedStorage';

interface SnapshotEntry {
  count: number;
  cachedAt: number;
}

type LikedCountSnapshots = Record<string, SnapshotEntry>;

export function readLikedCountSnapshots(): LikedCountSnapshots {
  try {
    const raw = readLocalStorageRaw(STORAGE_KEYS.LIKED_COUNT_SNAPSHOTS);
    if (!raw) return {};
    return JSON.parse(raw) as LikedCountSnapshots;
  } catch (err) {
    logCaughtError('likedCountSnapshot.readLikedCountSnapshots', err);
    return {};
  }
}

export function writeLikedCountSnapshot(providerId: ProviderId, count: number): void {
  try {
    const snapshots = readLikedCountSnapshots();
    snapshots[providerId] = { count, cachedAt: Date.now() };
    writeLocalStorageJson(STORAGE_KEYS.LIKED_COUNT_SNAPSHOTS, snapshots);
  } catch (err) {
    /* quota exceeded — silent */
    logCaughtError('likedCountSnapshot.writeLikedCountSnapshot', err);
  }
}

export function clearLikedCountSnapshot(providerId: ProviderId): void {
  try {
    const snapshots = readLikedCountSnapshots();
    delete snapshots[providerId];
    writeLocalStorageJson(STORAGE_KEYS.LIKED_COUNT_SNAPSHOTS, snapshots);
  } catch (err) {
    /* silent */
    logCaughtError('likedCountSnapshot.clearLikedCountSnapshot', err);
  }
}
