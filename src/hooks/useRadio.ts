import { useState, useCallback } from 'react';
import type { MediaTrack } from '@/types/domain';
import type { RadioSeed, RadioResult, RadioState } from '@/types/radio';
import { generateRadioQueue } from '@/services/radioService';
import { isLastFmConfigured } from '@/services/lastfm';
import { useNewestWins } from '@/hooks/useNewestWins';
import { logRadio } from '@/lib/debugLog';

interface UseRadioReturn {
  radioState: RadioState;
  /** Start a radio session. Requires catalog tracks for matching. */
  startRadio: (seed: RadioSeed, catalogTracks: MediaTrack[]) => Promise<RadioResult | null>;
  /** End the current radio session. */
  stopRadio: () => void;
  /** Whether the radio feature is available (Last.fm API key configured). */
  isRadioAvailable: boolean;
}

export function useRadio(): UseRadioReturn {
  const [radioState, setRadioState] = useState<RadioState>({
    isActive: false,
    isGenerating: false,
    error: null,
    lastMatchStats: null,
  });

  // Newest-wins guard: a newer start (or a stop) supersedes an in-flight
  // generation so its late result cannot flip radio state back.
  const radioGuard = useNewestWins();

  const startRadio = useCallback(async (
    seed: RadioSeed,
    catalogTracks: MediaTrack[],
  ): Promise<RadioResult | null> => {
    const token = radioGuard.begin();

    setRadioState({
      isActive: false,
      isGenerating: true,
      error: null,
      lastMatchStats: null,
    });

    try {
      const result = await generateRadioQueue(seed, catalogTracks);

      if (token.isStale()) return null;

      if (result.queue.length === 0) {
        setRadioState({
          isActive: false,
          isGenerating: false,
          error: 'No similar tracks found in your library.',
          lastMatchStats: result.matchStats,
        });
        return null;
      }

      setRadioState({
        isActive: true,
        seedDescription: result.seedDescription,
        isGenerating: false,
        error: null,
        lastMatchStats: result.matchStats,
      });

      logRadio('queue generated: %o', result.matchStats);
      return result;
    } catch (err) {
      if (token.isStale()) return null;

      const message = err instanceof Error ? err.message : 'Failed to generate radio queue.';
      setRadioState({
        isActive: false,
        isGenerating: false,
        error: message,
        lastMatchStats: null,
      });
      return null;
    }
  }, [radioGuard]);

  const stopRadio = useCallback(() => {
    radioGuard.invalidate();
    setRadioState({
      isActive: false,
      isGenerating: false,
      error: null,
      lastMatchStats: null,
    });
  }, [radioGuard]);

  const isRadioAvailable = isLastFmConfigured();

  return { radioState, startRadio, stopRadio, isRadioAvailable };
}
