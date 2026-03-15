import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useProviderContext } from '@/contexts/ProviderContext';
import { LIKES_CHANGED_EVENT } from '@/providers/dropbox/dropboxLikesCache';
import type { MediaTrack, ProviderId } from '@/types/domain';

interface UseUnifiedLikedTracksResult {
  unifiedTracks: MediaTrack[];
  totalCount: number;
  isLoading: boolean;
  refresh: () => void;
  /** True when 2+ connected providers support liked collections — triggers unified mode. */
  isUnifiedLikedActive: boolean;
}

export function useUnifiedLikedTracks(): UseUnifiedLikedTracksResult {
  const { connectedProviderIds, getDescriptor } = useProviderContext();
  const [tracks, setTracks] = useState<MediaTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const likedProviderIds = useMemo(
    () => connectedProviderIds.filter(id => getDescriptor(id)?.capabilities.hasLikedCollection),
    [connectedProviderIds, getDescriptor],
  );

  const isUnifiedLikedActive = likedProviderIds.length >= 2;

  const fetchAndMerge = useCallback(async (providerIds: ProviderId[], signal: AbortSignal) => {
    const results = await Promise.all(
      providerIds.map(async (id) => {
        const catalog = getDescriptor(id)?.catalog;
        if (!catalog) return [];
        try {
          return await catalog.listTracks({ provider: id, kind: 'liked' }, signal);
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') throw err;
          console.error(`[useUnifiedLikedTracks] Failed to fetch liked tracks from ${id}:`, err);
          return [];
        }
      }),
    );

    const merged = results.flat();
    merged.sort((a, b) => {
      const aTime = a.addedAt ?? 0;
      const bTime = b.addedAt ?? 0;
      return bTime - aTime;
    });
    return merged;
  }, [getDescriptor]);

  useEffect(() => {
    if (!isUnifiedLikedActive) {
      setTracks([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    fetchAndMerge(likedProviderIds, controller.signal)
      .then(merged => {
        if (!controller.signal.aborted) {
          setTracks(merged);
        }
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[useUnifiedLikedTracks] Fetch failed:', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [isUnifiedLikedActive, likedProviderIds, fetchAndMerge, refreshKey]);

  // Re-fetch when Dropbox likes change
  useEffect(() => {
    if (!isUnifiedLikedActive) return;
    const handle = () => setRefreshKey(k => k + 1);
    window.addEventListener(LIKES_CHANGED_EVENT, handle);
    return () => window.removeEventListener(LIKES_CHANGED_EVENT, handle);
  }, [isUnifiedLikedActive]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return {
    unifiedTracks: tracks,
    totalCount: tracks.length,
    isLoading,
    refresh,
    isUnifiedLikedActive,
  };
}
