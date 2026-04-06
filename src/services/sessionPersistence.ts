import type { MediaTrack, ProviderId } from '@/types/domain';

const SESSION_KEY = 'vorbis-player-last-session';

export interface SessionSnapshot {
  collectionId: string;
  collectionName: string;
  collectionProvider?: ProviderId;
  trackIndex: number;
  trackId?: string;
  /** Full ordered queue. Dropbox playbackRef and image are stripped (presigned URLs expire). */
  queueTracks?: MediaTrack[];
  // Display-only fields for the Resume card
  trackTitle?: string;
  trackArtist?: string;
  trackImage?: string;
  savedAt?: number;
}

/** Strip image URLs from all tracks — they're display-only and can be large presigned URLs. */
function sanitizeTrack(track: MediaTrack): MediaTrack {
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
