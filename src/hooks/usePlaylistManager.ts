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
  setTracks: (tracks: Track[], startIndex?: number) => void;
  setCurrentTrackIndex: (index: number) => void;
}

export const usePlaylistManager = ({
  setError,
  setIsLoading,
  setSelectedPlaylistId,
  setTracks,
  setCurrentTrackIndex
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

      // Update state with new tracks (setTracks atomically sets both queue and index)
      setTracks(fetchedTracks, 0);

      const playWithRetry = async (trackIndex: number, retryCount = 0, maxRetries = 3): Promise<boolean> => {
        const trackUri = fetchedTracks[trackIndex]?.uri;
        if (!trackUri) {
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
          }, 1000);
          
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (errorMessage.includes('403')) {
            const isRestrictionViolated = errorMessage.includes('Restriction violated');
            
            if (isRestrictionViolated) {
              if (trackIndex < fetchedTracks.length - 1) {
                setCurrentTrackIndex(trackIndex + 1);
                return await playWithRetry(trackIndex + 1, 0, maxRetries);
              }
              return false;
            }
            
            if (retryCount < maxRetries) {
              await spotifyPlayer.transferPlaybackToDevice();
              await new Promise(resolve => setTimeout(resolve, 1500));
              await spotifyPlayer.ensureDeviceIsActive();
              return await playWithRetry(trackIndex, retryCount + 1, maxRetries);
            }
          }
          
          throw error;
        }
      };

      setTimeout(() => {
        void (async () => {
          try {
            if (fetchedTracks.length > 0) {
              const success = await playWithRetry(0);
              if (!success) {
                setError('Unable to play any tracks from this playlist. They may be unavailable in your region.');
              }
            }
          } catch (error) {
            console.error('Failed to start playback:', error);
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
  }, [setError, setIsLoading, setSelectedPlaylistId, setTracks, setCurrentTrackIndex]);

  return {
    handlePlaylistSelect
  };
};