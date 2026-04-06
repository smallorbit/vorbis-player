import type { ProviderId } from '@/types/domain';

const SESSION_KEY = 'vorbis-player-last-session';

export interface SessionSnapshot {
  collectionId: string;
  collectionName: string;
  collectionProvider?: ProviderId;
  trackIndex: number;
  trackId?: string;
  // Display-only fields for the Resume card (shown before re-fetching)
  trackTitle?: string;
  trackArtist?: string;
  trackImage?: string;
  savedAt?: number;
}

export function saveSession(snapshot: SessionSnapshot): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
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
