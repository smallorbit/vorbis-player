import { useCallback } from 'react';
import { getPlaylistTracks, getAlbumTracks, getLikedSongs, spotifyAuth, getLargestImage } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { isAlbumId, extractAlbumId, LIKED_SONGS_ID } from '../constants/playlist';
import { shuffleArray } from '../utils/shuffleArray';
import type { Track } from '../services/spotify';

async function waitForSpotifyReady(timeout = 10000): Promise<void> {
  const start = Date.now();
  while (!spotifyPlayer.getIsReady() || !spotifyPlayer.getDeviceId()) {
    if (Date.now() - start > timeout) throw new Error('Spotify player not ready after waiting');
    await new Promise(res => setTimeout(res, 200));
  }
}

/**
 * Build a Track[] from the Spotify SDK's track window state.
 * Used as a fallback when the API can't return the full track list
 * (e.g. for Spotify-made playlists with restricted track access).
 */
function buildTracksFromWindow(state: SpotifyPlaybackState): Track[] {
  const tracks: Track[] = [];

  function toTrack(item: SpotifyTrack): Track {
    return {
      id: item.id || '',
      provider: 'spotify',
      name: item.name,
      artists: item.artists.map(a => a.name).join(', '),
      album: item.album?.name ?? 'Unknown Album',
      album_id: item.album?.uri?.split(':').pop(),
      duration_ms: item.duration_ms ?? 0,
      uri: item.uri,
      image: getLargestImage(item.album?.images),
    };
  }

  // Build from previous + current + next tracks in the window
  for (const t of state.track_window.previous_tracks ?? []) {
    tracks.push(toTrack(t));
  }
  tracks.push(toTrack(state.track_window.current_track));
  for (const t of state.track_window.next_tracks ?? []) {
    tracks.push(toTrack(t));
  }

  // Deduplicate by id (SDK can return duplicates)
  const seen = new Set<string>();
  return tracks.filter(t => {
    if (!t.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

interface UsePlaylistManagerProps {
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setSelectedPlaylistId: (id: string | null) => void;
  setTracks: (tracks: Track[]) => void;
  setOriginalTracks: (tracks: Track[]) => void;
  setCurrentTrackIndex: (index: number) => void;
  shuffleEnabled: boolean;
}

export const usePlaylistManager = ({
  setError,
  setIsLoading,
  setSelectedPlaylistId,
  setTracks,
  setOriginalTracks,
  setCurrentTrackIndex,
  shuffleEnabled
}: UsePlaylistManagerProps) => {
  
  const handlePlaylistSelect = useCallback(async (playlistId: string) => {
    try {
      setError(null);
      setIsLoading(true);
      setSelectedPlaylistId(playlistId);

      await spotifyPlayer.initialize();
      await waitForSpotifyReady();
      await spotifyPlayer.transferPlaybackToDevice();
      
      await spotifyPlayer.ensureDeviceIsActive();
      
      let fetchedTracks: Track[] = [];

      // Check if this is an album selection
      if (isAlbumId(playlistId)) {
        fetchedTracks = await getAlbumTracks(extractAlbumId(playlistId));
      } else if (playlistId === LIKED_SONGS_ID) {
        fetchedTracks = await getLikedSongs();
      } else {
        try {
          fetchedTracks = await getPlaylistTracks(playlistId);
        } catch (trackError) {
          // Track fetching may fail for non-owned playlists (e.g. Spotify-made)
          // due to API restrictions — will fall through to context playback below
          console.warn('Failed to fetch playlist tracks, will try context playback:', trackError);
          fetchedTracks = [];
        }
      }

      // For regular playlists where tracks couldn't be fetched (e.g. Spotify-made
      // playlists), fall back to context-based playback which lets Spotify manage
      // the track queue directly.
      if (fetchedTracks.length === 0 && !isAlbumId(playlistId) && playlistId !== LIKED_SONGS_ID) {
        try {
          await spotifyPlayer.playContext(`spotify:playlist:${playlistId}`);

          // Wait for SDK to start playing and report the first track
          await new Promise(resolve => setTimeout(resolve, 2000));
          const state = await spotifyPlayer.getCurrentState();

          if (state?.track_window?.current_track) {
            const tracksFromWindow = buildTracksFromWindow(state);
            setOriginalTracks(tracksFromWindow);
            setTracks(tracksFromWindow);
            setCurrentTrackIndex(0);
          }
          // Playback started successfully via context — return without error
          return;
        } catch (contextError) {
          console.error('Context playback also failed:', contextError);
          setError("No tracks found in this playlist. It may be empty or unavailable.");
          return;
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
        return;
      }

      // Always store original (unshuffled) track order
      setOriginalTracks(fetchedTracks);

      // Apply shuffle if enabled, otherwise use original order
      const tracksToPlay = shuffleEnabled ? shuffleArray(fetchedTracks) : fetchedTracks;

      // Update state with new tracks FIRST
      setTracks(tracksToPlay);
      setCurrentTrackIndex(0);

      // Play the first track with retry logic for 403 errors
      const playWithRetry = async (trackIndex: number, retryCount = 0, maxRetries = 2): Promise<boolean> => {
        const trackUri = tracksToPlay[trackIndex]?.uri;
        if (!trackUri) {
          console.error('No track URI at index', trackIndex);
          return false;
        }

        try {
          await spotifyPlayer.playTrack(trackUri);
          
          // Wait before checking playback state
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
          
          return true; // Success
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Check if it's a 403 restriction error
          if (errorMessage.includes('403')) {
            // Check if it's specifically a "Restriction violated" error
            const isRestrictionViolated = errorMessage.includes('Restriction violated');
            
            if (isRestrictionViolated) {
              console.warn(`⚠️ Track "${tracksToPlay[trackIndex]?.name}" is unavailable (region-locked or removed)`);

              // Try the next track if available
              if (trackIndex < tracksToPlay.length - 1) {
                setCurrentTrackIndex(trackIndex + 1);
                return await playWithRetry(trackIndex + 1, 0, maxRetries);
              }
              
              return false; // No more tracks to try
            }
            
            // For other 403 errors, try to recover with exponential backoff
            if (retryCount < maxRetries) {
              const backoffMs = 2000 * Math.pow(2, retryCount);
              await spotifyPlayer.transferPlaybackToDevice();
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              await spotifyPlayer.ensureDeviceIsActive(3, 1000);
              
              // Retry playing the same track
              return await playWithRetry(trackIndex, retryCount + 1, maxRetries);
            }
          }
          
          console.error('Failed to start playback:', error);
          throw error;
        }
      };

      // Start playback after a short delay
      setTimeout(() => {
        void (async () => {
          try {
            if (tracksToPlay.length > 0) {
              const success = await playWithRetry(0); // Start with first track
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

    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('authenticated')) {
        setError("Authentication expired. Redirecting to Spotify login...");
        spotifyAuth.redirectToAuth();
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred while loading tracks.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [setError, setIsLoading, setSelectedPlaylistId, setTracks, setOriginalTracks, setCurrentTrackIndex, shuffleEnabled]);

  return {
    handlePlaylistSelect
  };
};