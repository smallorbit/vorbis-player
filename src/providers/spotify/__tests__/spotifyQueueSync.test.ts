import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMediaTrack } from '@/test/fixtures';
import { STORAGE_KEYS } from '@/constants/storage';
import type { MediaTrack } from '@/types/domain';

vi.mock('@/services/spotify', () => ({
  searchTrack: vi.fn(),
  spotifyAuth: {
    isAuthenticated: vi.fn().mockReturnValue(false),
  },
}));

// Import after mocking to ensure clean module state
import { spotifyQueueSync } from '../spotifyQueueSync';

describe('SpotifyQueueSyncService', () => {
  beforeEach(() => {
    spotifyQueueSync.clearCache();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  describe('isSyncEnabled', () => {
    it('defaults to true when no setting is stored', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockReturnValue(null);

      // #when
      const result = spotifyQueueSync.isSyncEnabled();

      // #then
      expect(result).toBe(true);
    });

    it('returns false when the setting is stored as false', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.SPOTIFY_QUEUE_SYNC) return 'false';
        return null;
      });

      // #when
      const result = spotifyQueueSync.isSyncEnabled();

      // #then
      expect(result).toBe(false);
    });

    it('returns true when the setting is stored as true', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.SPOTIFY_QUEUE_SYNC) return 'true';
        return null;
      });

      // #when
      const result = spotifyQueueSync.isSyncEnabled();

      // #then
      expect(result).toBe(true);
    });
  });

  describe('buildUpcomingUris', () => {
    it('returns empty array when sync is disabled', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.SPOTIFY_QUEUE_SYNC) return 'false';
        return null;
      });

      const tracks: MediaTrack[] = [
        makeMediaTrack({ id: 'track-1', provider: 'spotify', playbackRef: { provider: 'spotify', ref: 'spotify:track:1' } }),
        makeMediaTrack({ id: 'track-2', provider: 'spotify', playbackRef: { provider: 'spotify', ref: 'spotify:track:2' } }),
      ];

      // #when
      const uris = spotifyQueueSync.buildUpcomingUris(tracks, 0);

      // #then
      expect(uris).toEqual([]);
    });

    it('includes Spotify track URIs for upcoming tracks', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockReturnValue(null); // sync enabled

      const tracks: MediaTrack[] = [
        makeMediaTrack({ id: 'track-1', provider: 'spotify', playbackRef: { provider: 'spotify', ref: 'spotify:track:1' } }),
        makeMediaTrack({ id: 'track-2', provider: 'spotify', playbackRef: { provider: 'spotify', ref: 'spotify:track:2' } }),
        makeMediaTrack({ id: 'track-3', provider: 'spotify', playbackRef: { provider: 'spotify', ref: 'spotify:track:3' } }),
      ];

      // #when — build from index 0 (current), so tracks 1 and 2 are upcoming
      const uris = spotifyQueueSync.buildUpcomingUris(tracks, 0);

      // #then
      expect(uris).toEqual(['spotify:track:2', 'spotify:track:3']);
    });

    it('includes cached resolved URIs for non-Spotify tracks when resolve is enabled', async () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockReturnValue(null); // both settings enabled

      const { searchTrack, spotifyAuth } = await import('@/services/spotify');
      vi.mocked(spotifyAuth.isAuthenticated).mockReturnValue(true);
      vi.mocked(searchTrack).mockResolvedValue({ uri: 'spotify:track:resolved-99' } as never);

      const dropboxTrack = makeMediaTrack({
        id: 'dropbox-track-1',
        provider: 'dropbox',
        name: 'Local Song',
        artists: 'Local Artist',
        playbackRef: { provider: 'dropbox', ref: 'dropbox://path/to/song.mp3' },
      });
      const spotifyTrack = makeMediaTrack({
        id: 'track-2',
        provider: 'spotify',
        playbackRef: { provider: 'spotify', ref: 'spotify:track:2' },
      });
      const tracks = [spotifyTrack, dropboxTrack];

      // Resolve the non-Spotify track into the cache
      await spotifyQueueSync.resolveTracksInBackground(tracks);

      // #when — build from index 0
      const uris = spotifyQueueSync.buildUpcomingUris(tracks, 0);

      // #then — the cached resolved URI for dropboxTrack is included
      expect(uris).toContain('spotify:track:resolved-99');
    });

    it('skips unresolved non-Spotify tracks', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockReturnValue(null); // sync enabled

      const dropboxTrack = makeMediaTrack({
        id: 'dropbox-track-unresolved',
        provider: 'dropbox',
        playbackRef: { provider: 'dropbox', ref: 'dropbox://path/to/song.mp3' },
      });
      const currentTrack = makeMediaTrack({
        id: 'track-1',
        provider: 'spotify',
        playbackRef: { provider: 'spotify', ref: 'spotify:track:1' },
      });
      const tracks = [currentTrack, dropboxTrack];

      // #when — no resolution done, dropboxTrack not in cache
      const uris = spotifyQueueSync.buildUpcomingUris(tracks, 0);

      // #then — unresolved dropbox track is skipped
      expect(uris).not.toContain('dropbox://path/to/song.mp3');
      expect(uris).toHaveLength(0);
    });

    it('returns empty array when fromIndex is at the last track', () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockReturnValue(null);

      const tracks: MediaTrack[] = [
        makeMediaTrack({ id: 'track-1', provider: 'spotify', playbackRef: { provider: 'spotify', ref: 'spotify:track:1' } }),
      ];

      // #when
      const uris = spotifyQueueSync.buildUpcomingUris(tracks, 0);

      // #then
      expect(uris).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('empties the resolution cache', async () => {
      // #given
      vi.mocked(window.localStorage.getItem).mockReturnValue(null);

      const { searchTrack, spotifyAuth } = await import('@/services/spotify');
      vi.mocked(spotifyAuth.isAuthenticated).mockReturnValue(true);
      vi.mocked(searchTrack).mockResolvedValue({ uri: 'spotify:track:resolved-abc' } as never);

      const dropboxTrack = makeMediaTrack({
        id: 'dropbox-cached',
        provider: 'dropbox',
        name: 'Cached Song',
        artists: 'Cached Artist',
        playbackRef: { provider: 'dropbox', ref: 'dropbox://cached.mp3' },
      });

      await spotifyQueueSync.resolveTracksInBackground([dropboxTrack]);

      expect(spotifyQueueSync.getResolvedUri('dropbox-cached')).toBe('spotify:track:resolved-abc');

      // #when
      spotifyQueueSync.clearCache();

      // #then — cache entry is gone
      expect(spotifyQueueSync.getResolvedUri('dropbox-cached')).toBeUndefined();
    });
  });
});
