import type { MediaTrack } from '@/types/domain';

const SESSION_KEY = 'vorbis-player-last-session';

const DROPBOX_STALE_THRESHOLD_MS = 60 * 60 * 1000;

export interface SessionSnapshot {
  tracks: MediaTrack[];
  currentTrackIndex: number;
  collectionName: string;
  collectionProvider?: string;
  savedAt?: number;
  hasStaleUrls?: boolean;
}

export function saveSession(snapshot: SessionSnapshot): void {
  try {
    const withTimestamp: SessionSnapshot = { ...snapshot, savedAt: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(withTimestamp));
  } catch {
    // Storage quota or unavailable — ignore
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
      Array.isArray((parsed as SessionSnapshot).tracks) &&
      typeof (parsed as SessionSnapshot).currentTrackIndex === 'number' &&
      typeof (parsed as SessionSnapshot).collectionName === 'string'
    ) {
      const snapshot = parsed as SessionSnapshot;
      const hasDropboxTracks = snapshot.tracks.some(t => t.provider === 'dropbox');
      const isStale = typeof snapshot.savedAt === 'number'
        && (Date.now() - snapshot.savedAt) > DROPBOX_STALE_THRESHOLD_MS;
      return { ...snapshot, hasStaleUrls: hasDropboxTracks && isStale };
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
