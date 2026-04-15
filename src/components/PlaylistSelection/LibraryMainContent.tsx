import type * as React from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
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
  TabsContainer,
  TabButton,
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
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const ProviderFilterRow = styled.div`
  display: flex;
  flex-shrink: 0;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const ProviderChip = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  flex-shrink: 0;
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  border-radius: 999px;
  border: 1px solid
    ${({ $active }) =>
      $active ? theme.colors.control.borderHover : theme.colors.control.border};
  background: ${({ $active }) =>
    $active ? theme.colors.control.backgroundHover : 'transparent'};
  color: ${({ $active }) => ($active ? theme.colors.white : theme.colors.muted.foreground)};
  font-size: ${theme.fontSize.sm};
  font-weight: ${({ $active }) => ($active ? theme.fontWeight.semibold : theme.fontWeight.normal)};
  cursor: pointer;
  transition: all ${theme.transitions.fast};

  &:hover {
    background: ${theme.colors.control.backgroundHover};
    border-color: ${theme.colors.control.borderHover};
    color: ${theme.colors.white};
  }

  &:active {
    opacity: 0.8;
  }
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
    providerFilters,
    setProviderFilters,
    handleProviderToggle,
    availableGenres,
    selectedGenres,
    setSelectedGenres,
    recentlyAddedFilter,
    setRecentlyAddedFilter,
  } = useLibraryBrowsingContext();
  const { onLibraryRefresh, isLibraryRefreshing } = useLibraryActions();
  const { inDrawer, showProviderBadges, enabledProviderIds } = useLibraryData();

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
          playlistSort={playlistSort}
          setPlaylistSort={setPlaylistSort}
          albumSort={albumSort}
          setAlbumSort={setAlbumSort}
        />
        <MainContent>
          {viewMode === 'playlists' && <PlaylistGrid />}

          {viewMode === 'albums' && <AlbumGrid />}

          <DrawerBottomControls>
            <DrawerBottomRow>
              <DrawerBottomActions>
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
      <div style={{ flexShrink: 0 }}>
        <TabsContainer>
          <TabButton $active={viewMode === 'playlists'} onClick={() => setViewMode('playlists')}>
            Playlists
          </TabButton>
          <TabButton $active={viewMode === 'albums'} onClick={() => setViewMode('albums')}>
            Albums
          </TabButton>
        </TabsContainer>
      </div>

      {viewMode === 'playlists' && <PlaylistGrid />}

      {viewMode === 'albums' && <AlbumGrid />}

      <div style={{ marginTop: '1.5rem' }}>
        <LibraryControls
          inDrawer={false}
          onLibraryRefresh={onLibraryRefresh}
          isLibraryRefreshing={isLibraryRefreshing}
        />
      </div>

      {showProviderBadges && (
        <ProviderFilterRow>
          {enabledProviderIds.map((provider) => {
            const isActive = providerFilters.length === 0 || providerFilters.includes(provider);
            return (
              <ProviderChip
                key={provider}
                $active={isActive}
                onClick={() => handleProviderToggle(provider)}
                aria-pressed={isActive}
                aria-label={`Filter by ${provider}`}
              >
                {provider}
              </ProviderChip>
            );
          })}
        </ProviderFilterRow>
      )}
    </>
  );
}
