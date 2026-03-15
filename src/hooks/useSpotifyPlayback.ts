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

  // Use a ref for tracks so playTrack always reads the latest array,
  // even if called from a stale closure (e.g. auto-advance timer after shuffle toggle).
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

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

    // Resolve provider from the track itself, falling back to activeDescriptor only
    // when no MediaTrack is available (legacy Spotify-only playlists without mediaTracksRef).
    const trackProvider = mediaTrack?.provider ?? activeDescriptor?.id ?? 'spotify';

    // Pause the previous provider if we're switching to a different one
    const prevProvider = currentPlaybackProviderRef.current;
    if (prevProvider && prevProvider !== trackProvider) {
      providerRegistry.get(prevProvider)?.playback.pause().catch(() => {});
    }

    currentPlaybackProviderRef.current = trackProvider;

    // Spotify track path — uses Spotify SDK with retry/device-activation logic
    if (trackProvider === 'spotify') {
      if (mediaTrack) {
        try {
          await playSpotifyTrack(mediaTrack, index, skipOnError, mediaTracks.length, playTrack);
        } catch (error) {
          console.error('[Spotify] Failed to play track:', error);
          if (skipOnError && index < mediaTracks.length - 1) {
            setTimeout(() => playTrack(index + 1, skipOnError), 500);
          }
        }
        return;
      }

      // Legacy fallback: no MediaTrack available, use Track from tracksRef
      const currentTracks = tracksRef.current;
      if (!currentTracks[index]) {
        console.error(`[Spotify] No track at index ${index} (tracks length: ${currentTracks.length})`);
        return;
      }

      try {
        if (!spotifyAuth.isAuthenticated()) return;
        await playSpotifyTrack(
          {
            id: currentTracks[index].id,
            provider: 'spotify',
            playbackRef: { provider: 'spotify', ref: currentTracks[index].uri },
            name: currentTracks[index].name,
            artists: currentTracks[index].artists,
            album: currentTracks[index].album,
            durationMs: currentTracks[index].duration_ms,
            image: currentTracks[index].image,
          },
          index,
          skipOnError,
          currentTracks.length,
          playTrack,
        );
      } catch (error) {
        console.error('Failed to play track:', error);
        if (skipOnError && index < currentTracks.length - 1) {
          setTimeout(() => playTrack(index + 1, skipOnError), 500);
        }
      }
      return;
    }

    // Non-Spotify track path — route to the track's own provider
    const trackDescriptor = providerRegistry.get(trackProvider);
    if (!trackDescriptor || !mediaTrack) {
      console.error(`[${trackProvider}] No descriptor or track at index ${index}`);
      return;
    }

    try {
      await trackDescriptor.playback.playTrack(mediaTrack);
      setCurrentTrackIndex(index);

      // Prefetch the next track's resources (e.g. Dropbox temporary link)
      const nextIndex = (index + 1) % mediaTracks.length;
      const nextTrack = mediaTracks[nextIndex];
      if (nextTrack && nextIndex !== index) {
        const nextDescriptor = providerRegistry.get(nextTrack.provider);
        nextDescriptor?.playback.prepareTrack?.(nextTrack);
      }
    } catch (error) {
      console.error(`[${trackProvider}] Failed to play track:`, error);
      if (skipOnError && index < mediaTracks.length - 1) {
        setTimeout(() => playTrack(index + 1, skipOnError), 500);
      }
    }
  }, [setCurrentTrackIndex, handlePlaybackResume, activeDescriptor, mediaTracksRef, playSpotifyTrack]);

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
