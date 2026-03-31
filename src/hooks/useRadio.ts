/**
 * useRadio — React hook for radio state management.
 *
 * Manages starting radio sessions from tracks, artists, or albums.
 * Provider-agnostic: works with any catalog of MediaTracks.
 */

import { useState, useCallback, useRef } from 'react';
import type { MediaTrack } from '@/types/domain';
import type { RadioSeed, RadioResult } from '@/types/radio';
import { generateRadioQueue } from '@/services/radioService';
import { isLastFmConfigured } from '@/services/lastfm';
import { logRadio } from '@/lib/debugLog';

export interface RadioState {
  /** Whether a radio session is currently active. */
  isActive: boolean;
  /** Description of the current radio seed (e.g., "Radio based on Creep by Radiohead"). */
  seedDescription: string | null;
  /** Whether radio queue is currently being generated. */
  isGenerating: boolean;
  /** Error message from the last radio attempt. */
  error: string | null;
  /** Match stats from the last successful radio generation. */
  lastMatchStats: RadioResult['matchStats'] | null;
}

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
    seedDescription: null,
    isGenerating: false,
    error: null,
    lastMatchStats: null,
  });

  const generationRef = useRef(0);

  const startRadio = useCallback(async (
    seed: RadioSeed,
    catalogTracks: MediaTrack[],
  ): Promise<RadioResult | null> => {
    const generationId = ++generationRef.current;

    setRadioState({
      isActive: false,
      seedDescription: null,
      isGenerating: true,
      error: null,
      lastMatchStats: null,
    });

    try {
      const result = await generateRadioQueue(seed, catalogTracks);

      if (generationRef.current !== generationId) return null;

      if (result.queue.length === 0) {
        setRadioState({
          isActive: false,
          seedDescription: null,
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
      if (generationRef.current !== generationId) return null;

      const message = err instanceof Error ? err.message : 'Failed to generate radio queue.';
      setRadioState({
        isActive: false,
        seedDescription: null,
        isGenerating: false,
        error: message,
        lastMatchStats: null,
      });
      return null;
    }
  }, []);

  const stopRadio = useCallback(() => {
    generationRef.current++;
    setRadioState({
      isActive: false,
      seedDescription: null,
      isGenerating: false,
      error: null,
      lastMatchStats: null,
    });
  }, []);

  const isRadioAvailable = isLastFmConfigured();

  return { radioState, startRadio, stopRadio, isRadioAvailable };
}
