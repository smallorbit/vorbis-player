import { useCallback, useRef } from 'react';
import { spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';
import type { ProviderDescriptor } from '@/types/providers';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';

interface UseSpotifyPlaybackProps {
  tracks: Track[];
  setCurrentTrackIndex: (index: number) => void;
  /** When set, playTrack uses this for non-Spotify provider playback. */
  activeDescriptor?: ProviderDescriptor | null;
  mediaTracksRef?: React.MutableRefObject<MediaTrack[]>;
}

export const useSpotifyPlayback = ({
  tracks,
  setCurrentTrackIndex,
  activeDescriptor,
  mediaTracksRef,
}: UseSpotifyPlaybackProps) => {

  /** Tracks which provider is currently handling playback (may differ from activeDescriptor during cross-provider queues). */
  const currentPlaybackProviderRef = useRef<ProviderId | null>(null);

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

  /**
   * Play a Spotify track via the Spotify playback adapter.
   * Handles SDK initialization, retry logic, and device activation.
   */
  const playSpotifyTrack = useCallback(async (mediaTrack: MediaTrack, index: number, skipOnError: boolean, totalTracks: number, playTrackFn: (i: number, s?: boolean) => void) => {
    if (!spotifyAuth.isAuthenticated()) return;

    // Ensure the Spotify SDK is initialized and device is ready
    const spotifyDescriptor = providerRegistry.get('spotify');
    if (spotifyDescriptor) {
      await spotifyDescriptor.playback.initialize();
      await spotifyPlayer.ensureDeviceIsActive(3, 1000);
    }

    const trackUri = mediaTrack.playbackRef.ref;
    const trackName = mediaTrack.name;

    type PlayResult = 'success' | 'unavailable';

    const playWithRetry = async (uri: string, retryCount = 0, maxRetries = 2): Promise<PlayResult> => {
      try {
        await spotifyPlayer.playTrack(uri);
        return 'success';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('403')) {
          const isRestrictionViolated = errorMessage.includes('Restriction violated');

          if (isRestrictionViolated) {
            console.warn(`Track "${trackName}" is unavailable (region-locked or removed)`);
            return 'unavailable';
          }

          if (retryCount < maxRetries) {
            const backoffMs = 1500 * Math.pow(2, retryCount);
            await spotifyPlayer.transferPlaybackToDevice();
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            await spotifyPlayer.ensureDeviceIsActive(3, 1000);
            return await playWithRetry(uri, retryCount + 1, maxRetries);
          }
        }

        throw error;
      }
    };

    const playResult = await playWithRetry(trackUri);

    if (playResult === 'unavailable') {
      if (skipOnError && index < totalTracks - 1) {
        setTimeout(() => playTrackFn(index + 1, skipOnError), 500);
        return;
      } else {
        throw new Error(`Track "${trackName}" is unavailable for playback`);
      }
    }

    setCurrentTrackIndex(index);

    setTimeout(() => {
      void (async () => {
        try {
          await handlePlaybackResume();
        } catch (error) {
          console.error('Failed to resume playback:', error);
        }
      })();
    }, 1500);
  }, [setCurrentTrackIndex, handlePlaybackResume]);

  const playTrack = useCallback(async (index: number, skipOnError = false) => {
    const mediaTracks = mediaTracksRef?.current ?? [];
    const mediaTrack = mediaTracks[index];

    // Determine the track's provider: use MediaTrack provider if available, else infer from activeDescriptor
    const trackProvider = mediaTrack?.provider ?? activeDescriptor?.id ?? 'spotify';

    // Cross-provider case: active descriptor is non-Spotify but track is Spotify
    if (activeDescriptor && activeDescriptor.id !== 'spotify' && trackProvider === 'spotify' && mediaTrack) {
      // Pause the current (non-Spotify) provider before switching
      const prevProvider = currentPlaybackProviderRef.current;
      if (prevProvider && prevProvider !== 'spotify') {
        const prevDescriptor = providerRegistry.get(prevProvider);
        prevDescriptor?.playback.pause().catch(() => {});
      }

      currentPlaybackProviderRef.current = 'spotify';

      try {
        await playSpotifyTrack(mediaTrack, index, skipOnError, mediaTracks.length, playTrack);
      } catch (error) {
        console.error('[Spotify cross-provider] Failed to play track:', error);
        if (skipOnError && index < mediaTracks.length - 1) {
          setTimeout(() => playTrack(index + 1, skipOnError), 500);
        }
      }
      return;
    }

    // Standard non-Spotify provider path
    if (activeDescriptor && activeDescriptor.id !== 'spotify') {
      if (!mediaTrack) {
        console.error(`[${activeDescriptor.id}] No track at index ${index} (mediaTracks length: ${mediaTracks.length})`);
        return;
      }

      // If switching back from Spotify to the active provider, pause Spotify
      if (currentPlaybackProviderRef.current === 'spotify') {
        const spotifyDescriptor = providerRegistry.get('spotify');
        spotifyDescriptor?.playback.pause().catch(() => {});
      }

      currentPlaybackProviderRef.current = activeDescriptor.id;

      try {
        await activeDescriptor.playback.playTrack(mediaTrack);
        setCurrentTrackIndex(index);
      } catch (error) {
        console.error(`[${activeDescriptor.id}] Failed to play track:`, error);
        if (skipOnError && index < mediaTracks.length - 1) {
          setTimeout(() => playTrack(index + 1, skipOnError), 500);
        }
      }
      return;
    }

    // Standard Spotify-as-active-provider path
    if (!tracks[index]) {
      console.error(`[Spotify] No track at index ${index} (tracks length: ${tracks.length})`);
      return;
    }

    currentPlaybackProviderRef.current = 'spotify';

    try {
      if (!spotifyAuth.isAuthenticated()) return;

      // Retry logic for 403 errors
      const playWithRetry = async (trackUri: string, retryCount = 0, maxRetries = 2): Promise<boolean> => {
        try {
          await spotifyPlayer.playTrack(trackUri);
          return true; // Success
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Check if it's a 403 restriction error
          if (errorMessage.includes('403')) {
            const isRestrictionViolated = errorMessage.includes('Restriction violated');

            if (isRestrictionViolated) {
              console.warn(`Track "${tracks[index].name}" is unavailable (region-locked or removed)`);
              return false;
            }

            // For other 403 errors, try to recover with exponential backoff
            if (retryCount < maxRetries) {
              const backoffMs = 1500 * Math.pow(2, retryCount);
              await spotifyPlayer.transferPlaybackToDevice();
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              await spotifyPlayer.ensureDeviceIsActive(3, 1000);

              return await playWithRetry(trackUri, retryCount + 1, maxRetries);
            }
          }

          throw error;
        }
      };

      const success = await playWithRetry(tracks[index].uri);

      if (!success) {
        if (skipOnError && index < tracks.length - 1) {
          setTimeout(() => {
            playTrack(index + 1, skipOnError);
          }, 500);
          return;
        } else {
          throw new Error(`Track "${tracks[index].name}" is unavailable for playback`);
        }
      }

      setCurrentTrackIndex(index);

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

      if (skipOnError && index < tracks.length - 1) {
        setTimeout(() => {
          playTrack(index + 1, skipOnError);
        }, 500);
      }
    }
  }, [tracks, setCurrentTrackIndex, handlePlaybackResume, activeDescriptor, mediaTracksRef, playSpotifyTrack]);

  const resumePlayback = useCallback(async () => {
    // Resume the provider that's currently playing
    const currentProvider = currentPlaybackProviderRef.current;
    if (currentProvider && currentProvider !== 'spotify') {
      const descriptor = providerRegistry.get(currentProvider);
      if (descriptor) {
        await descriptor.playback.resume();
        return;
      }
    }
    try {
      await spotifyPlayer.resume();
    } catch (error) {
      console.error('Failed to resume playback:', error);
    }
  }, []);

  return {
    playTrack,
    resumePlayback,
    activateDevice,
    /** Ref tracking which provider is currently handling playback. */
    currentPlaybackProviderRef,
  };
};
