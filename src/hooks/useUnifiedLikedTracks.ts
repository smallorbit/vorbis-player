import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { useProviderContext } from '@/contexts/ProviderContext';
import { LIKES_CHANGED_EVENT } from '@/providers/dropbox/dropboxLikesCache';
import { LIBRARY_REFRESH_EVENT } from '@/hooks/useLibrarySync';
import { providerRegistry } from '@/providers/registry';
import type { MediaTrack, ProviderId } from '@/types/domain';

const CACHE_UPDATED_EVENT = 'vorbis-unified-liked-cache-updated';

interface CacheState {
  tracks: MediaTrack[];
  totalCount: number;
  isLoading: boolean;
  providerKey: string;
}

const EMPTY_CACHE: CacheState = { tracks: [], totalCount: 0, isLoading: false, providerKey: '' };

let cache: CacheState = { ...EMPTY_CACHE };
let activeAbort: AbortController | null = null;

export function resetUnifiedLikedCache(): void {
  activeAbort?.abort();
  activeAbort = null;
  cache = { ...EMPTY_CACHE };
}

function notifySubscribers(): void {
  window.dispatchEvent(new Event(CACHE_UPDATED_EVENT));
}

function updateCache(partial: Partial<CacheState>): void {
  cache = { ...cache, ...partial };
  notifySubscribers();
}

async function fetchUnifiedLiked(providerIds: ProviderId[], signal: AbortSignal): Promise<MediaTrack[]> {
  const results = await Promise.all(
    providerIds.map(async (id) => {
      const catalog = providerRegistry.get(id)?.catalog;
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
  merged.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
  return merged;
}

function refreshCache(providerIds: ProviderId[]): void {
  activeAbort?.abort();
  const controller = new AbortController();
  activeAbort = controller;

  updateCache({ isLoading: true });

  fetchUnifiedLiked(providerIds, controller.signal)
    .then(merged => {
      if (!controller.signal.aborted) {
        updateCache({ tracks: merged, totalCount: merged.length, isLoading: false });
      }
    })
    .catch(err => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[useUnifiedLikedTracks] Fetch failed:', err);
      if (!controller.signal.aborted) {
        updateCache({ isLoading: false });
      }
    });
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CACHE_UPDATED_EVENT, callback);
  return () => window.removeEventListener(CACHE_UPDATED_EVENT, callback);
}

function getSnapshot(): CacheState {
  return cache;
}

interface UseUnifiedLikedTracksResult {
  unifiedTracks: MediaTrack[];
  totalCount: number;
  isLoading: boolean;
  refresh: () => void;
  isUnifiedLikedActive: boolean;
}

export function useUnifiedLikedTracks(): UseUnifiedLikedTracksResult {
  const { connectedProviderIds, getDescriptor } = useProviderContext();

  const likedProviderIds = useMemo(
    () => connectedProviderIds.filter(id => getDescriptor(id)?.capabilities.hasLikedCollection),
    [connectedProviderIds, getDescriptor],
  );

  const isUnifiedLikedActive = likedProviderIds.length >= 2;
  const providerKey = likedProviderIds.slice().sort().join(',');

  const state = useSyncExternalStore(subscribe, getSnapshot);

  // Trigger initial fetch when providers change, only if cache is stale
  const [lastProviderKey, setLastProviderKey] = useState('');
  useEffect(() => {
    if (!isUnifiedLikedActive) {
      if (cache.totalCount > 0 || cache.isLoading) {
        activeAbort?.abort();
        activeAbort = null;
        updateCache({ tracks: [], totalCount: 0, isLoading: false, providerKey: '' });
      }
      setLastProviderKey('');
      return;
    }
    if (providerKey !== cache.providerKey) {
      updateCache({ providerKey });
      refreshCache(likedProviderIds);
      setLastProviderKey(providerKey);
    } else if (providerKey !== lastProviderKey && cache.totalCount === 0 && !cache.isLoading) {
      refreshCache(likedProviderIds);
      setLastProviderKey(providerKey);
    }
  }, [isUnifiedLikedActive, providerKey, likedProviderIds, lastProviderKey]);

  // Listen for library refresh and Dropbox likes changes
  useEffect(() => {
    if (!isUnifiedLikedActive) return;
    const handle = () => refreshCache(likedProviderIds);
    window.addEventListener(LIBRARY_REFRESH_EVENT, handle);
    window.addEventListener(LIKES_CHANGED_EVENT, handle);
    return () => {
      window.removeEventListener(LIBRARY_REFRESH_EVENT, handle);
      window.removeEventListener(LIKES_CHANGED_EVENT, handle);
    };
  }, [isUnifiedLikedActive, likedProviderIds]);

  const refresh = useCallback(() => {
    if (isUnifiedLikedActive) refreshCache(likedProviderIds);
  }, [isUnifiedLikedActive, likedProviderIds]);

  return {
    unifiedTracks: state.tracks,
    totalCount: state.totalCount,
    isLoading: state.isLoading,
    refresh,
    isUnifiedLikedActive,
  };
}
