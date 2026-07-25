import { useMemo } from 'react';
import { useLibrarySync } from '@/hooks/useLibrarySync';
import { usePinnedItems } from '@/hooks/usePinnedItems';
import { LIKED_SONGS_ID } from '@/constants/playlist';
import { useLikedSection } from './useLikedSection';
import type { MediaCollection, ProviderId } from '@/types/domain';

interface PinnedItem {
  kind: 'playlist' | 'album' | 'liked';
  id: string;
  provider?: ProviderId | undefined;
  name: string;
  imageUrl?: string | undefined;
  subtitle?: string | undefined;
}

interface PinnedSectionState {
  pinnedPlaylists: MediaCollection[];
  pinnedAlbums: MediaCollection[];
  combined: PinnedItem[];
  isLoading: boolean;
  isEmpty: boolean;
}

const formatLikedSubtitle = (n: number) => `${n} song${n === 1 ? '' : 's'}`;

export function usePinnedSection(): PinnedSectionState {
  const { pinnedPlaylistIds, pinnedAlbumIds } = usePinnedItems();
  const { playlists, albums, isInitialLoadComplete } = useLibrarySync();
  const { totalCount, perProvider, isUnified, isLoading: likedIsLoading } = useLikedSection();

  const pinnedPlaylists = useMemo(() => {
    const pinnedSet = new Set(pinnedPlaylistIds);
    return playlists.filter((p) => pinnedSet.has(p.id));
  }, [playlists, pinnedPlaylistIds]);

  const pinnedAlbums = useMemo(() => {
    const pinnedSet = new Set(pinnedAlbumIds);
    return albums.filter((a) => pinnedSet.has(a.id));
  }, [albums, pinnedAlbumIds]);

  const likedEntries = useMemo<PinnedItem[]>(() => {
    if (totalCount === 0) return [];
    if (!isUnified && perProvider.length > 1) {
      return perProvider.map(({ provider, count }) => ({
        kind: 'liked' as const,
        id: `liked-${provider}`,
        provider,
        name: 'Liked Songs',
        subtitle: formatLikedSubtitle(count),
      }));
    }
    return [
      {
        kind: 'liked' as const,
        id: LIKED_SONGS_ID,
        name: 'Liked Songs',
        subtitle: formatLikedSubtitle(totalCount),
      },
    ];
  }, [totalCount, isUnified, perProvider]);

  const combined = useMemo<PinnedItem[]>(
    () => [
      ...likedEntries,
      ...pinnedPlaylists.map((p) => ({
        kind: 'playlist' as const,
        id: p.id,
        provider: p.provider,
        name: p.name,
        imageUrl: p.imageUrl,
      })),
      ...pinnedAlbums.map((a) => ({
        kind: 'album' as const,
        id: a.id,
        provider: a.provider,
        name: a.name,
        imageUrl: a.imageUrl,
      })),
    ],
    [likedEntries, pinnedPlaylists, pinnedAlbums],
  );

  return {
    pinnedPlaylists,
    pinnedAlbums,
    combined,
    isLoading: !isInitialLoadComplete || likedIsLoading,
    isEmpty: combined.length === 0,
  };
}
