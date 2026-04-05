import { createContext, useContext } from 'react';
import type * as React from 'react';
import type { AlbumInfo, PlaylistInfo } from '../../services/spotify';
import type { ProviderDescriptor } from '@/types/providers';
import type { ProviderId } from '@/types/domain';
import type { PlaylistSortOption, AlbumSortOption } from '@/utils/playlistFilters';

interface LikedSongsEntry {
  provider: ProviderId;
  count: number;
}

export interface LibraryContextValue {
  inDrawer: boolean;
  swipeZoneRef?: React.RefObject<HTMLDivElement>;
  viewMode: 'playlists' | 'albums';
  setViewMode: (v: 'playlists' | 'albums') => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  playlistSort: PlaylistSortOption;
  setPlaylistSort: (v: PlaylistSortOption) => void;
  albumSort: AlbumSortOption;
  setAlbumSort: (v: AlbumSortOption) => void;
  artistFilter: string;
  setArtistFilter: (v: string) => void;
  providerFilters: ProviderId[];
  setProviderFilters: (v: ProviderId[]) => void;
  handleProviderToggle: (provider: ProviderId) => void;
  hasActiveFilters: boolean;
  albums: AlbumInfo[];
  isInitialLoadComplete: boolean;
  showProviderBadges: boolean;
  enabledProviderIds: ProviderId[];
  likedSongsPerProvider: LikedSongsEntry[];
  likedSongsCount: number;
  isLikedSongsSyncing: boolean;
  isUnifiedLikedActive: boolean;
  unifiedLikedCount: number;
  pinnedPlaylists: PlaylistInfo[];
  unpinnedPlaylists: PlaylistInfo[];
  pinnedAlbums: AlbumInfo[];
  unpinnedAlbums: AlbumInfo[];
  isPlaylistPinned: (id: string) => boolean;
  canPinMorePlaylists: boolean;
  isAlbumPinned: (id: string) => boolean;
  canPinMoreAlbums: boolean;
  activeDescriptor: ProviderDescriptor | null;
  onPlaylistClick: (playlist: PlaylistInfo) => void;
  onPlaylistContextMenu: (playlist: PlaylistInfo, event: React.MouseEvent) => void;
  onPinPlaylistClick: (id: string, event: React.MouseEvent) => void;
  onLikedSongsClick: (provider?: ProviderId) => void;
  onAlbumClick: (album: AlbumInfo) => void;
  onAlbumContextMenu: (album: AlbumInfo, event: React.MouseEvent) => void;
  onPinAlbumClick: (id: string, event: React.MouseEvent) => void;
  onArtistClick: (artistName: string, event: React.MouseEvent) => void;
  onLibraryRefresh?: () => void;
  isLibraryRefreshing?: boolean;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export const LibraryProvider = LibraryContext.Provider;

export function useLibraryContext(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) {
    throw new Error('useLibraryContext must be used within a LibraryProvider');
  }
  return ctx;
}
