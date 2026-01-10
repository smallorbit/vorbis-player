import { useCallback } from 'react';
import { spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';

interface UseSpotifyPlaybackProps {
  tracks: Track[];
  setCurrentTrackIndex: (index: number) => void;
}

export const useSpotifyPlayback = ({ tracks, setCurrentTrackIndex }: UseSpotifyPlaybackProps) => {

  const activateDevice = useCallback(async () => {
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
      }
    } catch (error) {
      console.error('Failed to activate device:', error);
    }
  }, []);

  const handlePlaybackResume = useCallback(async () => {
    const state = await spotifyPlayer.getCurrentState();
    if (state) {
      if (state.paused && state.position === 0) {
        try {
          await spotifyPlayer.resume();
        } catch (resumeError) {
          console.error('Failed to resume after playback attempt:', resumeError);
        }
      }
    } else {
      await activateDevice();
    }
  }, [activateDevice]);

  const playTrack = useCallback(async (index: number, skipOnError = false) => {
    console.log('[DEBUG] playTrack called', {
      index,
      tracksLength: tracks.length,
      hasTrack: !!tracks[index],
      trackUri: tracks[index]?.uri,
      trackName: tracks[index]?.name,
      skipOnError
    });

    if (!tracks[index]) {
      console.error('[DEBUG] playTrack: No track at index', index, 'tracks length:', tracks.length);
      return;
    }

    try {
      const isAuthenticated = spotifyAuth.isAuthenticated();

      if (!isAuthenticated) {
        console.warn('[DEBUG] playTrack: Not authenticated');
        return;
      }

      console.log('[DEBUG] playTrack: Playing track', tracks[index].name);
      
      // Retry logic for 403 errors
      const playWithRetry = async (trackUri: string, retryCount = 0, maxRetries = 2): Promise<boolean> => {
        try {
          await spotifyPlayer.playTrack(trackUri);
          return true; // Success
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Check if it's a 403 restriction error
          if (errorMessage.includes('403')) {
            // Parse the error to check if it's a "Restriction violated" error
            const isRestrictionViolated = errorMessage.includes('Restriction violated');
            
            if (isRestrictionViolated) {
              console.warn(`⚠️ Track "${tracks[index].name}" is unavailable (region-locked or removed)`);
              return false; // Unrecoverable error
            }
            
            // For other 403 errors, try to recover by re-transferring playback
            if (retryCount < maxRetries) {
              console.log(`🎵 Got 403 error while switching songs, retrying (attempt ${retryCount + 1}/${maxRetries})...`);
              
              // Re-transfer playback and wait
              await spotifyPlayer.transferPlaybackToDevice();
              await new Promise(resolve => setTimeout(resolve, 1000));
              await spotifyPlayer.ensureDeviceIsActive(5, 300);
              
              // Retry playing
              return await playWithRetry(trackUri, retryCount + 1, maxRetries);
            }
          }
          
          throw error; // Other errors or max retries exceeded
        }
      };

      const success = await playWithRetry(tracks[index].uri);
      
      if (!success) {
        // Track is unavailable, skip to next if enabled
        if (skipOnError && index < tracks.length - 1) {
          console.log('🎵 Skipping unavailable track, moving to next...');
          setTimeout(() => {
            playTrack(index + 1, skipOnError);
          }, 500);
          return;
        } else {
          throw new Error(`Track "${tracks[index].name}" is unavailable for playback`);
        }
      }
      
      setCurrentTrackIndex(index);

      // Wait before checking playback state and resuming if needed
      setTimeout(() => {
        void (async () => {
          try {
            await handlePlaybackResume();
          } catch (error) {
            console.error('Failed to resume playback:', error);
          }
        })();
      }, 1500);

    } catch (error) {
      console.error('Failed to play track:', error);
      
      // If skipOnError is enabled and we have more tracks, try the next one
      if (skipOnError && index < tracks.length - 1) {
        console.log('🎵 Error playing track, trying next track...');
        setTimeout(() => {
          playTrack(index + 1, skipOnError);
        }, 500);
      }
    }
  }, [tracks, setCurrentTrackIndex, handlePlaybackResume]);

  const resumePlayback = useCallback(async () => {
    try {
      await spotifyPlayer.resume();
    } catch (error) {
      console.error('Failed to resume playback:', error);
    }
  }, []);

  return {
    playTrack,
    resumePlayback,
    activateDevice
  };
};