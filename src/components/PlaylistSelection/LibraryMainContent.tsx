import type * as React from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import FilterChipRow from '../FilterChipRow';
import LibraryDrawerSortChip from '../LibraryDrawerSortChip';
import LibraryProviderBar from '../LibraryProviderBar';
import { FilterSidebar } from '../LibraryDrawer/FilterSidebar';
import { PlaylistGrid } from './PlaylistGrid';
import { AlbumGrid } from './AlbumGrid';
import { LibraryControls } from './LibraryControls';
import { useLibraryContext } from './LibraryContext';
import { RefreshIcon } from './utils';
import {
  TabSpinner,
  TabsContainer,
  TabButton,
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
    inDrawer,
    swipeZoneRef,
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
    handleProviderToggle,
    availableGenres,
    selectedGenres,
    setSelectedGenres,
    recentlyAddedFilter,
    setRecentlyAddedFilter,
    hasActiveFilters,
    albums,
    isInitialLoadComplete,
    showProviderBadges,
    enabledProviderIds,
    onLibraryRefresh,
    isLibraryRefreshing,
  } = useLibraryContext();

  const tabsBar = (
    <TabsContainer>
      <TabButton
        $active={viewMode === 'playlists'}
        onClick={() => setViewMode('playlists')}
      >
        Playlists{!isInitialLoadComplete && <TabSpinner />}
      </TabButton>
      <TabButton
        $active={viewMode === 'albums'}
        onClick={() => setViewMode('albums')}
      >
        Albums{!isInitialLoadComplete && <TabSpinner />}
      </TabButton>
    </TabsContainer>
  );

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
          <div ref={swipeZoneRef} style={{ flexShrink: 0, touchAction: 'pan-y' }}>
            {tabsBar}
          </div>

          <FilterChipRow
            viewMode={viewMode}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            enabledProviderIds={enabledProviderIds}
            activeProviderFilters={providerFilters}
            onProviderToggle={handleProviderToggle}
            showProviderChips={showProviderBadges}
            albums={albums}
            artistFilter={artistFilter}
            onArtistFilterChange={setArtistFilter}
          />

          {viewMode === 'playlists' && <PlaylistGrid />}

          {viewMode === 'albums' && <AlbumGrid />}

          <DrawerBottomControls>
            <DrawerBottomRow>
              <LibraryProviderBar variant="drawerBottom" />
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
      <LibraryProviderBar />
      <div style={{ flexShrink: 0, touchAction: 'pan-y' }}>
        {tabsBar}
      </div>

      {viewMode === 'playlists' && <PlaylistGrid />}

      {viewMode === 'albums' && <AlbumGrid />}

      <div style={{ marginTop: '1.5rem' }}>
        <LibraryControls
          inDrawer={false}
          viewMode={viewMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
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
