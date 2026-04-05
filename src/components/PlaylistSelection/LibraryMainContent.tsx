import type * as React from 'react';
import FilterChipRow from '../FilterChipRow';
import LibraryDrawerSortChip from '../LibraryDrawerSortChip';
import LibraryProviderBar from '../LibraryProviderBar';
import { PlaylistGrid } from './PlaylistGrid';
import { AlbumGrid } from './AlbumGrid';
import { LibraryControls } from './LibraryControls';
import { useLibraryContext } from './LibraryContext';
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

  return (
    <>
      {!inDrawer && <LibraryProviderBar />}
      <div ref={inDrawer ? swipeZoneRef : undefined} style={inDrawer ? { flexShrink: 0, touchAction: 'pan-y' } : undefined}>
        {tabsBar}
      </div>

      {inDrawer && (
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
      )}

      {viewMode === 'playlists' && <PlaylistGrid />}

      {viewMode === 'albums' && <AlbumGrid />}

      {inDrawer && (
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M21 2v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 22v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </DrawerRefreshButton>
              )}
            </DrawerBottomActions>
          </DrawerBottomRow>
        </DrawerBottomControls>
      )}

      {!inDrawer && (
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
      )}
    </>
  );
}
