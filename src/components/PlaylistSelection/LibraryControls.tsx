import type * as React from 'react';
import type { PlaylistSortOption, AlbumSortOption } from '@/utils/playlistFilters';
import { PLAYLIST_SORT_LABELS, ALBUM_SORT_LABELS } from '@/utils/playlistFilters';
import type { ProviderId } from '@/types/domain';
import {
  ControlsContainer,
  SortControlsRow,
  SelectDropdown,
  RefreshButton,
  ClearButton,
} from './styled';
import { RefreshIcon } from './utils';

interface LibraryControlsProps {
  inDrawer: boolean;
  viewMode: 'playlists' | 'albums';
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

export function LibraryControls({
  inDrawer,
  viewMode,
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
    setArtistFilter('');
    setProviderFilters([]);
  };

  if (inDrawer) {
    return (
      <ControlsContainer $inDrawer>
        <SortControlsRow>
          {viewMode === 'playlists' ? (
            <SelectDropdown
              value={playlistSort}
              onChange={(e) => setPlaylistSort(e.target.value as PlaylistSortOption)}
              style={{ flex: 1, minWidth: 0 }}
            >
              {Object.entries(PLAYLIST_SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectDropdown>
          ) : (
            <SelectDropdown
              value={albumSort}
              onChange={(e) => setAlbumSort(e.target.value as AlbumSortOption)}
              style={{ flex: 1, minWidth: 0 }}
            >
              {Object.entries(ALBUM_SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
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

        {artistFilter && (
          <ClearButton onClick={clearFilters}>Clear</ClearButton>
        )}
      </ControlsContainer>
    );
  }

  return (
    <ControlsContainer>
      {viewMode === 'playlists' ? (
        <SelectDropdown
          value={playlistSort}
          onChange={(e) => setPlaylistSort(e.target.value as PlaylistSortOption)}
        >
          {Object.entries(PLAYLIST_SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectDropdown>
      ) : (
        <SelectDropdown
          value={albumSort}
          onChange={(e) => setAlbumSort(e.target.value as AlbumSortOption)}
        >
          {Object.entries(ALBUM_SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectDropdown>
      )}

      {artistFilter && (
        <ClearButton onClick={clearFilters}>Clear</ClearButton>
      )}
    </ControlsContainer>
  );
}
