import type * as React from 'react';
import type { PlaylistSortOption, AlbumSortOption } from '@/utils/playlistFilters';
import type { ProviderId } from '@/types/domain';
import {
  ControlsContainer,
  SortControlsRow,
  SearchInput,
  SelectDropdown,
  RefreshButton,
  ClearButton,
} from './styled';

interface LibraryControlsProps {
  inDrawer: boolean;
  viewMode: 'playlists' | 'albums';
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  playlistSort: PlaylistSortOption;
  setPlaylistSort: (v: PlaylistSortOption) => void;
  albumSort: AlbumSortOption;
  setAlbumSort: (v: AlbumSortOption) => void;
  artistFilter: string;
  setArtistFilter: (v: string) => void;
  setProviderFilters: (v: ProviderId[]) => void;
  onLibraryRefresh?: () => void;
  isLibraryRefreshing?: boolean;
}

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M21 2v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 22v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function LibraryControls({
  inDrawer,
  viewMode,
  searchQuery,
  setSearchQuery,
  playlistSort,
  setPlaylistSort,
  albumSort,
  setAlbumSort,
  artistFilter,
  setArtistFilter,
  setProviderFilters,
  onLibraryRefresh,
  isLibraryRefreshing,
}: LibraryControlsProps): React.JSX.Element {
  const clearFilters = () => {
    setSearchQuery('');
    setArtistFilter('');
    setProviderFilters([]);
  };

  if (inDrawer) {
    return (
      <ControlsContainer $inDrawer>
        <SearchInput
          type="text"
          placeholder={viewMode === 'playlists' ? 'Search playlists...' : 'Search albums...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <SortControlsRow>
          {viewMode === 'playlists' ? (
            <SelectDropdown
              value={playlistSort}
              onChange={(e) => setPlaylistSort(e.target.value as PlaylistSortOption)}
              style={{ flex: 1, minWidth: 0 }}
            >
              <option value="recently-added">Recently Added</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </SelectDropdown>
          ) : (
            <SelectDropdown
              value={albumSort}
              onChange={(e) => setAlbumSort(e.target.value as AlbumSortOption)}
              style={{ flex: 1, minWidth: 0 }}
            >
              <option value="recently-added">Recently Added</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="artist-asc">Artist (A-Z)</option>
              <option value="artist-desc">Artist (Z-A)</option>
              <option value="release-newest">Release (Newest)</option>
              <option value="release-oldest">Release (Oldest)</option>
            </SelectDropdown>
          )}

          {onLibraryRefresh && (
            <RefreshButton
              onClick={onLibraryRefresh}
              $spinning={!!isLibraryRefreshing}
              aria-label="Refresh library"
              title="Refresh library"
            >
              <RefreshIcon />
            </RefreshButton>
          )}
        </SortControlsRow>

        {(searchQuery || artistFilter) && (
          <ClearButton onClick={clearFilters}>Clear</ClearButton>
        )}
      </ControlsContainer>
    );
  }

  return (
    <ControlsContainer>
      <SearchInput
        type="text"
        placeholder={viewMode === 'playlists' ? 'Search playlists...' : 'Search albums...'}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {viewMode === 'playlists' ? (
        <SelectDropdown
          value={playlistSort}
          onChange={(e) => setPlaylistSort(e.target.value as PlaylistSortOption)}
        >
          <option value="recently-added">Recently Added</option>
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
        </SelectDropdown>
      ) : (
        <SelectDropdown
          value={albumSort}
          onChange={(e) => setAlbumSort(e.target.value as AlbumSortOption)}
        >
          <option value="recently-added">Recently Added</option>
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="artist-asc">Artist (A-Z)</option>
          <option value="artist-desc">Artist (Z-A)</option>
          <option value="release-newest">Release (Newest)</option>
          <option value="release-oldest">Release (Oldest)</option>
        </SelectDropdown>
      )}

      {(searchQuery || artistFilter) && (
        <ClearButton onClick={clearFilters}>Clear</ClearButton>
      )}
    </ControlsContainer>
  );
}
