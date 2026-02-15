import { useState, useEffect, useMemo, useRef } from 'react';
import * as React from 'react';
import styled from 'styled-components';
import {
  getUserLibraryInterleaved,
  getLikedSongsCount,
  getCachedData,
  spotifyAuth,
  type PlaylistInfo,
  type AlbumInfo
} from '../services/spotify';
import { Card, CardHeader, CardContent, Button, Skeleton, Alert, AlertDescription } from './styled';
import { theme } from '@/styles/theme';
import { usePlayerSizing } from '../hooks/usePlayerSizing';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  filterAndSortPlaylists,
  filterAndSortAlbums,
  getAvailableDecades,
  type PlaylistSortOption,
  type AlbumSortOption,
  type YearFilterOption
} from '../utils/playlistFilters';

type ViewMode = 'playlists' | 'albums';

interface PlaylistSelectionProps {
  onPlaylistSelect: (playlistId: string, playlistName: string) => void;
  /** When true, uses compact layout for drawer context (no centering, fills available space) */
  inDrawer?: boolean;
  /** Ref for swipe-to-close gesture zone (search/filters area only, not the scrollable list) */
  swipeZoneRef?: React.RefObject<HTMLDivElement>;
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

const Container = styled.div<{ $inDrawer?: boolean }>`
  width: 100%;
  display: flex;
  ${({ $inDrawer }) =>
    $inDrawer
      ? `
    flex: 1;
    min-height: 0;
    align-items: stretch;
    justify-content: flex-start;
    padding: ${theme.spacing.xl} ${theme.spacing.lg} ${theme.spacing.md};
    box-sizing: border-box;
  `
      : `
    min-height: 100vh;
    min-height: 100dvh;
    align-items: center;
    justify-content: center;
    padding: 1rem;

    @media (max-width: ${theme.breakpoints.lg}) {
      padding: 0.5rem;
    }
  `}
`;

const SelectionCard = styled(Card) <{ $maxWidth: number; $inDrawer?: boolean }>`
  width: 100%;
  max-width: ${({ $maxWidth, $inDrawer }) => ($inDrawer ? 'none' : `${$maxWidth}px`)};
  background: rgba(38, 38, 38, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(115, 115, 115, 0.5);
  border-radius: 1.25rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  ${({ $inDrawer }) =>
    $inDrawer &&
    `
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `}
`;

const Header = styled(CardHeader) <{ $inDrawer?: boolean }>`
  ${({ $inDrawer }) =>
    $inDrawer
      ? `
    text-align: left;
    padding: ${theme.spacing.sm} 0 ${theme.spacing.md};
    flex-shrink: 0;
  `
      : `
    text-align: center;
    padding: 2rem 1.5rem 1rem;
  `}
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: bold;
  color: white;
  margin-bottom: 0.5rem;
`;

const Subtitle = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
`;

const DrawerContentWrapper = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PlaylistGrid = styled.div<{ $inDrawer?: boolean }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${({ $inDrawer }) => ($inDrawer ? '160px' : '280px')}, 1fr));
  gap: ${({ $inDrawer }) => ($inDrawer ? '0.75rem' : '1rem')};
  padding: 1rem 0;
  overflow-y: auto;
  ${({ $inDrawer }) =>
    $inDrawer
      ? `
    flex: 1;
    min-height: 0;
    -webkit-overflow-scrolling: touch;
  `
      : `
    max-height: 400px;
  `}
`;

const PlaylistItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(115, 115, 115, 0.1);
  border: 1px solid rgba(115, 115, 115, 0.3);
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(218, 165, 32, 0.1);
    border-color: ${theme.colors.accent};
    transform: translateY(-2px);
  }
`;

const PlaylistImageWrapper = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 0.5rem;
  overflow: hidden;
  background: linear-gradient(45deg, #333, #555);
  flex-shrink: 0;
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
  font-weight: 600;
  font-size: 1rem;
  color: white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.25rem;
`;

const PlaylistDetails = styled.div`
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
`;

const spinnerKeyframes = `
  @keyframes vorbis-spinner-spin {
    to { transform: rotate(360deg); }
  }
`;

// Inject the keyframes once
if (typeof document !== 'undefined' && !document.getElementById('vorbis-spinner-keyframes')) {
  const style = document.createElement('style');
  style.id = 'vorbis-spinner-keyframes';
  style.textContent = spinnerKeyframes;
  document.head.appendChild(style);
}

const TabSpinner = styled.span`
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top-color: #1db954;
  border-radius: 50%;
  animation: vorbis-spinner-spin 0.8s linear infinite;
  margin-left: 0.4rem;
  vertical-align: middle;
`;

const TabsContainer = styled.div`
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
`;

const TabButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 1rem;
  background: none;
  border: none;
  color: ${props => props.$active ? '#1db954' : 'rgba(255, 255, 255, 0.6)'};
  font-size: 1rem;
  font-weight: 600;
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
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 180px;
  padding: 0.5rem 0.75rem;
  background: rgba(115, 115, 115, 0.2);
  border: 1px solid rgba(115, 115, 115, 0.4);
  border-radius: 0.5rem;
  color: white;
  font-size: 0.875rem;
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
  padding: 0.5rem 0.75rem;
  background: rgba(115, 115, 115, 0.2);
  border: 1px solid rgba(115, 115, 115, 0.4);
  border-radius: 0.5rem;
  color: white;
  font-size: 0.875rem;
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
  padding: 0.5rem 0.75rem;
  background: rgba(115, 115, 115, 0.2);
  border: 1px solid rgba(115, 115, 115, 0.4);
  border-radius: 0.5rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(115, 115, 115, 0.3);
    color: white;
  }
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

function PlaylistSelection({ onPlaylistSelect, inDrawer = false, swipeZoneRef }: PlaylistSelectionProps): JSX.Element {
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
  const [libraryFullyLoaded, setLibraryFullyLoaded] = useState(false);

  const { viewport, isMobile, isTablet } = usePlayerSizing();

  const maxWidth = useMemo(() => {
    if (isMobile) {
      return Math.min(viewport.width * 0.95, 400);
    }
    if (isTablet) {
      return Math.min(viewport.width * 0.8, 500);
    }
    return Math.min(viewport.width * 0.6, 600);
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
    if (!libraryFullyLoaded) return;
    if (playlists.length === 0 && albums.length === 0 && likedSongsCount === 0) {
      setError(
        "No playlists, albums, or liked songs found. Please create some playlists, save some albums, or like some songs in Spotify first."
      );
    } else {
      setError(null);
    }
  }, [libraryFullyLoaded, playlists.length, albums.length, likedSongsCount]);

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;
    const completedRef = { playlistsDone: false, albumsDone: false, likedDone: false };

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
        const hasCache = !!(cachedPlaylists || cachedAlbums);

        if (cachedPlaylists && isMounted) {
          setPlaylists(cachedPlaylists);
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }

        if (cachedAlbums && isMounted) {
          setAlbums(cachedAlbums);
        }

        function maybeSetLibraryFullyLoaded(): void {
          if (completedRef.playlistsDone && completedRef.albumsDone && completedRef.likedDone && isMounted) {
            setLibraryFullyLoaded(true);
          }
        }

        getLikedSongsCount(abortController.signal)
          .then((count) => {
            if (isMounted) {
              setLikedSongsCount(count);
              completedRef.likedDone = true;
              maybeSetLibraryFullyLoaded();
            }
          })
          .catch((err) => {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            console.warn('Failed to fetch liked songs count:', err);
            completedRef.likedDone = true;
            maybeSetLibraryFullyLoaded();
          });

        const onPlaylistsUpdate = (playlistsSoFar: PlaylistInfo[], isComplete: boolean): void => {
          if (!isMounted) return;
          if (!hasCache || isComplete) setPlaylists(playlistsSoFar);
          if (!hasCache) setIsLoading(false);
          if (isComplete) {
            completedRef.playlistsDone = true;
            maybeSetLibraryFullyLoaded();
          }
        };

        const onAlbumsUpdate = (albumsSoFar: AlbumInfo[], isComplete: boolean): void => {
          if (!isMounted) return;
          if (!hasCache || isComplete) setAlbums(albumsSoFar);
          if (!hasCache) setIsLoading(false);
          if (isComplete) {
            completedRef.albumsDone = true;
            maybeSetLibraryFullyLoaded();
          }
        };

        try {
          await getUserLibraryInterleaved(
            onPlaylistsUpdate,
            onAlbumsUpdate,
            abortController.signal
          );
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (abortController.signal.aborted) return;
          console.error('Failed to fetch playlists:', err);
          if (!hasCache && isMounted) {
            setError(err instanceof Error ? err.message : 'Failed to load playlists');
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (abortController.signal.aborted) return;
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
  }, []);

  function handlePlaylistClick(playlist: PlaylistInfo): void {
    console.log('🎵 Selected playlist:', playlist.name);
    onPlaylistSelect(playlist.id, playlist.name);
  }

  function handleAlbumClick(album: AlbumInfo): void {
    console.log('🎵 Selected album:', album.name);
    onPlaylistSelect(`album:${album.id}`, album.name);
  }

  function handleLikedSongsClick(): void {
    console.log('🎵 Selected liked songs');
    onPlaylistSelect('liked-songs', 'Liked Songs');
  }

  function handleViewModeChange(mode: ViewMode): void {
    setViewMode(mode);
  }

  async function handleLogin(): Promise<void> {
    try {
      await spotifyAuth.redirectToAuth();
    } catch (err) {
      console.error('Failed to redirect to Spotify auth:', err);
      setError('Failed to redirect to Spotify login');
    }
  }

  const hasAnyContent = playlists.length > 0 || albums.length > 0 || likedSongsCount > 0;
  const showMainContent = isAuthenticated && !error && (hasAnyContent || (!isLoading && !libraryFullyLoaded));
  const mainContent = showMainContent ? (
    <>
      <div ref={inDrawer ? swipeZoneRef : undefined} style={inDrawer ? { flexShrink: 0, touchAction: 'pan-y' } : undefined}>
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
            {availableDecades.map((decade) => (
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
          Playlists{!libraryFullyLoaded && <TabSpinner />}
        </TabButton>
        <TabButton
          $active={viewMode === 'albums'}
          onClick={() => handleViewModeChange('albums')}
        >
          Albums{!libraryFullyLoaded && <TabSpinner />}
        </TabButton>
      </TabsContainer>
      </div>

      {viewMode === 'playlists' && (
        <PlaylistGrid $inDrawer={inDrawer}>
          {likedSongsCount > 0 && (
            <PlaylistItem onClick={handleLikedSongsClick}>
              <PlaylistImageWrapper>
                <div
                  style={{
                    background: 'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    borderRadius: '0.5rem',
                    fontSize: '1.5rem',
                    color: 'white',
                  }}
                >
                  ♥
                </div>
              </PlaylistImageWrapper>
              <PlaylistInfo>
                <PlaylistName>Liked Songs</PlaylistName>
                <PlaylistDetails>
                  {likedSongsCount} tracks • Shuffle enabled
                </PlaylistDetails>
              </PlaylistInfo>
            </PlaylistItem>
          )}

          {filteredPlaylists.map((playlist) => (
            <PlaylistItem key={playlist.id} onClick={() => handlePlaylistClick(playlist)}>
              <PlaylistImage images={playlist.images} alt={playlist.name} />
              <PlaylistInfo>
                <PlaylistName>{playlist.name}</PlaylistName>
                <PlaylistDetails>
                  {playlist.tracks.total} tracks
                  {playlist.owner.display_name && ` • by ${playlist.owner.display_name}`}
                </PlaylistDetails>
              </PlaylistInfo>
            </PlaylistItem>
          ))}

          {filteredPlaylists.length === 0 && likedSongsCount === 0 && libraryFullyLoaded && (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              {searchQuery
                ? `No playlists match "${searchQuery}"`
                : 'No playlists found. Create some playlists in Spotify or save some songs!'}
            </div>
          )}
        </PlaylistGrid>
      )}

      {viewMode === 'albums' && (
        <PlaylistGrid $inDrawer={inDrawer}>
          {filteredAlbums.map((album) => (
            <PlaylistItem key={album.id} onClick={() => handleAlbumClick(album)}>
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

          {filteredAlbums.length === 0 && libraryFullyLoaded && (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              {searchQuery || yearFilter !== 'all'
                ? 'No albums match your filters.'
                : 'No albums found. Save some albums in Spotify to see them here!'}
            </div>
          )}
        </PlaylistGrid>
      )}
    </>
  ) : null;

  return (
    <Container $inDrawer={inDrawer}>
      <SelectionCard $maxWidth={maxWidth} $inDrawer={inDrawer}>
        {!inDrawer && (
          <Header $inDrawer={inDrawer}>
            <Title>Choose Your Music</Title>
            <Subtitle>Select a playlist, album, or your liked songs to start listening</Subtitle>
          </Header>
        )}

        <CardContent style={inDrawer ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } : undefined}>
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
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
                Connect your Spotify account to access your playlists
              </p>
              <Button
                onClick={handleLogin}
                style={{
                  background: '#1db954',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  (e.target as HTMLButtonElement).style.background = '#1ed760';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  (e.target as HTMLButtonElement).style.background = '#1db954';
                }}
              >
                Connect Spotify
              </Button>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription style={{ color: '#fecaca' }}>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {mainContent && (inDrawer ? <DrawerContentWrapper>{mainContent}</DrawerContentWrapper> : mainContent)}
        </CardContent>
      </SelectionCard>
    </Container>
  );
};

export default PlaylistSelection;