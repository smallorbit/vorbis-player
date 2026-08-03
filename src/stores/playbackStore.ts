/**
 * PlaybackStore — the single owner of playback state.
 *
 * Owns `isPlaying`, `positionMs`, `durationMs`, `currentTrackId`, and the
 * `drivingProviderId` as one module-level store outside React (consumed via
 * `useSyncExternalStore`; see `usePlaybackState`).
 *
 * Before this store existed the playback core was an implicit distributed
 * state machine: two disconnected isPlaying/position stores, three separate
 * provider-subscription mechanisms each with its own stale-event heuristic,
 * and six ad-hoc driving-provider resolutions (F3). All provider playback
 * events now flow through ONE fan-out subscription into one pipeline, and
 * the three stale-event heuristics are private fields here:
 *
 * - **Transition guard** (`expectedTrackId`): while a track transition is in
 *   flight, provider events for other tracks must not flip the queue's
 *   current index (raised by `beginTransition` before any adapter call).
 * - **Seek guard** (`pendingSeek` + tolerance/window): after a seek, stale
 *   pre-seek position emits must not yank the cursor back (#1671) — until a
 *   position lands near the seek target, position updates are rejected.
 * - **Ended detection** (`wasPlaying` + play cooldown): "was playing, now
 *   paused at 0" only counts as a natural track end outside the buffering
 *   cooldown after a play was initiated; near-end detection uses the same
 *   thresholds auto-advance always used. Subscribers get one `trackEnded`
 *   event per track.
 *
 * The queue itself lives in `queueStore`; on accepted track-change events
 * this pipeline syncs the queue index and applies provider metadata
 * overlays there. Policy (what to do on track end, what toast to show)
 * stays in hooks — this store owns event acceptance and state.
 *
 * `resolveDrivingProviderId` is THE driving-provider resolver: explicit
 * track provider → driving provider → active provider. Every consumer that
 * previously hand-rolled a fallback chain goes through it.
 */

import type { PlaybackState, ProviderId, MediaTrack } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import { providerRegistry } from '@/providers/registry';
import { queueStore } from '@/stores/queueStore';
import {
  AUTO_ADVANCE_END_THRESHOLD_MS,
  NEAR_END_FALLBACK_MS,
} from '@/constants/timing';
import { logQueue, logArtRace, logSeek } from '@/lib/debugLog';

export interface PlaybackSnapshot {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  /**
   * Track id as last reported by the driving provider. Raw — during a
   * transition this may briefly lag the queue's current track; the
   * transition guard protects the queue index, not this field.
   */
  currentTrackId: string | null;
  /** Provider currently producing audio; null before first playback. */
  drivingProviderId: ProviderId | null;
}

// After a seek, the SDK can still emit a stale pre-seek position (notably
// after a re-auth re-subscribe / getState), which would yank the timeline
// cursor back (#1671). Tolerance absorbs normal play drift between emits;
// the window is a safety valve so the cursor can never get stuck if the SDK
// never reports near the target.
const SEEK_TOLERANCE_MS = 2000;
const SEEK_GUARD_WINDOW_MS = 5000;

// Both Spotify SDK and HTML5 Audio briefly pause at position 0 during
// buffering after a play starts; treating that as "track finished" would
// falsely trigger auto-advance.
const PLAY_COOLDOWN_MS = 5000;

const POSITION_POLL_INTERVAL_MS = 1000;

let snapshot: PlaybackSnapshot = {
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  currentTrackId: null,
  drivingProviderId: null,
};

// --- private stale-event heuristics -----------------------------------------
let expectedTrackId: string | null = null;
let pendingSeek: { target: number; at: number } | null = null;
let wasPlaying = false;
let hasEnded = false;
let lastPlayInitiatedAt = 0;

/** Fallback for resolution when nothing is driving yet (the active provider). */
let activeProviderFallback: ProviderId | null = null;

const listeners = new Set<() => void>();
const endedListeners = new Set<() => void>();

// --- attachment bookkeeping --------------------------------------------------
let attachCleanup: (() => void) | null = null;
// Bumped on every attach/detach so async getState continuations from a
// superseded attachment can never write state into the current one.
let attachGeneration = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PlaybackSnapshot {
  return snapshot;
}

/** Fires once per track when the driving provider reports it finished. */
function subscribeTrackEnded(listener: () => void): () => void {
  endedListeners.add(listener);
  return () => endedListeners.delete(listener);
}

function commit(next: Partial<PlaybackSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  updatePolling();
  for (const listener of listeners) listener();
}

// --- driving-provider resolution (the ONE resolver) --------------------------

/**
 * Resolve which provider should handle a playback operation, with the single
 * canonical fallback order: the track's own provider (when given) → the
 * provider currently driving audio → the active (UI-selected) provider.
 */
function resolveDrivingProviderId(trackProvider?: ProviderId | null): ProviderId | null {
  return trackProvider ?? snapshot.drivingProviderId ?? activeProviderFallback;
}

/** Descriptor form of {@link resolveDrivingProviderId}. */
function getDrivingDescriptor(trackProvider?: ProviderId | null): ProviderDescriptor | undefined {
  const providerId = resolveDrivingProviderId(trackProvider);
  return providerId ? providerRegistry.get(providerId) : undefined;
}

function setDrivingProvider(providerId: ProviderId | null): void {
  if (providerId === snapshot.drivingProviderId) return;
  commit({ drivingProviderId: providerId });
}

/**
 * Keep the resolver's last-resort fallback in sync with the active provider
 * (one write site: usePlayerLogic).
 */
function setActiveProviderFallback(providerId: ProviderId | null): void {
  activeProviderFallback = providerId;
}

// --- transitions & seeks ------------------------------------------------------

/**
 * Raise the transition guard BEFORE any adapter call for a track change.
 * While raised, provider events for other track ids cannot flip the queue
 * index; the guard clears when the expected track's event arrives. Also
 * starts the play cooldown and re-arms ended detection for the new track.
 */
function beginTransition(trackId: string): void {
  expectedTrackId = trackId;
  hasEnded = false;
  lastPlayInitiatedAt = Date.now();
  logArtRace('transition guard set: expected=%s', trackId.slice(0, 8));
}

/** Drop the transition guard (queue reset / teardown paths). */
function clearTransition(): void {
  expectedTrackId = null;
}

/**
 * Issue a seek on the resolved provider: arms the seek guard and
 * optimistically moves the committed position so the cursor reflects the
 * seek immediately and cannot be dragged back by a stale pre-seek emit.
 */
async function seek(positionMs: number, trackProvider?: ProviderId | null): Promise<void> {
  const playback = getDrivingDescriptor(trackProvider)?.playback;
  if (!playback) return;
  pendingSeek = { target: positionMs, at: performance.now() };
  logSeek('seek issued → target=%dms (guard armed)', Math.round(positionMs));
  commit({ positionMs });
  await playback.seek(positionMs);
}

/**
 * Prime restored-session playback state: paused at the saved position, so
 * the UI shows the resume point before the user presses play.
 */
function primeRestoredPlayback(positionMs: number): void {
  commit({ isPlaying: false, positionMs });
}

// Decide whether an incoming position emit should move the cursor. Returns
// true (accept) when no seek is pending, when the emit is near the expected
// post-seek position, or when the guard window has lapsed; false (reject)
// for a stale pre-seek position.
function shouldAcceptPosition(positionMs: number, playing: boolean): boolean {
  if (!pendingSeek) return true;

  const elapsed = performance.now() - pendingSeek.at;
  if (elapsed > SEEK_GUARD_WINDOW_MS) {
    pendingSeek = null;
    logSeek('guard window lapsed → accept (pos=%dms)', Math.round(positionMs));
    return true;
  }

  const expected = pendingSeek.target + (playing ? elapsed : 0);
  const drift = Math.abs(positionMs - expected);
  if (drift <= SEEK_TOLERANCE_MS) {
    pendingSeek = null;
    logSeek('post-seek confirmed → accept (pos=%dms, expected=%dms, drift=%dms)',
      Math.round(positionMs), Math.round(expected), Math.round(drift));
    return true;
  }

  logSeek('REJECT stale position (pos=%dms, expected=%dms, drift=%dms, target=%dms)',
    Math.round(positionMs), Math.round(expected), Math.round(drift), Math.round(pendingSeek.target));
  return false;
}

// --- the single event pipeline ------------------------------------------------

function syncQueueToTrack(trackId: string): number {
  const currentTracks = queueStore.getTracks();
  const currentIndex = queueStore.getCurrentIndex();
  const trackIndex = currentTracks.findIndex((t: MediaTrack) => t.id === trackId);

  if (expectedTrackId !== null) {
    if (trackId === expectedTrackId) {
      logArtRace('pipeline: expected arrived → guard cleared (id=%s, idx=%d)',
        trackId.slice(0, 8), trackIndex);
      logQueue('Provider state — expected track arrived: %s', trackId.slice(0, 8));
      expectedTrackId = null;
    } else {
      logArtRace('pipeline: REJECT (id=%s, expected=%s, wouldFlipTo=%d, currentIdx=%d)',
        trackId.slice(0, 8), expectedTrackId.slice(0, 8), trackIndex, currentIndex);
    }
    // while waiting for the expected track, ignore provider index updates
  } else if (trackIndex !== -1 && trackIndex !== currentIndex) {
    logArtRace('pipeline: FALLBACK-ACCEPT flip %d → %d (id=%s, guard=null)',
      currentIndex, trackIndex, trackId.slice(0, 8));
    logQueue(
      'Provider state — index sync: %d → %d (trackId=%s, queueLen=%d)',
      currentIndex,
      trackIndex,
      trackId.slice(0, 8),
      currentTracks.length,
    );
    queueStore.setCurrentIndex(trackIndex);
  } else {
    logArtRace('pipeline: NOOP (id=%s, idx=%d, currentIdx=%d, guard=null)',
      trackId.slice(0, 8), trackIndex, currentIndex);
  }

  return trackIndex;
}

function applyMetadataOverlay(state: PlaybackState, trackIndex: number): void {
  if (!state.trackMetadata || trackIndex === -1) return;
  const meta = state.trackMetadata;
  const updates: Partial<MediaTrack> = {};
  if (meta.name !== undefined) updates.name = meta.name;
  if (meta.artists !== undefined) updates.artists = meta.artists;
  if (meta.album !== undefined) updates.album = meta.album;
  if (meta.image !== undefined) updates.image = meta.image;
  if (meta.durationMs !== undefined) updates.durationMs = meta.durationMs;

  if (Object.keys(updates).length > 0) {
    queueStore.mapTracks((t, i) => (i === trackIndex ? { ...t, ...updates } : t));
  }
}

function detectTrackEnded(state: PlaybackState): void {
  if (queueStore.getTracks().length === 0) return;

  const duration = state.durationMs;
  const position = state.positionMs;
  const timeRemaining = duration - position;
  const isPaused = !state.isPlaying;

  // Near-end of track while still playing.
  if (!hasEnded && duration > 0 && position > 0 && (
    timeRemaining <= AUTO_ADVANCE_END_THRESHOLD_MS ||
    position >= duration - NEAR_END_FALLBACK_MS
  )) {
    logQueue('playbackStore — near-end detected: pos=%d, dur=%d, remaining=%dms', position, duration, timeRemaining);
    emitTrackEnded();
  }

  // Track naturally finished: was playing, now paused at position 0 — outside
  // the buffering cooldown after a play was initiated.
  const lastPlayTime = getDrivingDescriptor()?.playback.getLastPlayTime?.() ?? lastPlayInitiatedAt;
  const msSinceLastPlay = Date.now() - lastPlayTime;
  if (!hasEnded && wasPlaying && isPaused && position === 0 && duration > 0 && msSinceLastPlay > PLAY_COOLDOWN_MS) {
    logQueue('playbackStore — track finished (paused@0): dur=%d, cooldown=%dms', duration, msSinceLastPlay);
    emitTrackEnded();
  }
}

function emitTrackEnded(): void {
  hasEnded = true;
  for (const listener of endedListeners) listener();
}

function handleProviderEvent(providerId: ProviderId, state: PlaybackState | null): void {
  if (providerId !== resolveDrivingProviderId()) return;

  if (!state) {
    commit({ isPlaying: false, positionMs: 0 });
    return;
  }

  const patch: Partial<PlaybackSnapshot> = {
    isPlaying: state.isPlaying,
    durationMs: state.durationMs,
  };
  if (shouldAcceptPosition(state.positionMs, state.isPlaying)) {
    patch.positionMs = state.positionMs;
  }

  if (state.currentTrackId) {
    // A new track re-arms ended detection (one trackEnded per track).
    if (state.currentTrackId !== snapshot.currentTrackId) {
      hasEnded = false;
    }
    patch.currentTrackId = state.currentTrackId;

    const trackIndex = syncQueueToTrack(state.currentTrackId);
    applyMetadataOverlay(state, trackIndex);
    detectTrackEnded(state);
    wasPlaying = state.isPlaying;
  }

  commit(patch);
}

// --- fan-out attachment --------------------------------------------------------

function updatePolling(): void {
  const shouldPoll = attachCleanup !== null && snapshot.isPlaying;
  if (shouldPoll && pollTimer === null) {
    const generation = attachGeneration;
    pollTimer = setInterval(async () => {
      const playback = getDrivingDescriptor()?.playback;
      if (!playback) return;
      const state = await playback.getState();
      if (generation !== attachGeneration) return;
      if (state && shouldAcceptPosition(state.positionMs, state.isPlaying)) {
        commit({ positionMs: state.positionMs });
      }
    }, POSITION_POLL_INTERVAL_MS);
  } else if (!shouldPoll && pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * Start the single fan-out subscription: every registered provider's
 * playback events flow into the pipeline (filtered by the resolver), plus a
 * visibilitychange resync and a light position poll while playing. Returns
 * a detach function; at most one attachment is live at a time.
 */
function attach(): () => void {
  attachCleanup?.();

  // Note: when re-attaching, the cleanup above already bumped the generation;
  // this second bump is redundant but harmless — staleness checks compare for
  // inequality only, never count increments.
  attachGeneration += 1;
  const generation = attachGeneration;

  const unsubscribes = providerRegistry.getAll().map((descriptor) =>
    descriptor.playback.subscribe((state: PlaybackState | null) => {
      handleProviderEvent(descriptor.id, state);
    })
  );

  // Prime from whichever provider is currently driving playback.
  getDrivingDescriptor()?.playback.getState().then((state) => {
    if (generation !== attachGeneration) return;
    if (state) {
      commit({ isPlaying: state.isPlaying, positionMs: state.positionMs });
    }
  });

  // When the tab returns to foreground, drop stale transition guards and
  // resync from the driving provider (track info, art, position).
  const handleVisibilityChange = () => {
    if (document.hidden) return;
    expectedTrackId = null;
    const resyncProviderId = resolveDrivingProviderId();
    const resyncDescriptor = resyncProviderId ? providerRegistry.get(resyncProviderId) : undefined;
    resyncDescriptor?.playback.getState().then((state) => {
      if (generation !== attachGeneration) return;
      if (state && resyncProviderId) {
        handleProviderEvent(resyncProviderId, state);
      }
    });
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const cleanup = () => {
    if (attachCleanup !== cleanup) return;
    attachCleanup = null;
    attachGeneration += 1;
    unsubscribes.forEach((unsub) => unsub());
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    updatePolling();
  };
  attachCleanup = cleanup;
  updatePolling();
  return cleanup;
}

/** Test-only: restore pristine state and drop any live attachment. */
function __resetForTests(): void {
  attachCleanup?.();
  snapshot = {
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    currentTrackId: null,
    drivingProviderId: null,
  };
  expectedTrackId = null;
  pendingSeek = null;
  wasPlaying = false;
  hasEnded = false;
  lastPlayInitiatedAt = 0;
  activeProviderFallback = null;
  endedListeners.clear();
  for (const listener of listeners) listener();
}

export const playbackStore = {
  subscribe,
  getSnapshot,
  subscribeTrackEnded,
  attach,
  resolveDrivingProviderId,
  getDrivingDescriptor,
  setDrivingProvider,
  setActiveProviderFallback,
  beginTransition,
  clearTransition,
  seek,
  primeRestoredPlayback,
  __resetForTests,
};
