import type { MediaTrack, PlaybackSelection, ProviderId } from '@/types/domain';
import { keyToCollectionRef } from '@/types/domain';
import { logCaughtError } from '@/utils/logCaughtError';

const SESSION_KEY = 'vorbis-player-last-session';

/** Sessions older than this are treated as absent for landing routing. */
export const STALE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionSnapshot {
  /** What was playing when the session was saved. */
  selection: PlaybackSelection;
  collectionName: string;
  trackIndex: number;
  trackId?: string;
  /** Full ordered queue. Dropbox image URLs are stripped (presigned, large); playbackRef kept (permanent path). */
  queueTracks?: MediaTrack[];
  // Display-only fields for the Resume card
  trackTitle?: string;
  trackArtist?: string;
  trackImage?: string;
  savedAt?: number;
  /** Playback position in milliseconds at the time the session was saved. */
  playbackPosition?: number;
}

/** Strip Dropbox image URLs — presigned and large. playbackRef is a permanent path, keep it. */
function sanitizeTrack(track: MediaTrack): MediaTrack {
  if (track.provider !== 'dropbox') return track;
  return { ...track, image: '' };
}

export function saveSession(snapshot: SessionSnapshot): void {
  try {
    const sanitized: SessionSnapshot = {
      ...snapshot,
      savedAt: Date.now(),
      ...(snapshot.queueTracks !== undefined && { queueTracks: snapshot.queueTracks.map(sanitizeTrack) }),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('[session] saveSession failed:', err);
  }
}

const SELECTION_TYPES = ['collection', 'liked', 'radio'] as const;

function isPlaybackSelection(value: unknown): value is PlaybackSelection {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (SELECTION_TYPES as readonly string[]).includes(obj.type as string);
}

/**
 * Structural check on the required fields (selection, collectionName, trackIndex).
 * Optional fields (queueTracks, trackTitle, savedAt, …) are trusted as-shaped without per-element validation.
 */
function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    isPlaybackSelection(obj.selection) &&
    typeof obj.collectionName === 'string' &&
    typeof obj.trackIndex === 'number'
  );
}

/** Pre-#1687 snapshot shape: a prefix-encoded collection id plus optional provider. */
interface LegacySessionFields {
  collectionId: string;
  collectionName: string;
  collectionProvider?: ProviderId;
  trackIndex: number;
}

function isLegacySnapshot(value: unknown): value is LegacySessionFields & Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.collectionId === 'string' &&
    typeof obj.collectionName === 'string' &&
    typeof obj.trackIndex === 'number'
  );
}

/**
 * Compatibility shim: decode a legacy prefix-encoded collection id
 * ('liked-songs', 'radio', 'album:X', 'dbplaylist:/path', bare id) into a
 * PlaybackSelection. This is the only place the old encoding survives; it also
 * serves the `?playlist=` deep link's raw-id fallback so there is exactly one
 * legacy decoder.
 */
export function decodeLegacySelection(collectionId: string, provider: ProviderId | undefined, name: string): PlaybackSelection {
  if (collectionId === 'radio') return { type: 'radio' };
  if (collectionId === 'liked-songs' || collectionId.startsWith('liked-')) {
    return { type: 'liked', name, ...(provider !== undefined && { provider }) };
  }
  // Structured keys were also stored by some seeds (e.g. "spotify:playlist:x").
  const parsedRef = keyToCollectionRef(collectionId);
  if (parsedRef) return { type: 'collection', ref: parsedRef, name };
  const resolvedProvider = provider ?? 'spotify';
  if (collectionId.startsWith('album:')) {
    return { type: 'collection', ref: { provider: resolvedProvider, kind: 'album', id: collectionId.slice('album:'.length) }, name };
  }
  if (collectionId.startsWith('dbplaylist:')) {
    return { type: 'collection', ref: { provider: 'dropbox', kind: 'playlist', id: collectionId.slice('dbplaylist:'.length) }, name };
  }
  const kind = resolvedProvider === 'dropbox' ? 'folder' : 'playlist';
  return { type: 'collection', ref: { provider: resolvedProvider, kind, id: collectionId }, name };
}

function upgradeLegacySnapshot(value: LegacySessionFields & Record<string, unknown>): SessionSnapshot {
  // Optional fields are trusted as-shaped, matching isSessionSnapshot's policy
  // for the same deserialization boundary.
  const opt = value as Partial<SessionSnapshot>;
  return {
    selection: decodeLegacySelection(value.collectionId, value.collectionProvider, value.collectionName),
    collectionName: value.collectionName,
    trackIndex: value.trackIndex,
    ...(opt.trackId !== undefined && { trackId: opt.trackId }),
    ...(opt.queueTracks !== undefined && { queueTracks: opt.queueTracks }),
    ...(opt.trackTitle !== undefined && { trackTitle: opt.trackTitle }),
    ...(opt.trackArtist !== undefined && { trackArtist: opt.trackArtist }),
    ...(opt.trackImage !== undefined && { trackImage: opt.trackImage }),
    ...(opt.savedAt !== undefined && { savedAt: opt.savedAt }),
    ...(opt.playbackPosition !== undefined && { playbackPosition: opt.playbackPosition }),
  };
}

export function loadSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isSessionSnapshot(parsed)) return parsed;
    if (isLegacySnapshot(parsed)) return upgradeLegacySnapshot(parsed);
    return null;
  } catch (err) {
    logCaughtError('sessionPersistence.loadSession', err);
    return null;
  }
}

/**
 * Returns true when the session is absent, missing a savedAt timestamp, or
 * older than STALE_SESSION_MS. Callers use this to decide whether to surface
 * resume affordances on the landing view.
 */
export function isSessionStale(
  session: SessionSnapshot | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!session) return true;
  if (typeof session.savedAt !== 'number') return true;
  return now - session.savedAt > STALE_SESSION_MS;
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (err) {
    // Ignore
    logCaughtError('sessionPersistence.clearSession', err);
  }
}
