import { createContext, useContext } from 'react';
import type * as React from 'react';
import type { AlbumInfo, PlaylistInfo } from '../../services/spotify';
import type { ProviderDescriptor } from '@/types/providers';
import type { ProviderId } from '@/types/domain';
import type { PlaylistSortOption, AlbumSortOption, RecentlyAddedFilterOption } from '@/utils/playlistFilters';

interface LikedSongsEntry {
  provider: ProviderId;
  count: number;
}

export interface LibraryBrowsingContextValue {
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
  availableGenres: string[];
  selectedGenres: string[];
  setSelectedGenres: (v: string[]) => void;
  handleGenreToggle: (genre: string) => void;
  recentlyAddedFilter: RecentlyAddedFilterOption;
  setRecentlyAddedFilter: (v: RecentlyAddedFilterOption) => void;
  hasActiveFilters: boolean;
  handleClearFilters: () => void;
}

export interface LibraryPinContextValue {
  pinnedPlaylists: PlaylistInfo[];
  unpinnedPlaylists: PlaylistInfo[];
  pinnedAlbums: AlbumInfo[];
  unpinnedAlbums: AlbumInfo[];
  isPlaylistPinned: (id: string) => boolean;
  canPinMorePlaylists: boolean;
  isAlbumPinned: (id: string) => boolean;
  canPinMoreAlbums: boolean;
  onPinPlaylistClick: (id: string, event: React.MouseEvent) => void;
  onPinAlbumClick: (id: string, event: React.MouseEvent) => void;
}

export interface LibraryActionsContextValue {
  onPlaylistClick: (playlist: PlaylistInfo) => void;
  onPlaylistContextMenu: (playlist: PlaylistInfo, event: React.MouseEvent) => void;
  onLikedSongsClick: (provider?: ProviderId) => void;
  onAlbumClick: (album: AlbumInfo) => void;
  onAlbumContextMenu: (album: AlbumInfo, event: React.MouseEvent) => void;
  onArtistClick: (artistName: string, event: React.MouseEvent) => void;
  onLibraryRefresh?: () => void;
  isLibraryRefreshing?: boolean;
}

export interface LibraryDataContextValue {
  inDrawer: boolean;
  swipeZoneRef?: React.RefObject<HTMLDivElement>;
  albums: AlbumInfo[];
  isInitialLoadComplete: boolean;
  showProviderBadges: boolean;
  enabledProviderIds: ProviderId[];
  likedSongsPerProvider: LikedSongsEntry[];
  likedSongsCount: number;
  isLikedSongsSyncing: boolean;
  isUnifiedLikedActive: boolean;
  unifiedLikedCount: number;
  activeDescriptor: ProviderDescriptor | null;
}

export type LibraryContextValue =
  LibraryBrowsingContextValue &
  LibraryPinContextValue &
  LibraryActionsContextValue &
  LibraryDataContextValue;

const LibraryBrowsingContext = createContext<LibraryBrowsingContextValue | null>(null);
const LibraryPinContext = createContext<LibraryPinContextValue | null>(null);
const LibraryActionsContext = createContext<LibraryActionsContextValue | null>(null);
const LibraryDataContext = createContext<LibraryDataContextValue | null>(null);

export const LibraryBrowsingProvider = LibraryBrowsingContext.Provider;
export const LibraryPinProvider = LibraryPinContext.Provider;
export const LibraryActionsProvider = LibraryActionsContext.Provider;
export const LibraryDataProvider = LibraryDataContext.Provider;

export function useLibraryBrowsingContext(): LibraryBrowsingContextValue {
  const ctx = useContext(LibraryBrowsingContext);
  if (!ctx) {
    throw new Error('useLibraryBrowsingContext must be used within a LibraryBrowsingProvider');
  }
  return ctx;
}

export function useLibraryPins(): LibraryPinContextValue {
  const ctx = useContext(LibraryPinContext);
  if (!ctx) {
    throw new Error('useLibraryPins must be used within a LibraryPinProvider');
  }
  return ctx;
}

export function useLibraryActions(): LibraryActionsContextValue {
  const ctx = useContext(LibraryActionsContext);
  if (!ctx) {
    throw new Error('useLibraryActions must be used within a LibraryActionsProvider');
  }
  return ctx;
}

export function useLibraryData(): LibraryDataContextValue {
  const ctx = useContext(LibraryDataContext);
  if (!ctx) {
    throw new Error('useLibraryData must be used within a LibraryDataProvider');
  }
  return ctx;
}

export function useLibraryContext(): LibraryContextValue {
  const browsing = useLibraryBrowsingContext();
  const pins = useLibraryPins();
  const actions = useLibraryActions();
  const data = useLibraryData();
  return { ...browsing, ...pins, ...actions, ...data };
}
