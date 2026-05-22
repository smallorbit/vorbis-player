import type { MediaTrack, ProviderId } from '@/types/domain';
import { logCaughtError } from '@/utils/logCaughtError';

const SESSION_KEY = 'vorbis-player-last-session';

/** Sessions older than this are treated as absent for landing routing. */
export const STALE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionSnapshot {
  collectionId: string;
  collectionName: string;
  collectionProvider?: ProviderId;
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
      queueTracks: snapshot.queueTracks?.map(sanitizeTrack),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('[session] saveSession failed:', err);
  }
}

/**
 * Structural check on the three required fields (collectionId, collectionName, trackIndex).
 * Optional fields (queueTracks, trackTitle, savedAt, …) are trusted as-shaped without per-element validation.
 */
function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.collectionId === 'string' &&
    typeof obj.collectionName === 'string' &&
    typeof obj.trackIndex === 'number'
  );
}

export function loadSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSessionSnapshot(parsed) ? parsed : null;
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
