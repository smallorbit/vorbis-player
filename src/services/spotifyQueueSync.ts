/**
 * Spotify Queue Sync Service
 *
 * Keeps Spotify's queue updated with the current playlist so the user can
 * switch to the Spotify app and continue listening. For non-Spotify tracks
 * (e.g. Dropbox), optionally resolves them to Spotify equivalents via search.
 */

import { searchTrack, spotifyAuth } from './spotify';
import type { Track } from './spotify';

const QUEUE_URI_LIMIT = 200;
const MAX_CONCURRENT_SEARCHES = 3;

const SETTING_KEY = 'vorbis-player-spotify-queue-resolve-cross-provider';

class SpotifyQueueSyncService {
  /** Cache: non-Spotify trackId → resolved Spotify URI (or null if unresolvable) */
  private resolutionCache = new Map<string, string | null>();
  private pendingResolutions = new Set<string>();

  /** Read the user's cross-provider resolution setting from localStorage. */
  isResolveEnabled(): boolean {
    try {
      const stored = localStorage.getItem(SETTING_KEY);
      if (stored === null) return true; // default on
      return JSON.parse(stored);
    } catch {
      return true;
    }
  }

  /**
   * Build the list of upcoming Spotify URIs starting after `fromIndex`.
   * Spotify tracks are included directly; non-Spotify tracks are included
   * only if the resolution setting is on and a cached Spotify URI exists.
   */
  buildUpcomingUris(tracks: Track[], fromIndex: number): string[] {
    const resolveEnabled = this.isResolveEnabled();
    const uris: string[] = [];
    // `spotifyPlayer.playTrack()` prepends the current URI, so reserve 1 slot.
    const limit = Math.min(tracks.length, fromIndex + QUEUE_URI_LIMIT);

    for (let i = fromIndex + 1; i < limit; i++) {
      const track = tracks[i];
      if (!track) continue;

      if (track.provider === 'spotify' || !track.provider) {
        if (track.uri) uris.push(track.uri);
      } else if (resolveEnabled) {
        const cached = this.resolutionCache.get(track.id);
        if (cached) uris.push(cached);
        // null = tried and failed, undefined = not yet resolved — skip both
      }
    }

    return uris;
  }

  /** Resolve non-Spotify tracks to Spotify URIs in the background. */
  async resolveTracksInBackground(
    tracks: Track[],
    signal?: AbortSignal,
  ): Promise<void> {
    if (!spotifyAuth.isAuthenticated()) return;
    if (!this.isResolveEnabled()) return;

    const toResolve = tracks.filter(
      t => t.provider
        && t.provider !== 'spotify'
        && !this.resolutionCache.has(t.id)
        && !this.pendingResolutions.has(t.id),
    );

    if (toResolve.length === 0) return;

    for (let i = 0; i < toResolve.length; i += MAX_CONCURRENT_SEARCHES) {
      if (signal?.aborted) return;

      const chunk = toResolve.slice(i, i + MAX_CONCURRENT_SEARCHES);

      await Promise.all(
        chunk.map(async (track) => {
          if (this.pendingResolutions.has(track.id)) return;
          this.pendingResolutions.add(track.id);

          try {
            const result = await searchTrack(track.artists, track.name);
            this.resolutionCache.set(track.id, result?.uri ?? null);
          } catch {
            // Network errors — don't cache, might succeed later
          } finally {
            this.pendingResolutions.delete(track.id);
          }
        }),
      );

      // Gentle delay between chunks to avoid rate limits
      if (i + MAX_CONCURRENT_SEARCHES < toResolve.length && !signal?.aborted) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  clearCache(): void {
    this.resolutionCache.clear();
  }
}

export const spotifyQueueSync = new SpotifyQueueSyncService();
