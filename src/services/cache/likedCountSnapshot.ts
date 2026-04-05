import type { ProviderId } from '@/types/domain';
import { STORAGE_KEYS } from '@/constants/storage';

interface SnapshotEntry {
  count: number;
  cachedAt: number;
}

type LikedCountSnapshots = Record<string, SnapshotEntry>;

export function readLikedCountSnapshots(): LikedCountSnapshots {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LIKED_COUNT_SNAPSHOTS);
    if (!raw) return {};
    return JSON.parse(raw) as LikedCountSnapshots;
  } catch {
    return {};
  }
}

export function writeLikedCountSnapshot(providerId: ProviderId, count: number): void {
  try {
    const snapshots = readLikedCountSnapshots();
    snapshots[providerId] = { count, cachedAt: Date.now() };
    localStorage.setItem(STORAGE_KEYS.LIKED_COUNT_SNAPSHOTS, JSON.stringify(snapshots));
  } catch { /* quota exceeded — silent */ }
}

export function clearLikedCountSnapshot(providerId: ProviderId): void {
  try {
    const snapshots = readLikedCountSnapshots();
    delete snapshots[providerId];
    localStorage.setItem(STORAGE_KEYS.LIKED_COUNT_SNAPSHOTS, JSON.stringify(snapshots));
  } catch { /* silent */ }
}
