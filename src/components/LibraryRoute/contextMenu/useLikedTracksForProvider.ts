import { useCallback } from 'react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { fetchLikedForProvider } from '../hooks';

const TTL_MS = 60_000;

interface CacheEntry {
  tracks: MediaTrack[];
  expiresAt: number;
}

const cache = new Map<ProviderId, CacheEntry>();

export function resetLikedTracksCache(): void {
  cache.clear();
}

async function getLikedForProvider(
  provider: ProviderId,
  now: number,
  signal?: AbortSignal,
): Promise<MediaTrack[]> {
  const entry = cache.get(provider);
  if (entry && entry.expiresAt > now) {
    return entry.tracks;
  }
  const tracks = await fetchLikedForProvider(provider, signal);
  cache.set(provider, { tracks, expiresAt: now + TTL_MS });
  return tracks;
}

export interface UseLikedTracksForProviderResult {
  loadLikedTracks: (provider: ProviderId, signal?: AbortSignal) => Promise<MediaTrack[]>;
}

export function useLikedTracksForProvider(): UseLikedTracksForProviderResult {
  const loadLikedTracks = useCallback(
    (provider: ProviderId, signal?: AbortSignal) => getLikedForProvider(provider, Date.now(), signal),
    [],
  );
  return { loadLikedTracks };
}
