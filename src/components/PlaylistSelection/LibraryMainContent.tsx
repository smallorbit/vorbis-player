import type * as React from 'react';
import type { AlbumInfo, PlaylistInfo } from '../../services/spotify';
import type { ProviderDescriptor } from '@/types/providers';
import type { ProviderId } from '@/types/domain';
import type { PlaylistSortOption, AlbumSortOption } from '@/utils/playlistFilters';
import FilterChipRow from '../FilterChipRow';
import LibraryDrawerSortChip from '../LibraryDrawerSortChip';
import LibraryProviderBar from '../LibraryProviderBar';
import { PlaylistGrid } from './PlaylistGrid';
import { AlbumGrid } from './AlbumGrid';
import { LibraryControls } from './LibraryControls';
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

interface LikedSongsEntry {
  provider: ProviderId;
  count: number;
}

interface LibraryMainContentProps {
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

export function LibraryMainContent({
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
  likedSongsPerProvider,
  likedSongsCount,
  isUnifiedLikedActive,
  unifiedLikedCount,
  pinnedPlaylists,
  unpinnedPlaylists,
  pinnedAlbums,
  unpinnedAlbums,
  isPlaylistPinned,
  canPinMorePlaylists,
  isAlbumPinned,
  canPinMoreAlbums,
  activeDescriptor,
  onPlaylistClick,
  onPlaylistContextMenu,
  onPinPlaylistClick,
  onLikedSongsClick,
  onAlbumClick,
  onAlbumContextMenu,
  onPinAlbumClick,
  onArtistClick,
  onLibraryRefresh,
  isLibraryRefreshing,
}: LibraryMainContentProps): React.JSX.Element {
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

      {viewMode === 'playlists' && (
        <PlaylistGrid
          inDrawer={inDrawer}
          likedSongsPerProvider={likedSongsPerProvider}
          likedSongsCount={likedSongsCount}
          isUnifiedLikedActive={isUnifiedLikedActive}
          unifiedLikedCount={unifiedLikedCount}
          isInitialLoadComplete={isInitialLoadComplete}
          showProviderBadges={showProviderBadges}
          hasActiveFilters={hasActiveFilters}
          searchQuery={searchQuery}
          pinnedPlaylists={pinnedPlaylists}
          unpinnedPlaylists={unpinnedPlaylists}
          isPlaylistPinned={isPlaylistPinned}
          canPinMorePlaylists={canPinMorePlaylists}
          activeDescriptor={activeDescriptor}
          onPlaylistClick={onPlaylistClick}
          onPlaylistContextMenu={onPlaylistContextMenu}
          onPinPlaylistClick={onPinPlaylistClick}
          onLikedSongsClick={onLikedSongsClick}
        />
      )}

      {viewMode === 'albums' && (
        <AlbumGrid
          inDrawer={inDrawer}
          albums={albums}
          isInitialLoadComplete={isInitialLoadComplete}
          showProviderBadges={showProviderBadges}
          searchQuery={searchQuery}
          artistFilter={artistFilter}
          pinnedAlbums={pinnedAlbums}
          unpinnedAlbums={unpinnedAlbums}
          isAlbumPinned={isAlbumPinned}
          canPinMoreAlbums={canPinMoreAlbums}
          onAlbumClick={onAlbumClick}
          onAlbumContextMenu={onAlbumContextMenu}
          onPinAlbumClick={onPinAlbumClick}
          onArtistClick={onArtistClick}
        />
      )}

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
