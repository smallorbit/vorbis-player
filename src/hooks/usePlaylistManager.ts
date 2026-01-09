import { useCallback } from 'react';
import { getPlaylistTracks, getAlbumTracks, getLikedSongs, spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';

async function waitForSpotifyReady(timeout = 10000): Promise<void> {
  const start = Date.now();
  while (!spotifyPlayer.getIsReady() || !spotifyPlayer.getDeviceId()) {
    if (Date.now() - start > timeout) throw new Error('Spotify player not ready after waiting');
    await new Promise(res => setTimeout(res, 200));
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

      await spotifyPlayer.initialize();
      await waitForSpotifyReady();
      await spotifyPlayer.transferPlaybackToDevice();
      let fetchedTracks: Track[] = [];

      // Check if this is an album selection
      if (playlistId.startsWith('album:')) {
        const albumId = playlistId.replace('album:', '');
        fetchedTracks = await getAlbumTracks(albumId);
        // Albums are already sorted by track number, don't shuffle
      } else if (playlistId === 'liked-songs') {
        fetchedTracks = await getLikedSongs(200);
        fetchedTracks = shuffleArray(fetchedTracks);
      } else {
        fetchedTracks = await getPlaylistTracks(playlistId);
      }

      if (fetchedTracks.length === 0) {
        if (playlistId.startsWith('album:')) {
          setError("No tracks found in this album.");
        } else if (playlistId === 'liked-songs') {
          setError("No liked songs found. Please like some songs in Spotify first.");
        } else {
          setError("No tracks found in this playlist.");
        }
        return;
      }

      // Update state with new tracks FIRST
      setTracks(fetchedTracks);
      setCurrentTrackIndex(0);

      // Play the first track directly from fetchedTracks to avoid stale closure
      setTimeout(async () => {
        try {
          if (fetchedTracks.length > 0) {
            await spotifyPlayer.playTrack(fetchedTracks[0].uri);

            // Wait before checking playback state
            setTimeout(async () => {
              const state = await spotifyPlayer.getCurrentState();
              if (!state || state.paused) {
                await spotifyPlayer.resume();
              }
            }, 1500);
          }
        } catch (error) {
          console.error('Failed to start playback:', error);
          try {
            const token = await spotifyAuth.ensureValidToken();
            const deviceId = spotifyPlayer.getDeviceId();

            if (deviceId) {
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

              setTimeout(async () => {
                try {
                  if (fetchedTracks.length > 0) {
                    await spotifyPlayer.playTrack(fetchedTracks[0].uri);
                  }
                } catch (retryError) {
                  console.error('Failed to play track after recovery attempt:', retryError);
                }
              }, 1000);
            }
          } catch (recoveryError) {
            console.error('Recovery attempt failed:', recoveryError);
          }
        }
      }, 1000);

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