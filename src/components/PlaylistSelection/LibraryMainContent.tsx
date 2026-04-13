import type * as React from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import LibraryDrawerSortChip from '../LibraryDrawerSortChip';
import { FilterSidebar } from '../LibraryDrawer/FilterSidebar';
import { PlaylistGrid } from './PlaylistGrid';
import { AlbumGrid } from './AlbumGrid';
import { LibraryControls } from './LibraryControls';
import { useLibraryBrowsingContext, useLibraryActions, useLibraryData } from './LibraryContext';
import { RefreshIcon } from './utils';
import {
  DrawerRefreshButton,
  DrawerBottomControls,
  DrawerBottomRow,
  DrawerBottomActions,
  DrawerClearFiltersButton,
} from './styled';

const DrawerContent = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 0;

  /* On mobile: stack filters above content */
  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
  }
`;

const MainContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

export function LibraryMainContent(): React.JSX.Element {
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    playlistSort,
    setPlaylistSort,
    albumSort,
    setAlbumSort,
    artistFilter,
    setArtistFilter,
    providerFilters,
    setProviderFilters,
    availableGenres,
    selectedGenres,
    setSelectedGenres,
    recentlyAddedFilter,
    setRecentlyAddedFilter,
    hasActiveFilters,
  } = useLibraryBrowsingContext();
  const { onLibraryRefresh, isLibraryRefreshing } = useLibraryActions();
  const { inDrawer, enabledProviderIds, showProviderBadges } = useLibraryData();

  if (inDrawer) {
    return (
      <DrawerContent>
        <FilterSidebar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          collectionType={viewMode}
          onCollectionTypeChange={setViewMode}
          enabledProviderIds={enabledProviderIds}
          selectedProviderIds={providerFilters}
          onProviderFilterChange={setProviderFilters}
          showProviderFilter={showProviderBadges}
          availableGenres={availableGenres}
          selectedGenres={selectedGenres}
          onGenreChange={setSelectedGenres}
          recentlyAdded={recentlyAddedFilter}
          onRecentlyAddedChange={setRecentlyAddedFilter}
        />
        <MainContent>
          {viewMode === 'playlists' && <PlaylistGrid />}

          {viewMode === 'albums' && <AlbumGrid />}

          <DrawerBottomControls>
            <DrawerBottomRow>
              <DrawerBottomActions>
                <LibraryDrawerSortChip
                  viewMode={viewMode}
                  playlistSort={playlistSort}
                  albumSort={albumSort}
                  onPlaylistSortChange={setPlaylistSort}
                  onAlbumSortChange={setAlbumSort}
                />
                {hasActiveFilters && (
                  <DrawerClearFiltersButton
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setArtistFilter('');
                      setProviderFilters([]);
                      setSelectedGenres([]);
                      setRecentlyAddedFilter('all');
                    }}
                    aria-label="Clear filters"
                  >
                    Clear
                  </DrawerClearFiltersButton>
                )}
                {onLibraryRefresh && (
                  <DrawerRefreshButton
                    onClick={onLibraryRefresh}
                    $spinning={!!isLibraryRefreshing}
                    aria-label="Refresh library"
                    title="Refresh library"
                  >
                    <RefreshIcon />
                  </DrawerRefreshButton>
                )}
              </DrawerBottomActions>
            </DrawerBottomRow>
          </DrawerBottomControls>
        </MainContent>
      </DrawerContent>
    );
  }

  return (
    <>
      {viewMode === 'playlists' && <PlaylistGrid />}

      {viewMode === 'albums' && <AlbumGrid />}

      <div style={{ marginTop: '1.5rem' }}>
        <LibraryControls
          inDrawer={false}
          viewMode={viewMode}
          playlistSort={playlistSort}
          setPlaylistSort={setPlaylistSort}
          albumSort={albumSort}
          setAlbumSort={setAlbumSort}
          artistFilter={artistFilter}
          setArtistFilter={setArtistFilter}
          setProviderFilters={setProviderFilters}
          onLibraryRefresh={onLibraryRefresh}
          isLibraryRefreshing={isLibraryRefreshing}
        />
      </div>
    </>
  );
}
