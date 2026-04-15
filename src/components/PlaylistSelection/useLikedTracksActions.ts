import { useState, useCallback } from 'react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import { resolvePlaylistRef } from '@/constants/playlist';
import { logLibrary } from '@/lib/debugLog';

async function fetchLikedTracksForCollection(
  collectionId: string,
  descriptor: ProviderDescriptor,
): Promise<MediaTrack[]> {
  const providerId = descriptor.id;
  const { id, kind } = resolvePlaylistRef(collectionId, providerId);
  const collectionRef = { provider: providerId, kind, id } as const;
  const allTracks = await descriptor.catalog.listTracks(collectionRef);

  if (!descriptor.catalog.isTrackSaved) return [];

  const savedResults = await Promise.all(
    allTracks.map((track) => descriptor.catalog.isTrackSaved!(track.id).catch(() => false))
  );

  return allTracks.filter((_, i) => savedResults[i]);
}

export interface UseLikedTracksActionsReturn {
  likedLoading: boolean;
  handlePlayLiked: (
    collectionId: string,
    collectionName: string,
    collectionProvider: ProviderId | undefined,
  ) => void;
  handleQueueLiked: (collectionId: string, collectionName: string) => void;
}

export function useLikedTracksActions(
  descriptor: ProviderDescriptor | null | undefined,
  onPlayLikedTracks: ((tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>) | undefined,
  onQueueLikedTracks: ((tracks: MediaTrack[], collectionName?: string) => void) | undefined,
): UseLikedTracksActionsReturn {
  const [likedLoading, setLikedLoading] = useState(false);

  const handlePlayLiked = useCallback((
    collectionId: string,
    collectionName: string,
    collectionProvider: ProviderId | undefined,
  ) => {
    if (!descriptor || !onPlayLikedTracks || likedLoading) return;
    setLikedLoading(true);
    fetchLikedTracksForCollection(collectionId, descriptor)
      .then((likedTracks) => {
        if (likedTracks.length > 0) {
          return onPlayLikedTracks(likedTracks, collectionId, collectionName, collectionProvider);
        }
      })
      .catch((err) => { logLibrary('[PlayLiked] Failed:', err); })
      .finally(() => { setLikedLoading(false); });
  }, [descriptor, onPlayLikedTracks, likedLoading]);

  const handleQueueLiked = useCallback((collectionId: string, collectionName: string) => {
    if (!descriptor || !onQueueLikedTracks || likedLoading) return;
    setLikedLoading(true);
    fetchLikedTracksForCollection(collectionId, descriptor)
      .then((likedTracks) => {
        if (likedTracks.length > 0) {
          onQueueLikedTracks(likedTracks, collectionName);
        }
      })
      .catch((err) => { logLibrary('[QueueLiked] Failed:', err); })
      .finally(() => { setLikedLoading(false); });
  }, [descriptor, onQueueLikedTracks, likedLoading]);

  return { likedLoading, handlePlayLiked, handleQueueLiked };
}
