import { useCallback } from 'react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';

async function fetchLikedTracksForCollection(
  collectionId: string,
  provider: ProviderId,
  kind: 'playlist' | 'album',
): Promise<MediaTrack[]> {
  const descriptor = providerRegistry.get(provider);
  if (!descriptor?.catalog.listTracks || !descriptor.catalog.isTrackSaved) return [];

  const allTracks = await descriptor.catalog.listTracks({ provider, kind, id: collectionId });

  const savedResults = await Promise.all(
    allTracks.map((track) => descriptor.catalog.isTrackSaved!(track.id).catch(() => false)),
  );

  return allTracks.filter((_, i) => savedResults[i]);
}

export interface UseQueueLikedFromCollectionResult {
  queueLikedFromCollection: (
    collectionId: string,
    collectionName: string,
    provider: ProviderId,
    kind: 'playlist' | 'album',
  ) => Promise<void>;
}

export function useQueueLikedFromCollection(
  onQueueLikedTracks: ((tracks: MediaTrack[], collectionName?: string) => void) | undefined,
): UseQueueLikedFromCollectionResult {
  const queueLikedFromCollection = useCallback(
    (collectionId: string, collectionName: string, provider: ProviderId, kind: 'playlist' | 'album'): Promise<void> => {
      if (!onQueueLikedTracks) return Promise.resolve();
      return fetchLikedTracksForCollection(collectionId, provider, kind).then((tracks) => {
        if (tracks.length > 0) onQueueLikedTracks(tracks, collectionName);
      });
    },
    [onQueueLikedTracks],
  );

  return { queueLikedFromCollection };
}
