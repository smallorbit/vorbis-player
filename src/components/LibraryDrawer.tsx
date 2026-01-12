import React, { Suspense, memo, useMemo, useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';
import { usePlayerSizing } from '../hooks/usePlayerSizing';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  getUserPlaylists,
  getUserAlbums,
  getLikedSongsCount,
  getCachedData,
  spotifyAuth,
  type PlaylistInfo,
  type AlbumInfo
} from '../services/spotify';
import {
  filterAndSortPlaylists,
  filterAndSortAlbums,
  getAvailableDecades,
  type PlaylistSortOption,
  type AlbumSortOption,
  type YearFilterOption
} from '../utils/playlistFilters';

type ViewMode = 'playlists' | 'albums';

interface LibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaylistSelect: (playlistId: string, playlistName: string) => void;
}

function selectOptimalImage(
  images: { url: string; width: number | null; height: number | null }[],
  targetSize: number = 64
): string | undefined {
  if (!images?.length) {
    return undefined;
  }

  const suitable = images
    .filter(img => (img.width || 0) >= targetSize)
    .sort((a, b) => (a.width || 0) - (b.width || 0));

  return suitable[0]?.url || images[images.length - 1]?.url;
}

const LibraryDrawerContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isOpen', 'width', 'transitionDuration', 'transitionEasing'].includes(prop),
}) <{ isOpen: boolean; width: number; transitionDuration: number; transitionEasing: string }>`
  position: fixed;
  top: 0;
  right: 0;
  width: ${({ width }) => width}px;
  height: 100vh;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(${theme.drawer.backdropBlur});
  border-left: 1px solid ${theme.colors.popover.border};
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform ${({ transitionDuration }) => transitionDuration}ms ${({ transitionEasing }) => transitionEasing},
            width ${({ transitionDuration }) => transitionDuration}ms ${({ transitionEasing }) => transitionEasing};
  z-index: ${theme.zIndex.modal};
  overflow-y: auto;
  padding: ${theme.spacing.md};
  box-sizing: border-box;
  
  /* Enable container queries */
  container-type: inline-size;
  container-name: library;
  
  /* Container query responsive adjustments */
  @container library (max-width: ${theme.breakpoints.md}) {
    width: ${theme.drawer.widths.mobile};
    padding: ${theme.spacing.sm};
  }
  
  @container library (min-width: ${theme.breakpoints.md}) and (max-width: ${theme.drawer.breakpoints.mobile}) {
    width: ${theme.drawer.widths.tablet};
    padding: ${theme.spacing.md};
  }
  
  @container library (min-width: ${theme.drawer.breakpoints.mobile}) {
    width: ${theme.drawer.widths.desktop};
    padding: ${theme.spacing.lg};
  }
  
  /* Fallback for browsers without container query support */
  @supports not (container-type: inline-size) {
    @media (max-width: ${theme.breakpoints.sm}) {
      width: ${theme.drawer.widths.mobile};
    }
  }
`;

const LibraryContent = styled.div`
  padding: ${theme.spacing.sm} 0 ${theme.spacing.md} 0;
`;

const LibraryOverlay = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isOpen'].includes(prop),
}) <{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: ${theme.colors.overlay.light};
  backdrop-filter: blur(2px);
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: all ${theme.drawer.transitionDuration}ms ${theme.drawer.transitionEasing};
  z-index: ${theme.zIndex.overlay};
`;

const LibraryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.md};
  padding-bottom: ${theme.spacing.md};
  border-bottom: 1px solid ${theme.colors.popover.border};
`;

const LibraryTitle = styled.h3`
  color: ${theme.colors.white};
  margin: 0;
  font-size: ${theme.fontSize.xl};
  font-weight: ${theme.fontWeight.semibold};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xl};
  cursor: pointer;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  transition: all ${theme.transitions.fast};
  
  &:hover {
    background: ${theme.colors.muted.background};
    color: ${theme.colors.white};
  }
`;

const TabsContainer = styled.div`
  display: flex;
  gap: 0;
  margin-bottom: ${theme.spacing.md};
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
`;

const TabButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: none;
  border: none;
  color: ${props => props.$active ? '#1db954' : 'rgba(255, 255, 255, 0.6)'};
  font-size: ${theme.fontSize.base};
  font-weight: ${theme.fontWeight.semibold};
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid ${props => props.$active ? '#1db954' : 'transparent'};
  margin-bottom: -2px;
  position: relative;

  &:hover {
    color: ${props => props.$active ? '#1db954' : 'rgba(255, 255, 255, 0.9)'};
  }

  &:focus {
    outline: none;
  }
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  align-items: center;
  margin-bottom: ${theme.spacing.md};
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 180px;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: rgba(115, 115, 115, 0.2);
  border: 1px solid rgba(115, 115, 115, 0.4);
  border-radius: ${theme.borderRadius.md};
  color: white;
  font-size: ${theme.fontSize.sm};
  outline: none;
  transition: border-color 0.2s, background 0.2s;

  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  &:focus {
    background: rgba(115, 115, 115, 0.3);
    border-color: ${theme.colors.accent};
  }
`;

const SelectDropdown = styled.select`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: rgba(115, 115, 115, 0.2);
  border: 1px solid rgba(115, 115, 115, 0.4);
  border-radius: ${theme.borderRadius.md};
  color: white;
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s, background 0.2s;

  &:hover {
    background: rgba(115, 115, 115, 0.3);
  }

  &:focus {
    border-color: ${theme.colors.accent};
  }

  option {
    background: #262626;
    color: white;
  }
`;

const ClearButton = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: rgba(115, 115, 115, 0.2);
  border: 1px solid rgba(115, 115, 115, 0.4);
  border-radius: ${theme.borderRadius.md};
  color: rgba(255, 255, 255, 0.7);
  font-size: ${theme.fontSize.sm};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(115, 115, 115, 0.3);
    color: white;
  }
`;

const PlaylistGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.sm} 0;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
`;

const PlaylistItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.md};
  background: rgba(115, 115, 115, 0.1);
  border: 1px solid rgba(115, 115, 115, 0.3);
  border-radius: ${theme.borderRadius.lg};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(218, 165, 32, 0.1);
    border-color: ${theme.colors.accent};
    transform: translateY(-2px);
  }
`;

const PlaylistImageWrapper = styled.div`
  width: 100%;
  aspect-ratio: 1;
  border-radius: ${theme.borderRadius.md};
  overflow: hidden;
  background: linear-gradient(45deg, #333, #555);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const PlaylistInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const PlaylistName = styled.div`
  font-weight: ${theme.fontWeight.semibold};
  font-size: ${theme.fontSize.base};
  color: white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: ${theme.spacing.xs};
`;

const PlaylistDetails = styled.div`
  font-size: ${theme.fontSize.sm};
  color: rgba(255, 255, 255, 0.6);
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
  padding: ${theme.spacing.xl};
  align-items: center;
  justify-content: center;
  color: ${theme.colors.muted.foreground};
`;

const EmptyState = styled.div`
  padding: ${theme.spacing.xl};
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
`;

interface PlaylistImageProps {
  images: { url: string; width: number | null; height: number | null }[];
  alt: string;
}

const PlaylistImage: React.FC<PlaylistImageProps> = React.memo(function PlaylistImage({ images, alt }) {
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imgRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.01
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isVisible && images) {
      const optimalUrl = selectOptimalImage(images, 64);
      setImageUrl(optimalUrl);
    }
  }, [isVisible, images]);

  return (
    <PlaylistImageWrapper ref={imgRef}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span style={{ fontSize: '1.5rem' }}>🎵</span>
      )}
    </PlaylistImageWrapper>
  );
});

export const LibraryDrawer = memo<LibraryDrawerProps>(({
  isOpen,
  onClose,
  onPlaylistSelect
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('vorbis-player-view-mode');
    return (saved === 'albums' ? 'albums' : 'playlists') as ViewMode;
  });
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  const [albums, setAlbums] = useState<AlbumInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [likedSongsCount, setLikedSongsCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [playlistSort, setPlaylistSort] = useLocalStorage<PlaylistSortOption>(
    'vorbis-player-playlist-sort',
    'recently-added'
  );
  const [albumSort, setAlbumSort] = useLocalStorage<AlbumSortOption>(
    'vorbis-player-album-sort',
    'recently-added'
  );
  const [yearFilter, setYearFilter] = useState<YearFilterOption>('all');

  const { viewport, isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizing();

  const drawerWidth = useMemo(() => {
    if (isMobile) return Math.min(viewport.width, parseInt(theme.breakpoints.xs));
    if (isTablet) return Math.min(viewport.width * 0.4, parseInt(theme.drawer.widths.tablet));
    return Math.min(viewport.width * 0.3, parseInt(theme.drawer.widths.desktop));
  }, [viewport.width, isMobile, isTablet]);

  useEffect(() => {
    localStorage.setItem('vorbis-player-view-mode', viewMode);
  }, [viewMode]);

  const filteredPlaylists = useMemo(() => {
    return filterAndSortPlaylists(playlists, searchQuery, playlistSort);
  }, [playlists, searchQuery, playlistSort]);

  const filteredAlbums = useMemo(() => {
    return filterAndSortAlbums(albums, searchQuery, albumSort, yearFilter);
  }, [albums, searchQuery, albumSort, yearFilter]);

  const availableDecades = useMemo(() => {
    return getAvailableDecades(albums);
  }, [albums]);

  useEffect(() => {
    if (viewMode === 'playlists' && yearFilter !== 'all') {
      setYearFilter('all');
    }
  }, [viewMode, yearFilter]);

  useEffect(() => {
    if (!isOpen) return;

    const abortController = new AbortController();
    let isMounted = true;

    async function checkAuthAndFetchPlaylists(): Promise<void> {
      try {
        setError(null);

        if (!spotifyAuth.isAuthenticated()) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        setIsAuthenticated(true);

        const cachedPlaylists = getCachedData<PlaylistInfo[]>('playlists');
        const cachedAlbums = getCachedData<AlbumInfo[]>('albums');

        if (cachedPlaylists && isMounted) {
          setPlaylists(cachedPlaylists);
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }

        if (cachedAlbums && isMounted) {
          setAlbums(cachedAlbums);
        }

        async function fetchFreshData(): Promise<void> {
          try {
            const [userPlaylists, userAlbums] = await Promise.all([
              getUserPlaylists(abortController.signal),
              getUserAlbums(abortController.signal),
            ]);

            if (!isMounted) {
              return;
            }

            setPlaylists(userPlaylists);
            setAlbums(userAlbums);

            let likedSongsCount = 0;
            try {
              likedSongsCount = await getLikedSongsCount(abortController.signal);
              if (isMounted) {
                setLikedSongsCount(likedSongsCount);
              }
            } catch (err) {
              if (err instanceof DOMException && err.name === 'AbortError') {
                return;
              }
              console.warn('Failed to fetch liked songs count:', err);
            }

            if (userPlaylists.length === 0 && userAlbums.length === 0 && likedSongsCount === 0) {
              if (!cachedPlaylists && !cachedAlbums && isMounted) {
                setError("No playlists, albums, or liked songs found. Please create some playlists, save some albums, or like some songs in Spotify first.");
              }
            } else if (isMounted) {
              setError(null);
            }
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
              return;
            }
            if (abortController.signal.aborted) {
              return;
            }
            console.error('Failed to fetch playlists:', err);
            if (!cachedPlaylists && !cachedAlbums && isMounted) {
              setError(err instanceof Error ? err.message : 'Failed to load playlists');
            }
          } finally {
            if (isMounted) {
              setIsLoading(false);
            }
          }
        }

        if (cachedPlaylists || cachedAlbums) {
          fetchFreshData();
        } else {
          await fetchFreshData();
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (abortController.signal.aborted) {
          return;
        }
        console.error('Failed to initialize:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load playlists');
          setIsLoading(false);
        }
      }
    }

    checkAuthAndFetchPlaylists();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [isOpen]);

  function handlePlaylistClick(playlist: PlaylistInfo): void {
    console.log('🎵 Selected playlist:', playlist.name);
    onPlaylistSelect(playlist.id, playlist.name);
    // Keep drawer open for continued browsing
  }

  function handleAlbumClick(album: AlbumInfo): void {
    console.log('🎵 Selected album:', album.name);
    onPlaylistSelect(`album:${album.id}`, album.name);
    // Keep drawer open for continued browsing
  }

  function handleLikedSongsClick(): void {
    console.log('🎵 Selected liked songs');
    onPlaylistSelect('liked-songs', 'Liked Songs');
    // Keep drawer open for continued browsing
  }

  function handleViewModeChange(mode: ViewMode): void {
    setViewMode(mode);
  }

  return (
    <>
      <LibraryOverlay
        isOpen={isOpen}
        onClick={onClose}
      />

      <LibraryDrawerContainer
        isOpen={isOpen}
        width={drawerWidth}
        transitionDuration={transitionDuration}
        transitionEasing={transitionEasing}
      >
        <LibraryHeader>
          <LibraryTitle>Library</LibraryTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </LibraryHeader>

        <LibraryContent>
          {isLoading && (
            <LoadingState>
              <div>Loading your library...</div>
            </LoadingState>
          )}

          {!isLoading && !isAuthenticated && (
            <EmptyState>
              <p>Connect your Spotify account to access your playlists</p>
            </EmptyState>
          )}

          {error && (
            <EmptyState>
              <p style={{ color: theme.colors.error }}>{error}</p>
            </EmptyState>
          )}

          {!isLoading && isAuthenticated && !error && (playlists.length > 0 || albums.length > 0 || likedSongsCount > 0) && (
            <>
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

                {viewMode === 'albums' && availableDecades.length > 0 && (
                  <SelectDropdown
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value as YearFilterOption)}
                  >
                    <option value="all">All Years</option>
                    {availableDecades.map(decade => (
                      <option key={decade} value={decade}>
                        {decade === 'older' ? 'Before 1980' : decade}
                      </option>
                    ))}
                  </SelectDropdown>
                )}

                {(searchQuery || yearFilter !== 'all') && (
                  <ClearButton
                    onClick={() => {
                      setSearchQuery('');
                      setYearFilter('all');
                    }}
                  >
                    Clear
                  </ClearButton>
                )}
              </ControlsContainer>

              <TabsContainer>
                <TabButton
                  $active={viewMode === 'playlists'}
                  onClick={() => handleViewModeChange('playlists')}
                >
                  Playlists
                </TabButton>
                <TabButton
                  $active={viewMode === 'albums'}
                  onClick={() => handleViewModeChange('albums')}
                >
                  Albums
                </TabButton>
              </TabsContainer>

              {viewMode === 'playlists' && (
                <PlaylistGrid>
                  {likedSongsCount > 0 && (
                    <PlaylistItem onClick={handleLikedSongsClick}>
                      <PlaylistImageWrapper>
                        <div style={{
                          background: 'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: '100%',
                          borderRadius: theme.borderRadius.md,
                          fontSize: '1.5rem',
                          color: 'white'
                        }}>
                          ♥
                        </div>
                      </PlaylistImageWrapper>
                      <PlaylistInfo>
                        <PlaylistName>Liked Songs</PlaylistName>
                        <PlaylistDetails>
                          {likedSongsCount} tracks
                        </PlaylistDetails>
                      </PlaylistInfo>
                    </PlaylistItem>
                  )}

                  {filteredPlaylists.map((playlist) => (
                    <PlaylistItem
                      key={playlist.id}
                      onClick={() => handlePlaylistClick(playlist)}
                    >
                      <PlaylistImage
                        images={playlist.images}
                        alt={playlist.name}
                      />
                      <PlaylistInfo>
                        <PlaylistName>{playlist.name}</PlaylistName>
                        <PlaylistDetails>
                          {playlist.tracks.total} tracks
                          {playlist.owner.display_name && ` • by ${playlist.owner.display_name}`}
                        </PlaylistDetails>
                      </PlaylistInfo>
                    </PlaylistItem>
                  ))}

                  {filteredPlaylists.length === 0 && likedSongsCount === 0 && (
                    <EmptyState>
                      {searchQuery
                        ? `No playlists match "${searchQuery}"`
                        : 'No playlists found. Create some playlists in Spotify or save some songs!'
                      }
                    </EmptyState>
                  )}
                </PlaylistGrid>
              )}

              {viewMode === 'albums' && (
                <PlaylistGrid>
                  {filteredAlbums.map((album) => (
                    <PlaylistItem
                      key={album.id}
                      onClick={() => handleAlbumClick(album)}
                    >
                      <PlaylistImage
                        images={album.images}
                        alt={`${album.name} by ${album.artists}`}
                      />
                      <PlaylistInfo>
                        <PlaylistName>{album.name}</PlaylistName>
                        <PlaylistDetails>
                          {album.artists} • {album.total_tracks} tracks
                        </PlaylistDetails>
                      </PlaylistInfo>
                    </PlaylistItem>
                  ))}

                  {filteredAlbums.length === 0 && (
                    <EmptyState>
                      {searchQuery || yearFilter !== 'all'
                        ? 'No albums match your filters.'
                        : 'No albums found. Save some albums in Spotify to see them here!'
                      }
                    </EmptyState>
                  )}
                </PlaylistGrid>
              )}
            </>
          )}
        </LibraryContent>
      </LibraryDrawerContainer>
    </>
  );
});

LibraryDrawer.displayName = 'LibraryDrawer';

export default LibraryDrawer;
