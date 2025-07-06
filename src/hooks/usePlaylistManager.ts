import { useCallback } from 'react';
import { getPlaylistTracks, spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';

// Helper to wait for Spotify player readiness
async function waitForSpotifyReady(timeout = 10000): Promise<void> {
  const start = Date.now();
  while (!spotifyPlayer.getIsReady() || !spotifyPlayer.getDeviceId()) {
    if (Date.now() - start > timeout) throw new Error('Spotify player not ready after waiting');
    await new Promise(res => setTimeout(res, 200));
  }
}

interface UsePlaylistManagerProps {
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setSelectedPlaylistId: (id: string | null) => void;
  setTracks: (tracks: Track[]) => void;
  setCurrentTrackIndex: (index: number) => void;
  playTrack: (index: number) => Promise<void>;
}

export const usePlaylistManager = ({
  setError,
  setIsLoading,
  setSelectedPlaylistId,
  setTracks,
  setCurrentTrackIndex,
  playTrack
}: UsePlaylistManagerProps) => {
  
  const handlePlaylistSelect = useCallback(async (playlistId: string) => {
    try {
      setError(null);
      setIsLoading(true);
      setSelectedPlaylistId(playlistId);

      // Initialize Spotify player
      await spotifyPlayer.initialize();

      // Wait for the player to be ready
      await waitForSpotifyReady();

      // Ensure our device is the active player
      await spotifyPlayer.transferPlaybackToDevice();

      // Fetch tracks from the selected playlist
      const fetchedTracks = await getPlaylistTracks(playlistId);

      if (fetchedTracks.length === 0) {
        setError("No tracks found in this playlist.");
        return;
      }

      setTracks(fetchedTracks);
      setCurrentTrackIndex(0);

      // Start playing the first track (user interaction has occurred)
      setTimeout(async () => {
        try {
          await playTrack(0);

          // Check playback state after a delay and try to recover
          setTimeout(async () => {
            const state = await spotifyPlayer.getCurrentState();

            // If state is undefined, the player might not be active - try to activate it
            if (!state || !state.track_window?.current_track) {
              try {
                const token = await spotifyAuth.ensureValidToken();
                const deviceId = spotifyPlayer.getDeviceId();

                if (deviceId) {
                  // Transfer playback to our device
                  await fetch('https://api.spotify.com/v1/me/player', {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      device_ids: [deviceId],
                      play: true
                    })
                  });

                  // Try playing the track again
                  setTimeout(async () => {
                    try {
                      await playTrack(0);
                    } catch (error) {
                      // Silent fail
                    }
                  }, 1000);
                }
              } catch (error) {
                // Silent fail
              }
            }
          }, 2000);
        } catch (error) {
          // Silent fail
        }
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
  }, [setError, setIsLoading, setSelectedPlaylistId, setTracks, setCurrentTrackIndex, playTrack]);

  return {
    handlePlaylistSelect
  };
};