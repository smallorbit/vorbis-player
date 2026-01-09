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

  const playTrack = useCallback(async (index: number) => {
    console.log('[DEBUG] playTrack called', {
      index,
      tracksLength: tracks.length,
      hasTrack: !!tracks[index],
      trackUri: tracks[index]?.uri,
      trackName: tracks[index]?.name
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
      await spotifyPlayer.playTrack(tracks[index].uri);
      setCurrentTrackIndex(index);

      // Wait before checking playback state and resuming if needed
      setTimeout(async () => {
        await handlePlaybackResume();
      }, 1500);

    } catch (error) {
      console.error('Failed to play track:', error);
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