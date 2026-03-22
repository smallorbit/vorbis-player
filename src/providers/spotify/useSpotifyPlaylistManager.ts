/**
 * Spotify-specific playlist manager hook.
 *
 * Handles Spotify SDK initialization, context-based playback for restricted
 * playlists, and 403 retry logic. Only used as a fallback when the generic
 * catalog path returns empty results for a provider with native collection
 * playback support (i.e. Spotify).
 */

import { useCallback } from 'react';
import { getPlaylistTracks, getAlbumTracks, getLikedSongs, spotifyAuth, getLargestImage } from '@/services/spotify';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { isAlbumId, extractAlbumId, LIKED_SONGS_ID } from '@/constants/playlist';
import { shuffleArray } from '@/utils/shuffleArray';
import type { Track } from '@/services/spotify';
import type { ProviderId } from '@/types/domain';
import { logQueue } from '@/lib/debugLog';

const SPOTIFY_PROVIDER_ID: ProviderId = 'spotify';

async function waitForSpotifyReady(timeout = 10000): Promise<void> {
  const start = Date.now();
  while (!spotifyPlayer.getIsReady() || !spotifyPlayer.getDeviceId()) {
    if (Date.now() - start > timeout) throw new Error('Spotify player not ready after waiting');
    await new Promise(res => setTimeout(res, 200));
  }
}

function buildTracksFromWindow(state: SpotifyPlaybackState): Track[] {
  const tracks: Track[] = [];

  function toTrack(item: SpotifyTrack): Track {
    return {
      id: item.id || '',
      provider: SPOTIFY_PROVIDER_ID,
      name: item.name,
      artists: item.artists.map(a => a.name).join(', '),
      album: item.album?.name ?? 'Unknown Album',
      album_id: item.album?.uri?.split(':').pop(),
      duration_ms: item.duration_ms ?? 0,
      uri: item.uri,
      image: getLargestImage(item.album?.images),
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
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setSelectedPlaylistId: (id: string | null) => void;
  setTracks: (tracks: Track[]) => void;
  setOriginalTracks: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
  setCurrentTrackIndex: (index: number) => void;
  shuffleEnabled: boolean;
}

export const useSpotifyPlaylistManager = ({
  setError,
  setIsLoading,
  setSelectedPlaylistId,
  setTracks,
  setOriginalTracks,
  setCurrentTrackIndex,
  shuffleEnabled
}: UseSpotifyPlaylistManagerProps) => {

  const handlePlaylistSelect = useCallback(async (playlistId: string): Promise<Track[]> => {
    logQueue('useSpotifyPlaylistManager.handlePlaylistSelect — playlistId=%s, shuffle=%s', playlistId, String(shuffleEnabled));
    try {
      setError(null);
      setIsLoading(true);
      setSelectedPlaylistId(playlistId);

      await spotifyPlayer.initialize();
      await waitForSpotifyReady();
      await spotifyPlayer.transferPlaybackToDevice();

      await spotifyPlayer.ensureDeviceIsActive();

      let fetchedTracks: Track[] = [];

      if (isAlbumId(playlistId)) {
        fetchedTracks = await getAlbumTracks(extractAlbumId(playlistId));
      } else if (playlistId === LIKED_SONGS_ID) {
        fetchedTracks = await getLikedSongs();
      } else {
        try {
          fetchedTracks = await getPlaylistTracks(playlistId);
        } catch (trackError) {
          console.warn('Failed to fetch playlist tracks, will try context playback:', trackError);
          fetchedTracks = [];
        }
      }

      if (fetchedTracks.length === 0 && !isAlbumId(playlistId) && playlistId !== LIKED_SONGS_ID) {
        try {
          await spotifyPlayer.playContext(`spotify:playlist:${playlistId}`);

          await new Promise(resolve => setTimeout(resolve, 2000));
          const state = await spotifyPlayer.getCurrentState();

          if (state?.track_window?.current_track) {
            const tracksFromWindow = buildTracksFromWindow(state);
            setOriginalTracks(tracksFromWindow);
            setTracks(tracksFromWindow);
            setCurrentTrackIndex(0);
            return tracksFromWindow;
          }
          return [];
        } catch (contextError) {
          console.error('Context playback also failed:', contextError);
          setError("No tracks found in this playlist. It may be empty or unavailable.");
          return [];
        }
      }

      if (fetchedTracks.length === 0) {
        if (isAlbumId(playlistId)) {
          setError("No tracks found in this album.");
        } else if (playlistId === LIKED_SONGS_ID) {
          setError("No liked songs found. Please like some songs in Spotify first.");
        } else {
          setError("No tracks found in this playlist.");
        }
        return [];
      }

      setOriginalTracks(fetchedTracks);

      const tracksToPlay = shuffleEnabled ? shuffleArray(fetchedTracks) : fetchedTracks;

      logQueue('useSpotifyPlaylistManager — setting %d tracks (fetched=%d, shuffled=%s)', tracksToPlay.length, fetchedTracks.length, String(shuffleEnabled));
      setTracks(tracksToPlay);
      setCurrentTrackIndex(0);

      const playWithRetry = async (trackIndex: number, retryCount = 0, maxRetries = 2): Promise<boolean> => {
        const trackUri = tracksToPlay[trackIndex]?.uri;
        if (!trackUri) {
          console.error('No track URI at index', trackIndex);
          return false;
        }

        try {
          await spotifyPlayer.playTrack(trackUri);

          setTimeout(() => {
            void (async () => {
              try {
                const state = await spotifyPlayer.getCurrentState();
                if (!state || state.paused) {
                  await spotifyPlayer.resume();
                }
              } catch (error) {
                console.error('Failed to check/resume playback state:', error);
              }
            })();
          }, 1500);

          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          if (errorMessage.includes('403')) {
            const isRestrictionViolated = errorMessage.includes('Restriction violated');

            if (isRestrictionViolated) {
              console.warn(`Track "${tracksToPlay[trackIndex]?.name}" is unavailable (region-locked or removed)`);

              if (trackIndex < tracksToPlay.length - 1) {
                setCurrentTrackIndex(trackIndex + 1);
                return await playWithRetry(trackIndex + 1, 0, maxRetries);
              }

              return false;
            }

            if (retryCount < maxRetries) {
              const backoffMs = 2000 * Math.pow(2, retryCount);
              await spotifyPlayer.transferPlaybackToDevice();
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              await spotifyPlayer.ensureDeviceIsActive(3, 1000);

              return await playWithRetry(trackIndex, retryCount + 1, maxRetries);
            }
          }

          console.error('Failed to start playback:', error);
          throw error;
        }
      };

      setTimeout(() => {
        void (async () => {
          try {
            if (tracksToPlay.length > 0) {
              const success = await playWithRetry(0);
              if (!success) {
                console.error('Failed to play any track from the playlist');
                setError('Unable to play any tracks from this playlist. They may be unavailable in your region.');
              }
            }
          } catch (error) {
            console.error('Failed to start playback after all retries:', error);
          }
        })();
      }, 1500);

      logQueue('useSpotifyPlaylistManager — returning %d tracks, first="%s"', tracksToPlay.length, tracksToPlay[0]?.name ?? '');
      return tracksToPlay;

    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('authenticated')) {
        setError("Authentication expired. Redirecting to Spotify login...");
        spotifyAuth.redirectToAuth();
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred while loading tracks.");
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [setError, setIsLoading, setSelectedPlaylistId, setTracks, setOriginalTracks, setCurrentTrackIndex, shuffleEnabled]);

  return {
    handlePlaylistSelect
  };
};
