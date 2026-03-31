import { useCallback } from 'react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import type { RadioSeed, UnmatchedSuggestion } from '@/types/radio';
import { shuffleArray } from '@/utils/shuffleArray';
import { providerRegistry } from '@/providers/registry';
import { logRadio } from '@/lib/debugLog';
import { queueSnapshot } from './playerLogicUtils';

export type RadioProgressPhase = 'fetching-catalog' | 'generating' | 'resolving' | 'done';
export interface RadioProgress { phase: RadioProgressPhase; trackCount?: number; }

interface UseRadioSessionProps {
  activeDescriptor: ProviderDescriptor | undefined;
  currentTrack: MediaTrack | null;
  currentTrackIndex: number;
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
  startRadio: (seed: RadioSeed, catalogTracks: MediaTrack[]) => Promise<any>;
  stopRadioBase: () => void;
  setError: (error: string | null) => void;
  setTracks: (tracks: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => void;
  setOriginalTracks: (tracks: MediaTrack[]) => void;
  setCurrentTrackIndex: (index: number | ((prev: number) => number)) => void;
  setSelectedPlaylistId: (id: string | null) => void;
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
  activeDescriptor,
  currentTrack,
  currentTrackIndex,
  mediaTracksRef,
  startRadio,
  stopRadioBase,
  setError,
  setTracks,
  setOriginalTracks,
  setCurrentTrackIndex,
  setSelectedPlaylistId,
  onProgress,
  authExpired,
  setAuthExpired,
}: UseRadioSessionProps): UseRadioSessionReturn {
  const clearAuthExpired = useCallback(() => {
    setAuthExpired(null);
  }, [setAuthExpired]);

  const stopRadio = useCallback(() => {
    stopRadioBase();
    setAuthExpired(null);
  }, [stopRadioBase]);

  const handleStartRadio = useCallback(async () => {
    if (!activeDescriptor || !currentTrack) return;

    onProgress({ phase: 'fetching-catalog' });

    try {
      const searchProviders = providerRegistry.getAll().filter(
        d => d.capabilities.hasTrackSearch && d.auth.isAuthenticated(),
      );
      for (const sp of searchProviders) {
        sp.playback.initialize().catch(() => {});
      }

      // Fetch the widest catalog for radio matching: try all-music folder first,
      // then fall back to liked songs. Folder-based providers (e.g. Dropbox) return
      // their full library from the root folder; others use liked songs as the catalog.
      let catalogTracks: MediaTrack[];
      const folderId = activeDescriptor.id;
      const allMusicRef = { provider: folderId, kind: 'folder' as const, id: '' };
      catalogTracks = await activeDescriptor.catalog.listTracks(allMusicRef);
      if (catalogTracks.length === 0) {
        const likedRef = { provider: folderId, kind: 'liked' as const, id: '' };
        catalogTracks = await activeDescriptor.catalog.listTracks(likedRef);
      }

      const seed: RadioSeed = {
        type: 'track',
        artist: currentTrack.artists,
        track: currentTrack.name,
      };

      onProgress({ phase: 'generating' });
      const result = await startRadio(seed, catalogTracks);

      if (!result) {
        onProgress(null);
        return;
      }

      const mediaTracks = mediaTracksRef.current;
      const currentSeedMediaTrack: MediaTrack =
        mediaTracks[currentTrackIndex]?.id === currentTrack?.id
          ? mediaTracks[currentTrackIndex]
          : currentTrack;

      const seedKey = `${currentSeedMediaTrack.artists.toLowerCase()}||${currentSeedMediaTrack.name.toLowerCase()}`;
      const seedId = currentSeedMediaTrack.id;

      let generatedTracks = [...result.queue];

      if (result.unmatchedSuggestions.length > 0) {
        onProgress({ phase: 'resolving' });
        const searchCapableProviders = providerRegistry.getAll().filter(
          d => d.capabilities.hasTrackSearch && d.auth.isAuthenticated(),
        );
        if (searchCapableProviders.length > 0) {
          try {
            const searchPromises = result.unmatchedSuggestions.map(async (suggestion: UnmatchedSuggestion) => {
              for (const provider of searchCapableProviders) {
                const match = await provider.catalog.searchTrack?.(suggestion.artist, suggestion.name);
                if (match) return match;
              }
              return null;
            });
            const resolvedTracks = (await Promise.all(searchPromises)).filter((t): t is MediaTrack => t !== null);
            const existingKeys = new Set(
              generatedTracks.map((t) => `${t.artists.toLowerCase()}||${t.name.toLowerCase()}`),
            );
            const newTracks = resolvedTracks.filter(
              (t) => !existingKeys.has(`${t.artists.toLowerCase()}||${t.name.toLowerCase()}`),
            );
            generatedTracks = [...generatedTracks, ...newTracks];
            logRadio(
              'resolved tracks via search: %d of %d unmatched suggestions',
              newTracks.length,
              result.unmatchedSuggestions.length,
            );
          } catch (err) {
            console.warn('[Radio] Failed to resolve tracks via search:', err);
          }
        }
      }

      const dedupedGenerated = generatedTracks.filter(
        (t) => t.id !== seedId && `${t.artists.toLowerCase()}||${t.name.toLowerCase()}` !== seedKey,
      );

      const shuffledGenerated = shuffleArray(dedupedGenerated);
      const combinedQueue = [currentSeedMediaTrack, ...shuffledGenerated];

      if (combinedQueue.length > 0) {
        mediaTracksRef.current = combinedQueue;
        setOriginalTracks(combinedQueue);
        setTracks(combinedQueue);
        setCurrentTrackIndex(0);
        setSelectedPlaylistId('radio');
        onProgress({ phase: 'done', trackCount: combinedQueue.length });
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
