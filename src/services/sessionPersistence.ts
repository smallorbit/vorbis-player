import type { MediaTrack } from '@/types/domain';

const SESSION_KEY = 'vorbis-player-last-session';

export interface SessionSnapshot {
  tracks: MediaTrack[];
  currentTrackIndex: number;
  collectionName: string;
  collectionProvider?: string;
}

export function saveSession(snapshot: SessionSnapshot): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
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
