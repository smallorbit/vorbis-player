import { useMemo } from 'react';
import { useLibrarySync } from '@/hooks/useLibrarySync';
import { usePinnedItems } from '@/hooks/usePinnedItems';
import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';
import type { AlbumInfo } from '@/services/spotify';
import type { ProviderId } from '@/types/domain';

export interface PinnedItem {
  kind: 'playlist' | 'album';
  id: string;
  provider?: ProviderId;
  name: string;
  imageUrl?: string;
}

export interface PinnedSectionState {
  pinnedPlaylists: CachedPlaylistInfo[];
  pinnedAlbums: AlbumInfo[];
  combined: PinnedItem[];
  isLoading: boolean;
  isEmpty: boolean;
}

export function usePinnedSection(): PinnedSectionState {
  const { pinnedPlaylistIds, pinnedAlbumIds } = usePinnedItems();
  const { playlists, albums, isInitialLoadComplete } = useLibrarySync();

  const pinnedPlaylists = useMemo(
    () => playlists.filter((p) => pinnedPlaylistIds.includes(p.id)),
    [playlists, pinnedPlaylistIds],
  );

  const pinnedAlbums = useMemo(
    () => albums.filter((a) => pinnedAlbumIds.includes(a.id)),
    [albums, pinnedAlbumIds],
  );

  const combined = useMemo<PinnedItem[]>(
    () => [
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
    [pinnedPlaylists, pinnedAlbums],
  );

  return {
    pinnedPlaylists,
    pinnedAlbums,
    combined,
    isLoading: !isInitialLoadComplete,
    isEmpty: combined.length === 0,
  };
}
