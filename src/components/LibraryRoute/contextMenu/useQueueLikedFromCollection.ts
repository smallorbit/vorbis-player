import { useCallback } from 'react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';
import { resolvePlaylistRef } from '@/constants/playlist';

async function fetchLikedTracksForCollection(
  collectionId: string,
  provider: ProviderId,
): Promise<MediaTrack[]> {
  const descriptor = providerRegistry.get(provider);
  if (!descriptor?.catalog.listTracks || !descriptor.catalog.isTrackSaved) return [];

  const { id, kind } = resolvePlaylistRef(collectionId, provider);
  const allTracks = await descriptor.catalog.listTracks({ provider, kind, id });

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
  ) => void;
}

export function useQueueLikedFromCollection(
  onQueueLikedTracks: ((tracks: MediaTrack[], collectionName?: string) => void) | undefined,
): UseQueueLikedFromCollectionResult {
  const queueLikedFromCollection = useCallback(
    (collectionId: string, collectionName: string, provider: ProviderId) => {
      if (!onQueueLikedTracks) return;
      void fetchLikedTracksForCollection(collectionId, provider).then((tracks) => {
        if (tracks.length > 0) onQueueLikedTracks(tracks, collectionName);
      });
    },
    [onQueueLikedTracks],
  );

  return { queueLikedFromCollection };
}
