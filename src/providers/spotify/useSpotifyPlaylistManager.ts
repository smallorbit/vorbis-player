/**
 * Spotify context-playback fallback.
 *
 * Only used when the generic catalog path returns empty results for a
 * provider with native collection playback support (i.e. Spotify —
 * region-restricted playlists, etc.). Routes through the descriptor's
 * `playback.playCollection` (which owns SDK init, device transfer, and
 * retry) and then mirrors the SDK's track window into the app queue.
 */

import { useCallback } from 'react';
import { getLargestImage, spotifyAuth } from '@/services/spotify';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { AuthExpiredError } from '@/providers/errors';
import { providerRegistry } from '@/providers/registry';
import type { CollectionRef, ProviderId, MediaTrack } from '@/types/domain';
import type { TrackOperations } from '@/types/trackOperations';
import { logQueue } from '@/lib/debugLog';
import { SPOTIFY_RETRY_DELAY_MS } from '@/constants/timing';

const SPOTIFY_PROVIDER_ID: ProviderId = 'spotify';

function buildTracksFromWindow(state: SpotifyPlaybackState): MediaTrack[] {
  const tracks: MediaTrack[] = [];

  function toTrack(item: SpotifyTrack): MediaTrack {
    const albumId = item.album?.uri?.split(':').pop();
    const uri = item.uri;
    const image = getLargestImage(item.album?.images);
    return {
      id: item.id || '',
      provider: SPOTIFY_PROVIDER_ID,
      playbackRef: { provider: SPOTIFY_PROVIDER_ID, ref: uri },
      name: item.name,
      artists: item.artists.map(a => a.name).join(', '),
      album: item.album?.name ?? 'Unknown Album',
      durationMs: item.duration_ms ?? 0,
      genres: [],
      ...(albumId !== undefined && { albumId }),
      ...(image !== undefined && { image }),
    };
  }

  for (const t of state.track_window.previous_tracks ?? []) {
    tracks.push(toTrack(t));
  }
  tracks.push(toTrack(state.track_window.current_track));
  for (const t of state.track_window.next_tracks ?? []) {
    tracks.push(toTrack(t));
  }

  const seen = new Set<string>();
  return tracks.filter(t => {
    if (!t.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

interface UseSpotifyPlaylistManagerProps {
  trackOps: Omit<TrackOperations, 'mediaTracksRef'>;
}

export const useSpotifyPlaylistManager = ({
  trackOps,
}: UseSpotifyPlaylistManagerProps) => {
  const { setError, setIsLoading, setSelection, setTracks, setOriginalTracks, setCurrentTrackIndex } = trackOps;

  const handlePlaylistSelect = useCallback(async (ref: CollectionRef): Promise<MediaTrack[]> => {
    logQueue('useSpotifyPlaylistManager.handlePlaylistSelect — ref=%o', ref);

    try {
      setError(null);
      setIsLoading(true);
      setSelection({ type: 'collection', ref });

      if (ref.kind === 'liked') {
        setError('No liked songs found. Please like some songs in Spotify first.');
        return [];
      }
      if (ref.kind === 'folder') {
        setError('No tracks found in this collection.');
        return [];
      }

      const playback = providerRegistry.get(SPOTIFY_PROVIDER_ID)?.playback;
      if (!playback?.playCollection) {
        setError('No tracks found in this collection.');
        return [];
      }

      await playback.playCollection(ref);

      // Give the SDK a beat to populate its track window, then mirror it.
      await new Promise(resolve => setTimeout(resolve, SPOTIFY_RETRY_DELAY_MS));
      const state = await spotifyPlayer.getCurrentState();

      if (!state?.track_window?.current_track) {
        setError(ref.kind === 'album'
          ? 'No tracks found in this album.'
          : 'No tracks found in this playlist. It may be empty or unavailable.');
        return [];
      }

      const tracksFromWindow = buildTracksFromWindow(state);
      setOriginalTracks(tracksFromWindow);
      setTracks(tracksFromWindow);
      setCurrentTrackIndex(0);
      logQueue('useSpotifyPlaylistManager — mirrored %d tracks from SDK window', tracksFromWindow.length);
      return tracksFromWindow;
    } catch (err: unknown) {
      if (err instanceof AuthExpiredError) {
        setError("Authentication expired. Redirecting to Spotify login...");
        spotifyAuth.redirectToAuth();
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred while loading tracks.");
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [setError, setIsLoading, setSelection, setTracks, setOriginalTracks, setCurrentTrackIndex]);

  return {
    handlePlaylistSelect
  };
};
