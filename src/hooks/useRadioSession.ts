import { useCallback } from 'react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import type { TrackOperations } from '@/types/trackOperations';
import type { RadioSeed, RadioProgress, RadioResult } from '@/types/radio';
import { RADIO_PLAYLIST_ID } from '@/constants/playlist';
import { providerRegistry } from '@/providers/registry';
import { runRadioPipeline } from '@/services/radioPipeline';
import { queueSnapshot } from './playerLogicUtils';


interface UseRadioSessionProps {
  trackOps: Pick<TrackOperations, 'setError' | 'setTracks' | 'setOriginalTracks' | 'setCurrentTrackIndex' | 'setSelectedPlaylistId' | 'mediaTracksRef'>;
  activeDescriptor: ProviderDescriptor | undefined;
  currentTrack: MediaTrack | null;
  currentTrackIndex: number;
  startRadio: (seed: RadioSeed, catalogTracks: MediaTrack[]) => Promise<RadioResult | null>;
  stopRadioBase: () => void;
  onProgress: (progress: RadioProgress | null) => void;
  authExpired: ProviderId | null;
  setAuthExpired: (providerId: ProviderId | null) => void;
}

interface UseRadioSessionReturn {
  handleStartRadio: () => Promise<void>;
  stopRadio: () => void;
  clearAuthExpired: () => void;
  authExpired: ProviderId | null;
}

export function useRadioSession({
  trackOps,
  activeDescriptor,
  currentTrack,
  currentTrackIndex,
  startRadio,
  stopRadioBase,
  onProgress,
  authExpired,
  setAuthExpired,
}: UseRadioSessionProps): UseRadioSessionReturn {
  const { setError, setTracks, setOriginalTracks, setCurrentTrackIndex, setSelectedPlaylistId, mediaTracksRef } = trackOps;
  const clearAuthExpired = useCallback(() => {
    setAuthExpired(null);
  }, [setAuthExpired]);

  const stopRadio = useCallback(() => {
    stopRadioBase();
    setAuthExpired(null);
  }, [stopRadioBase]);

  const handleStartRadio = useCallback(async () => {
    if (!activeDescriptor || !currentTrack) return;

    try {
      const searchProviders = providerRegistry.getAll().filter(
        d => d.capabilities.hasTrackSearch && d.auth.isAuthenticated(),
      );
      for (const sp of searchProviders) {
        sp.playback.initialize().catch(() => {});
      }

      const mediaTracks = mediaTracksRef.current;
      const seedTrack: MediaTrack =
        mediaTracks[currentTrackIndex]?.id === currentTrack.id
          ? mediaTracks[currentTrackIndex]
          : currentTrack;

      const pipelineResult = await runRadioPipeline({
        seedTrack,
        catalogProvider: activeDescriptor.catalog,
        searchProviders,
        onProgress,
        generateQueue: startRadio,
      });

      if (!pipelineResult) {
        onProgress(null);
        return;
      }

      const { queue: combinedQueue } = pipelineResult;

      if (combinedQueue.length > 0) {
        mediaTracksRef.current = combinedQueue;
        setOriginalTracks(combinedQueue);
        setTracks(combinedQueue);
        setCurrentTrackIndex(0);
        setSelectedPlaylistId(RADIO_PLAYLIST_ID);
        queueSnapshot('Radio queue built', combinedQueue, mediaTracksRef.current.length, 0);
      } else {
        onProgress(null);
      }
    } catch (err) {
      console.warn('[Radio] Generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to start radio.');
      onProgress(null);
    }
  }, [activeDescriptor, currentTrack, currentTrackIndex, startRadio, onProgress, setError, setOriginalTracks, setTracks, setCurrentTrackIndex, setSelectedPlaylistId]);

  return {
    handleStartRadio,
    stopRadio,
    clearAuthExpired,
    authExpired,
  };
}
