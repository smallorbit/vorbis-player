import { useState, useEffect, useMemo } from 'react';
import * as React from 'react';
import type { PlaylistInfo, AlbumInfo } from '../../services/spotify';
import { useProviderContext } from '@/contexts/ProviderContext';
import { CardContent, Button, Skeleton, Alert, AlertDescription } from '../styled';
import { theme } from '@/styles/theme';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useLibrarySync } from '../../hooks/useLibrarySync';
import {
  filterPlaylistsOnly,
  sortPlaylistSubgroup,
  filterAlbumsOnly,
  sortAlbumSubgroup,
  buildLibraryViewWithPins,
} from '../../utils/playlistFilters';
import { usePinnedItems } from '../../hooks/usePinnedItems';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME, toAlbumPlaylistId } from '../../constants/playlist';
import FilterChipRow from '../FilterChipRow';
import LibraryDrawerSortChip from '../LibraryDrawerSortChip';
import LibraryProviderBar from '../LibraryProviderBar';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { logQueue } from '@/lib/debugLog';
import type { AddToQueueResult, ProviderId } from '@/types/domain';
import {
  Container,
  SelectionCard,
  DrawerContentWrapper,
  TabSpinner,
  TabsContainer,
  TabButton,
  ControlsContainer,
  SortControlsRow,
  SearchInput,
  SelectDropdown,
  RefreshButton,
  DrawerRefreshButton,
  DrawerBottomControls,
  DrawerBottomRow,
  DrawerBottomActions,
  ClearButton,
  DrawerClearFiltersButton,
  LoadingState,
} from './styled';
import { useLibraryBrowsing } from './useLibraryBrowsing';
import { useItemActions } from './useItemActions';
import { PlaylistGrid } from './PlaylistGrid';
import { AlbumGrid } from './AlbumGrid';

interface PlaylistSelectionProps {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (
    playlistId: string,
    playlistName?: string,
    provider?: ProviderId,
  ) => Promise<AddToQueueResult | null>;
  /** When true, uses compact layout for drawer context (no centering, fills available space) */
  inDrawer?: boolean;
  /** Ref for swipe-to-close gesture zone (search/filters area only, not the scrollable list) */
  swipeZoneRef?: React.RefObject<HTMLDivElement>;
  /** Pre-populate the search input when the drawer opens */
  initialSearchQuery?: string;
  /** Set the active tab when the drawer opens */
  initialViewMode?: 'playlists' | 'albums';
  /** Drawer-only: show refresh button near the sort dropdown */
  onLibraryRefresh?: () => void;
  /** Drawer-only: controls the refresh spinner */
  isLibraryRefreshing?: boolean;
}

const PlaylistSelection = React.memo(function PlaylistSelection({
  onPlaylistSelect,
  onAddToQueue,
  inDrawer = false,
  swipeZoneRef,
  initialSearchQuery,
  initialViewMode,
  onLibraryRefresh,
  isLibraryRefreshing
}: PlaylistSelectionProps): JSX.Element {
  const { activeDescriptor, hasMultipleProviders, enabledProviderIds, getDescriptor } = useProviderContext();
  const { isUnifiedLikedActive, totalCount: unifiedLikedCount } = useUnifiedLikedTracks();
  const showProviderBadges = hasMultipleProviders && enabledProviderIds.length > 1;

  const {
    playlists,
    albums,
    likedSongsCount,
    likedSongsPerProvider,
    isInitialLoadComplete,
    removeCollection,
  } = useLibrarySync();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
    handleProviderToggle,
    hasActiveFilters,
  } = useLibraryBrowsing(initialSearchQuery, initialViewMode);

  const {
    handlePlaylistContextMenu,
    handleAlbumContextMenu,
    albumPopoverPortal,
    playlistPopoverPortal,
    confirmDeletePortal,
  } = useItemActions({
    onPlaylistSelect,
    onAddToQueue,
    activeDescriptor: activeDescriptor ?? null,
    getDescriptor,
    removeCollection,
  });

  const libraryFullyLoaded = isInitialLoadComplete;

  const { viewport, isMobile, isTablet } = usePlayerSizingContext();
  const {
    pinnedPlaylistIds,
    pinnedAlbumIds,
    isPlaylistPinned,
    isAlbumPinned,
    togglePinPlaylist,
    togglePinAlbum,
    canPinMorePlaylists,
    canPinMoreAlbums,
  } = usePinnedItems();

  const maxWidth = useMemo(() => {
    if (isMobile) {
      return Math.min(viewport.width * 0.95, 400);
    }
    if (isTablet) {
      return Math.min(viewport.width * 0.8, 500);
    }
    return Math.min(viewport.width * 0.6, 600);
  }, [viewport.width, isMobile, isTablet]);

  const playlistLibraryView = useMemo(() => {
    let items = playlists;
    if (providerFilters.length > 0) {
      items = items.filter((p) => p.provider && providerFilters.includes(p.provider));
    }
    const filtered = filterPlaylistsOnly(items, searchQuery);
    return buildLibraryViewWithPins(
      filtered,
      pinnedPlaylistIds,
      (p) => p.id,
      (subgroup) => sortPlaylistSubgroup(subgroup, playlistSort)
    );
  }, [playlists, searchQuery, playlistSort, providerFilters, pinnedPlaylistIds]);

  const pinnedPlaylists = playlistLibraryView.pinned;
  const unpinnedPlaylists = playlistLibraryView.unpinned;

  const albumLibraryView = useMemo(() => {
    let items = albums;
    if (providerFilters.length > 0) {
      items = items.filter((a) => a.provider && providerFilters.includes(a.provider));
    }
    const filtered = filterAlbumsOnly(items, searchQuery, 'all', artistFilter);
    return buildLibraryViewWithPins(
      filtered,
      pinnedAlbumIds,
      (a) => a.id,
      (subgroup) => sortAlbumSubgroup(subgroup, albumSort)
    );
  }, [albums, searchQuery, albumSort, artistFilter, providerFilters, pinnedAlbumIds]);

  const pinnedAlbums = albumLibraryView.pinned;
  const unpinnedAlbums = albumLibraryView.unpinned;

  useEffect(() => {
    if (!libraryFullyLoaded) return;
    if (playlists.length === 0 && albums.length === 0 && likedSongsCount === 0) {
      const providerName = activeDescriptor?.name ?? 'your music service';
      setError(
        `No playlists, albums, or liked songs found. Please add some music to ${providerName} first.`
      );
    } else {
      setError(null);
    }
  }, [libraryFullyLoaded, playlists.length, albums.length, likedSongsCount, activeDescriptor]);

  // Auth check — consider authenticated if ANY enabled provider has auth
  useEffect(() => {
    const hasAuth = enabledProviderIds.some(id => {
      const desc = getDescriptor(id);
      return desc?.auth.isAuthenticated();
    }) || activeDescriptor?.auth.isAuthenticated();
    if (hasAuth) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, [activeDescriptor, enabledProviderIds, getDescriptor]);

  // Sync loading state with the library sync engine
  useEffect(() => {
    if (isInitialLoadComplete || playlists.length > 0 || albums.length > 0) {
      setIsLoading(false);
    }
  }, [isInitialLoadComplete, playlists.length, albums.length]);

  function handlePlaylistClick(playlist: PlaylistInfo): void {
    logQueue('selected playlist: %s (%s)', playlist.name, playlist.id);
    onPlaylistSelect(playlist.id, playlist.name, playlist.provider);
  }

  function handleAlbumClick(album: AlbumInfo): void {
    logQueue('selected album: %s (%s)', album.name, album.id);
    onPlaylistSelect(toAlbumPlaylistId(album.id), album.name, album.provider);
  }

  function handleLikedSongsClick(provider?: ProviderId): void {
    const resolvedProvider = provider ?? (likedSongsPerProvider.length === 1 ? likedSongsPerProvider[0].provider : undefined);
    onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, resolvedProvider);
  }

  function handlePinPlaylistClick(id: string, event: React.MouseEvent): void {
    event.stopPropagation();
    togglePinPlaylist(id);
  }

  function handlePinAlbumClick(id: string, event: React.MouseEvent): void {
    event.stopPropagation();
    togglePinAlbum(id);
  }

  function handleArtistClick(artistName: string, event: React.MouseEvent): void {
    event.stopPropagation();
    setArtistFilter(artistName);
  }

  const searchAndSortControls = (
    inDrawer ? (
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
              onChange={(e) => setPlaylistSort(e.target.value as typeof playlistSort)}
              style={{ flex: 1, minWidth: 0 }}
            >
              <option value="recently-added">Recently Added</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </SelectDropdown>
          ) : (
            <SelectDropdown
              value={albumSort}
              onChange={(e) => setAlbumSort(e.target.value as typeof albumSort)}
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M21 2v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 22v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </RefreshButton>
          )}
        </SortControlsRow>

        {(searchQuery || artistFilter) && (
          <ClearButton
            onClick={() => {
              setSearchQuery('');
              setArtistFilter('');
              setProviderFilters([]);
            }}
          >
            Clear
          </ClearButton>
        )}
      </ControlsContainer>
    ) : (
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
            onChange={(e) => setPlaylistSort(e.target.value as typeof playlistSort)}
          >
            <option value="recently-added">Recently Added</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </SelectDropdown>
        ) : (
          <SelectDropdown
            value={albumSort}
            onChange={(e) => setAlbumSort(e.target.value as typeof albumSort)}
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
          <ClearButton
            onClick={() => {
              setSearchQuery('');
              setArtistFilter('');
              setProviderFilters([]);
            }}
          >
            Clear
          </ClearButton>
        )}
      </ControlsContainer>
    )
  );

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

  const hasAnyContent = playlists.length > 0 || albums.length > 0 || likedSongsCount > 0;
  const showMainContent = isAuthenticated && !error && (hasAnyContent || (!isLoading && !libraryFullyLoaded));

  const mainContent = showMainContent ? (
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
          playlists={playlists}
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
          activeDescriptor={activeDescriptor ?? null}
          onPlaylistClick={handlePlaylistClick}
          onPlaylistContextMenu={handlePlaylistContextMenu}
          onPinPlaylistClick={handlePinPlaylistClick}
          onLikedSongsClick={handleLikedSongsClick}
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
          onAlbumClick={handleAlbumClick}
          onAlbumContextMenu={handleAlbumContextMenu}
          onPinAlbumClick={handlePinAlbumClick}
          onArtistClick={handleArtistClick}
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
          {searchAndSortControls}
        </div>
      )}
    </>
  ) : null;

  const statusContent = (
    <>
      {isLoading && (
        <LoadingState>
          <Skeleton style={{ height: '60px' }} />
          <Skeleton style={{ height: '60px' }} />
          <Skeleton style={{ height: '60px' }} />
          <p style={{ textAlign: 'center', color: 'white' }}>Loading your library...</p>
        </LoadingState>
      )}

      {!isLoading && !isAuthenticated && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: theme.colors.muted.foreground, marginBottom: theme.spacing.lg, fontSize: theme.fontSize.lg }}>
            Connect your {activeDescriptor?.name ?? 'music provider'} account to access your playlists
          </p>
          <Button
            onClick={async () => {
              try {
                await activeDescriptor?.auth.beginLogin();
              } catch (err) {
                console.error('Failed to redirect to auth:', err);
                setError('Failed to redirect to login');
              }
            }}
            style={{
              background: theme.colors.spotify,
              color: theme.colors.white,
              border: 'none',
              padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
              fontSize: theme.fontSize.base,
              borderRadius: theme.borderRadius.lg,
              cursor: 'pointer',
              transition: `background ${theme.transitions.fast} ease`
            }}
          >
            Connect {activeDescriptor?.name ?? 'account'}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription style={{ color: theme.colors.errorText }}>
            {error}
          </AlertDescription>
        </Alert>
      )}
    </>
  );

  if (inDrawer) {
    return (
      <DrawerContentWrapper>
        {statusContent}
        {mainContent}
        {albumPopoverPortal}
        {playlistPopoverPortal}
        {confirmDeletePortal}
      </DrawerContentWrapper>
    );
  }

  return (
    <Container $inDrawer={false}>
      <SelectionCard $maxWidth={maxWidth} $inDrawer={false}>
        <CardContent style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {statusContent}
          {mainContent}
          {albumPopoverPortal}
          {playlistPopoverPortal}
          {confirmDeletePortal}
        </CardContent>
      </SelectionCard>
    </Container>
  );
});

export default PlaylistSelection;
