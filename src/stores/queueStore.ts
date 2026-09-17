/**
 * QueueStore — the single owner of the playback queue.
 *
 * Owns `tracks` (play order), `originalTracks` (unshuffled order), the
 * `currentIndex`, and the `shuffle` flag as one module-level store outside
 * React (consumed via `useSyncExternalStore`; see `TrackContext`).
 *
 * Before this store existed the queue lived twice — React state in
 * `TrackContext` plus an imperative `mediaTracksRef` mirror — hand-synced at
 * 17 write sites across 6 files (F13), with the append/dedupe/shuffle
 * invariant repeated at each append path (F24). Every mutation now goes
 * through one mutator here, so the invariants hold by construction and reads
 * are synchronous (no waiting on a React render for index-based playback —
 * required for iOS Safari, which blocks `audio.play()` outside the
 * synchronous user-gesture call stack).
 *
 * Invariants maintained here:
 * - `originalTracks` always holds the true unshuffled order. While shuffle is
 *   ON, appends go to the END of `originalTracks` (a shuffled queue position
 *   has no meaningful unshuffled slot); while OFF, `originalTracks` mirrors
 *   `tracks`.
 * - Appends dedupe by track id against the current queue.
 * - `currentIndex` follows the playing track through remove/reorder.
 *
 * Policy (what to do about a mutation — toasts, back-to-library on last
 * remove, refusing to remove the playing track) stays in the calling hooks;
 * this store owns the mechanics.
 */

import type { MediaTrack, ProviderId } from '@/types/domain';
import { STORAGE_KEYS } from '@/constants/storage';
import { shuffleArray } from '@/utils/shuffleArray';
import { logQueue } from '@/lib/debugLog';
import { logCaughtError } from '@/utils/logCaughtError';

export interface QueueSnapshot {
  tracks: MediaTrack[];
  originalTracks: MediaTrack[];
  currentIndex: number;
  shuffle: boolean;
}

export type AddTracksPosition = 'end' | 'next';

function readPersistedShuffle(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.SHUFFLE_ENABLED);
    return raw ? JSON.parse(raw) === true : false;
  } catch (err) {
    logCaughtError('queueStore.readPersistedShuffle', err);
    return false;
  }
}

function persistShuffle(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.SHUFFLE_ENABLED, JSON.stringify(enabled));
  } catch (err) {
    logCaughtError('queueStore.persistShuffle', err);
  }
}

let snapshot: QueueSnapshot = {
  tracks: [],
  originalTracks: [],
  currentIndex: 0,
  shuffle: readPersistedShuffle(),
};

const listeners = new Set<() => void>();

function commit(next: Partial<QueueSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

/** Subscribe to queue changes (useSyncExternalStore-compatible). */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable-until-mutated snapshot (useSyncExternalStore-compatible). */
function getSnapshot(): QueueSnapshot {
  return snapshot;
}

/** Convenience: the queue in play order. */
function getTracks(): MediaTrack[] {
  return snapshot.tracks;
}

function getCurrentIndex(): number {
  return snapshot.currentIndex;
}

function getCurrentTrack(): MediaTrack | null {
  return snapshot.tracks[snapshot.currentIndex] ?? null;
}

/**
 * Replace the queue verbatim — no shuffle applied. For paths that already
 * hold the exact play order (radio queues, session restore, SDK mirrors).
 */
function replaceQueue(
  tracks: MediaTrack[],
  opts?: { currentIndex?: number; originalTracks?: MediaTrack[] },
): void {
  commit({
    tracks,
    originalTracks: opts?.originalTracks ?? tracks,
    currentIndex: opts?.currentIndex ?? 0,
  });
}

/**
 * Load a fresh collection into the queue, honoring the shuffle flag:
 * `originalTracks` keeps the collection order, `tracks` is shuffled when
 * shuffle is on (or `forceShuffle` — the All Music pseudo-collection).
 * Resets `currentIndex` to 0.
 */
function loadQueue(tracks: MediaTrack[], opts?: { forceShuffle?: boolean }): void {
  const shouldShuffle = snapshot.shuffle || opts?.forceShuffle === true;
  commit({
    tracks: shouldShuffle ? shuffleArray(tracks) : tracks,
    originalTracks: tracks,
    currentIndex: 0,
  });
}

/**
 * Append tracks (`position: 'end'`) or insert them after the current track
 * (`position: 'next'`), deduping by id against the existing queue. This is
 * the ONLY append path — the shuffle-aware `originalTracks` invariant lives
 * here and nowhere else. Returns how many tracks were actually added.
 */
function addTracks(additions: MediaTrack[], opts: { position: AddTracksPosition }): { added: number } {
  if (additions.length === 0) return { added: 0 };

  const { tracks, originalTracks, currentIndex, shuffle } = snapshot;
  const existingIds = new Set(tracks.map((t) => t.id));
  const unique = additions.filter((t) => !existingIds.has(t.id));
  if (unique.length < additions.length) {
    logQueue('queueStore.addTracks — deduped: %d → %d tracks', additions.length, unique.length);
  }
  if (unique.length === 0) return { added: 0 };

  if (tracks.length === 0) {
    commit({ tracks: unique, originalTracks: unique, currentIndex: 0 });
    return { added: unique.length };
  }

  let nextTracks: MediaTrack[];
  if (opts.position === 'next') {
    const insertAt = Math.max(0, Math.min(currentIndex + 1, tracks.length));
    nextTracks = [...tracks];
    nextTracks.splice(insertAt, 0, ...unique);
  } else {
    nextTracks = [...tracks, ...unique];
  }

  // While shuffle is ON, preserve the true unshuffled order by appending only
  // the new tracks to originalTracks; a shuffled queue position does not
  // correspond to an unshuffled slot. While OFF, originalTracks mirrors the
  // play order.
  const nextOriginal = shuffle ? [...originalTracks, ...unique] : nextTracks;

  commit({ tracks: nextTracks, originalTracks: nextOriginal });
  return { added: unique.length };
}

/**
 * Remove the track at `index`. Adjusts `currentIndex` when the removal is
 * before it. Returns the removed track, or null when out of bounds.
 */
function removeTrackAt(index: number): MediaTrack | null {
  const { tracks, originalTracks, currentIndex } = snapshot;
  const removed = tracks[index];
  if (index < 0 || removed === undefined) return null;

  commit({
    tracks: tracks.filter((_, i) => i !== index),
    originalTracks: originalTracks.filter((t) => t.id !== removed.id),
    currentIndex: index < currentIndex ? currentIndex - 1 : currentIndex,
  });
  return removed;
}

/**
 * Remove every track belonging to `providerId` (provider disconnect).
 * `currentIndex` follows the playing track when it survives; when the playing
 * track itself is removed the index resets to 0.
 */
function removeTracksByProvider(providerId: ProviderId): { remaining: number } {
  const { tracks, originalTracks, currentIndex } = snapshot;
  const remaining = tracks.filter((t) => t.provider !== providerId);

  if (remaining.length === tracks.length) return { remaining: remaining.length };

  if (remaining.length === 0) {
    commit({ tracks: [], originalTracks: [], currentIndex: 0 });
    return { remaining: 0 };
  }

  const playingTrack = tracks[currentIndex];
  const removedBeforeCurrent = tracks
    .slice(0, currentIndex)
    .filter((t) => t.provider === providerId).length;
  const followedIndex = Math.max(
    0,
    Math.min(currentIndex - removedBeforeCurrent, remaining.length - 1),
  );
  const playingRemoved = playingTrack !== undefined && playingTrack.provider === providerId;

  commit({
    tracks: remaining,
    originalTracks: originalTracks.filter((t) => t.provider !== providerId),
    currentIndex: playingRemoved ? 0 : followedIndex,
  });
  return { remaining: remaining.length };
}

/**
 * Move a track from `fromIndex` to `toIndex`. `currentIndex` follows the
 * playing track. `originalTracks` tracks the new order only while shuffle is
 * off (a manual order IS the original order then).
 */
function reorderTrack(fromIndex: number, toIndex: number): void {
  const { tracks, currentIndex, shuffle } = snapshot;
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= tracks.length) return;
  if (toIndex < 0 || toIndex >= tracks.length) return;

  const currentTrackId = tracks[currentIndex]?.id;

  const nextTracks = [...tracks];
  const [moved] = nextTracks.splice(fromIndex, 1);
  if (moved === undefined) return;
  nextTracks.splice(toIndex, 0, moved);

  const followedIndex = currentTrackId
    ? nextTracks.findIndex((t) => t.id === currentTrackId)
    : currentIndex;

  commit({
    tracks: nextTracks,
    currentIndex: followedIndex >= 0 ? followedIndex : 0,
    ...(shuffle ? {} : { originalTracks: nextTracks }),
  });
}

function setCurrentIndex(index: number): void {
  if (index === snapshot.currentIndex) return;
  commit({ currentIndex: index });
}

/**
 * Point `currentIndex` at the track with `trackId` (provider index sync).
 * Returns the found index, or -1 when the track is not in the queue.
 */
function syncIndexToTrackId(trackId: string): number {
  const index = snapshot.tracks.findIndex((t) => t.id === trackId);
  if (index !== -1 && index !== snapshot.currentIndex) {
    commit({ currentIndex: index });
  }
  return index;
}

/**
 * Per-track data enrichment (artwork, durations, metadata overlays). The
 * mapper must return a track with the same id — this is not a structural
 * mutation and deliberately leaves `originalTracks` untouched (restore-on-
 * unshuffle reorders live tracks by original id order, so stale objects
 * there are harmless).
 */
function mapTracks(mapper: (track: MediaTrack, index: number) => MediaTrack): void {
  const { tracks } = snapshot;
  let changed = false;
  const next = tracks.map((t, i) => {
    const mapped = mapper(t, i);
    if (mapped !== t) changed = true;
    return mapped;
  });
  if (changed) commit({ tracks: next });
}

/**
 * Toggle shuffle. Enabling keeps the playing track first and shuffles the
 * rest (using live track objects — originalTracks may hold stale ones).
 * Disabling restores the original order and finds the playing track's place
 * in it. No-op when nothing is loaded.
 */
function toggleShuffle(): void {
  const { tracks, originalTracks, currentIndex, shuffle } = snapshot;
  if (originalTracks.length === 0) return;

  const current = tracks[currentIndex];
  logQueue(
    'queueStore.toggleShuffle — %s, currentIndex=%d, current="%s", tracksLen=%d, originalLen=%d',
    shuffle ? 'OFF' : 'ON',
    currentIndex,
    current?.name ?? '',
    tracks.length,
    originalTracks.length,
  );

  if (!shuffle) {
    const rest = tracks.filter((t) => t.id !== current?.id);
    const shuffled = shuffleArray(rest);
    const nextTracks = current ? [current, ...shuffled] : shuffled;
    persistShuffle(true);
    commit({ tracks: nextTracks, currentIndex: 0, shuffle: true });
  } else {
    const originalOrderIds = originalTracks.map((t) => t.id);
    const originalIdSet = new Set(originalOrderIds);
    const byId = new Map(tracks.map((t) => [t.id, t]));
    const reordered = [
      ...originalOrderIds.flatMap((id) => { const t = byId.get(id); return t ? [t] : []; }),
      ...tracks.filter((t) => !originalIdSet.has(t.id)),
    ];
    const restoredIndex = current?.id
      ? reordered.findIndex((t) => t.id === current.id)
      : 0;
    persistShuffle(false);
    commit({
      tracks: reordered,
      currentIndex: restoredIndex >= 0 ? restoredIndex : 0,
      shuffle: false,
    });
  }
}

/** Empty the queue (back to library, provider reset). Keeps the shuffle flag. */
function clear(): void {
  commit({ tracks: [], originalTracks: [], currentIndex: 0 });
}

/** Test-only: restore pristine state (empty queue, shuffle off, no persistence write). */
function __resetForTests(): void {
  snapshot = { tracks: [], originalTracks: [], currentIndex: 0, shuffle: false };
  for (const listener of listeners) listener();
}

/** Test-only: set the shuffle flag directly (no reorder, no persistence write). */
function __setShuffleForTests(enabled: boolean): void {
  commit({ shuffle: enabled });
}

export const queueStore = {
  subscribe,
  getSnapshot,
  getTracks,
  getCurrentIndex,
  getCurrentTrack,
  replaceQueue,
  loadQueue,
  addTracks,
  removeTrackAt,
  removeTracksByProvider,
  reorderTrack,
  setCurrentIndex,
  syncIndexToTrackId,
  mapTracks,
  toggleShuffle,
  clear,
  __resetForTests,
  __setShuffleForTests,
};
