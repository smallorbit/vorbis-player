import type { MediaTrack, ProviderId } from '@/types/domain';

const SESSION_KEY = 'vorbis-player-last-session';

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

export function loadSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as SessionSnapshot).collectionId === 'string' &&
      typeof (parsed as SessionSnapshot).collectionName === 'string' &&
      typeof (parsed as SessionSnapshot).trackIndex === 'number'
    ) {
      return parsed as SessionSnapshot;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
}
