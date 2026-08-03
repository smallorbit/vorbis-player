import { useCallback } from 'react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import type { TrackOperations } from '@/types/trackOperations';
import type { RadioSeed, RadioProgress, RadioResult } from '@/types/radio';
import { providerRegistry } from '@/providers/registry';
import { runRadioPipeline } from '@/services/radioPipeline';
import { queueStore } from '@/stores/queueStore';
import { useNewestWins } from '@/hooks/useNewestWins';
import { queueSnapshot } from './playerLogicUtils';


interface UseRadioSessionProps {
  trackOps: Pick<TrackOperations, 'setError' | 'setSelection'>;
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
  const { setError, setSelection } = trackOps;

  // Newest-wins guard. Radio generation is async (catalog fetch + Last.fm
  // pipeline); a second start — or a stop — must supersede an in-flight one so
  // its late result cannot clobber the newer queue.
  const radioGuard = useNewestWins();

  const clearAuthExpired = useCallback(() => {
    setAuthExpired(null);
  }, [setAuthExpired]);

  const stopRadio = useCallback(() => {
    radioGuard.invalidate();
    stopRadioBase();
    setAuthExpired(null);
  }, [radioGuard, stopRadioBase]);

  const handleStartRadio = useCallback(async () => {
    if (!activeDescriptor || !currentTrack) return;

    const token = radioGuard.begin();

    try {
      const searchProviders = providerRegistry.getAll().filter(
        d => d.capabilities.hasTrackSearch && d.auth.isAuthenticated(),
      );
      for (const sp of searchProviders) {
        sp.playback.initialize().catch(() => {});
      }

      const queueTracks = queueStore.getTracks();
      const seedTrack: MediaTrack =
        queueTracks[currentTrackIndex]?.id === currentTrack.id
          ? queueTracks[currentTrackIndex]
          : currentTrack;

      const pipelineResult = await runRadioPipeline({
        seedTrack,
        catalogProvider: activeDescriptor.catalog,
        searchProviders,
        onProgress,
        generateQueue: startRadio,
      });

      // Superseded by a newer start or a stop while we were generating — drop
      // this stale result rather than overwrite the current queue / progress.
      if (token.isStale()) return;

      if (!pipelineResult) {
        onProgress(null);
        return;
      }

      const { queue: combinedQueue } = pipelineResult;

      if (combinedQueue.length > 0) {
        queueStore.replaceQueue(combinedQueue);
        setSelection({ type: 'radio' });
        queueSnapshot('Radio queue built', combinedQueue, queueStore.getTracks().length, 0);
      } else {
        onProgress(null);
      }
    } catch (err) {
      // A superseded generation's failure must not surface an error or clear the
      // newer generation's progress.
      if (token.isStale()) return;
      console.warn('[Radio] Generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to start radio.');
      onProgress(null);
    }
  }, [radioGuard, activeDescriptor, currentTrack, currentTrackIndex, startRadio, onProgress, setError, setSelection]);

  return {
    handleStartRadio,
    stopRadio,
    clearAuthExpired,
    authExpired,
  };
}
