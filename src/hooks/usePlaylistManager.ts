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
      
      // Wait for device to become active
      console.log('🎵 Waiting for device to become active...');
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

      // Update state with new tracks FIRST
      setTracks(fetchedTracks);
      setCurrentTrackIndex(0);

      // Play the first track with retry logic for 403 errors
      const playWithRetry = async (trackIndex: number, retryCount = 0, maxRetries = 2): Promise<boolean> => {
        const trackUri = fetchedTracks[trackIndex]?.uri;
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
              console.warn(`⚠️ Track "${fetchedTracks[trackIndex]?.name}" is unavailable (region-locked or removed)`);
              
              // Try the next track if available
              if (trackIndex < fetchedTracks.length - 1) {
                console.log('🎵 Trying next track...');
                setCurrentTrackIndex(trackIndex + 1);
                return await playWithRetry(trackIndex + 1, 0, maxRetries);
              }
              
              return false; // No more tracks to try
            }
            
            // For other 403 errors, try to recover with exponential backoff
            if (retryCount < maxRetries) {
              const backoffMs = 2000 * Math.pow(2, retryCount);
              console.log(`🎵 Got 403 error, retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${maxRetries})...`);
              
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
            if (fetchedTracks.length > 0) {
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
  }, [setError, setIsLoading, setSelectedPlaylistId, setTracks, setCurrentTrackIndex]);

  return {
    handlePlaylistSelect
  };
};