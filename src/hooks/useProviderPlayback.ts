import { useCallback, useRef } from 'react';
import type { ProviderDescriptor } from '@/types/providers';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';
import { AuthExpiredError, UnavailableTrackError } from '@/providers/errors';
import { logQueue } from '@/lib/debugLog';

interface UseProviderPlaybackProps {
  setCurrentTrackIndex: (index: number) => void;
  activeDescriptor?: ProviderDescriptor | null;
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
  onAuthExpired?: (providerId: ProviderId) => void;
}

export const useProviderPlayback = ({
  setCurrentTrackIndex,
  activeDescriptor,
  mediaTracksRef,
  onAuthExpired,
}: UseProviderPlaybackProps) => {

  const currentPlaybackProviderRef = useRef<ProviderId | null>(null);

  const resolveTrackProvider = useCallback((mediaTrack?: MediaTrack): ProviderId | undefined => (
    mediaTrack?.provider
    ?? currentPlaybackProviderRef.current
    ?? activeDescriptor?.id
    ?? undefined
  ), [activeDescriptor]);

  const pausePreviousProvider = useCallback((nextProvider: ProviderId): void => {
    const previousProvider = currentPlaybackProviderRef.current;
    if (previousProvider && previousProvider !== nextProvider) {
      providerRegistry.get(previousProvider)?.playback.pause().catch(() => {});
    }
  }, []);

  const playTrack = useCallback(async (index: number, skipOnError = false, options?: { positionMs?: number }) => {
    const tracks = mediaTracksRef.current;
    const mediaTrack = tracks[index];
    const trackProvider = resolveTrackProvider(mediaTrack);

    logQueue(
      'playTrack(%d) — provider=%s, track=%s, mediaLen=%d, skipOnError=%s',
      index,
      trackProvider ?? 'NONE',
      mediaTrack ? `"${mediaTrack.name}" (${mediaTrack.id.slice(0, 8)})` : 'NO_MEDIA_TRACK',
      tracks.length,
      String(skipOnError),
    );

    if (!trackProvider) {
      console.error(`[Playback] playTrack(${index}) — no provider could be resolved`);
      return;
    }

    if (!mediaTrack) {
      if (tracks.length > 0) {
        console.warn(`[Playback] playTrack(${index}) — index out of bounds! mediaTracksRef has ${tracks.length} items`);
      }
      console.error(`[Playback] playTrack(${index}) — no track at index`);
      return;
    }

    pausePreviousProvider(trackProvider);
    currentPlaybackProviderRef.current = trackProvider;

    const descriptor = providerRegistry.get(trackProvider);
    if (!descriptor) {
      console.error(`[${trackProvider}] No descriptor registered`);
      return;
    }

    try {
      await descriptor.playback.playTrack(mediaTrack, options);
      setCurrentTrackIndex(index);

      const nextIndex = (index + 1) % tracks.length;
      const nextTrack = tracks[nextIndex];
      if (nextTrack && nextIndex !== index) {
        const nextDescriptor = providerRegistry.get(nextTrack.provider);
        nextDescriptor?.playback.prepareTrack?.(nextTrack);
      }
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        onAuthExpired?.(error.providerId as ProviderId);
        return;
      }

      if (error instanceof UnavailableTrackError) {
        console.warn(`[${trackProvider}] ${error.message}`);
        if (skipOnError && index < tracks.length - 1) {
          setTimeout(() => playTrack(index + 1, skipOnError), 500);
        }
        return;
      }

      console.error(`[${trackProvider}] Failed to play track:`, error);
      if (skipOnError && index < tracks.length - 1) {
        setTimeout(() => playTrack(index + 1, skipOnError), 500);
      }
    }
  }, [setCurrentTrackIndex, pausePreviousProvider, resolveTrackProvider, onAuthExpired]);

  const resumePlayback = useCallback(async () => {
    const currentProvider = currentPlaybackProviderRef.current;
    if (currentProvider) {
      const descriptor = providerRegistry.get(currentProvider);
      if (descriptor) {
        try {
          await descriptor.playback.resume();
        } catch (error) {
          console.error(`[${currentProvider}] Failed to resume playback:`, error);
        }
        return;
      }
    }

    if (activeDescriptor) {
      try {
        await activeDescriptor.playback.resume();
      } catch (error) {
        console.error('Failed to resume playback:', error);
      }
    }
  }, [activeDescriptor]);

  return {
    playTrack,
    resumePlayback,
    currentPlaybackProviderRef,
  };
};
