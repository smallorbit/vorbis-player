import { useMemo } from 'react';
import { useLibrarySync } from '@/hooks/useLibrarySync';
import { usePinnedItems } from '@/hooks/usePinnedItems';
import { LIKED_SONGS_ID } from '@/constants/playlist';
import { useLikedSection } from './useLikedSection';
import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';
import type { AlbumInfo } from '@/services/spotify';
import type { ProviderId } from '@/types/domain';

export interface PinnedItem {
  kind: 'playlist' | 'album' | 'liked';
  id: string;
  provider?: ProviderId;
  name: string;
  imageUrl?: string;
  subtitle?: string;
}

export interface PinnedSectionState {
  pinnedPlaylists: CachedPlaylistInfo[];
  pinnedAlbums: AlbumInfo[];
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
        imageUrl: p.images?.[0]?.url,
      })),
      ...pinnedAlbums.map((a) => ({
        kind: 'album' as const,
        id: a.id,
        provider: a.provider,
        name: a.name,
        imageUrl: a.images?.[0]?.url,
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
