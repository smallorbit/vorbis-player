import { saveSession } from '@/services/sessionPersistence';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import type { MockCatalogAdapter } from './mockCatalogAdapter';

const PARAM_NAME = 'mock-session';

export interface MockSessionSeed {
  trackId: string;
  positionMs: number;
}

/**
 * Parses the `?mock-session=<base64-json>` URL param and returns the decoded
 * seed, or null if the param is absent, malformed, or missing required fields.
 * Never throws.
 */
export function parseMockSessionParam(search: string): MockSessionSeed | null {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get(PARAM_NAME);
    if (!raw) return null;

    const urlSafe = raw.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(urlSafe);
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed !== 'object' || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;
    const { trackId, positionMs } = candidate;

    if (
      typeof trackId !== 'string' ||
      typeof positionMs !== 'number' ||
      positionMs < 0
    ) {
      return null;
    }

    return { trackId, positionMs };
  } catch {
    return null;
  }
}

/**
 * Reads `?mock-session` from the current URL, resolves the track against the
 * provided catalogs (Spotify then Dropbox), and writes a full SessionSnapshot
 * into localStorage so the normal hydrate flow picks it up on first render.
 *
 * Falls back silently when the param is absent, malformed, or references an
 * unknown track id. Never throws.
 */
export function seedSessionFromUrlParam(
  spotifyCatalog: MockCatalogAdapter,
  dropboxCatalog: MockCatalogAdapter,
): void {
  try {
    const seed = parseMockSessionParam(window.location.search);
    if (!seed) return;

    const track =
      spotifyCatalog.getTrackById(seed.trackId) ??
      dropboxCatalog.getTrackById(seed.trackId);

    if (!track) return;

    const snapshot: SessionSnapshot = {
      collectionId: track.albumId ?? track.provider,
      collectionName: track.album,
      collectionProvider: track.provider,
      trackIndex: 0,
      trackId: track.id,
      queueTracks: [track],
      trackTitle: track.name,
      trackArtist: track.artists,
      trackImage: track.image,
      playbackPosition: seed.positionMs,
      savedAt: Date.now(),
    };

    saveSession(snapshot);
  } catch {
    // Fail closed — log nothing, let the app start in default state.
  }
}
