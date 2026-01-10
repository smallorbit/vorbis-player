import { useState, useEffect, useMemo, useRef } from 'react';
import * as React from 'react';
import styled from 'styled-components';
import { getUserPlaylists, getUserAlbums, getLikedSongsCount, getCachedData, type PlaylistInfo, type AlbumInfo, spotifyAuth } from '../services/spotify';
import { Card, CardHeader, CardContent } from './styled';
import { Button } from './styled';
import { Skeleton } from './styled';
import { Alert, AlertDescription } from './styled';
import { theme } from '@/styles/theme';
import { usePlayerSizing } from '../hooks/usePlayerSizing';

type ViewMode = 'playlists' | 'albums';

interface PlaylistSelectionProps {
  onPlaylistSelect: (playlistId: string, playlistName: string) => void;
}

const selectOptimalImage = (
  images: { url: string; width: number | null; height: number | null }[],
  targetSize: number = 64
): string | undefined => {
  if (!images?.length) return undefined;

  // Spotify provides: [640x640, 300x300, 64x64]
  // Find smallest image >= target size
  const suitable = images
    .filter(img => (img.width || 0) >= targetSize)
    .sort((a, b) => (a.width || 0) - (b.width || 0));

  return suitable[0]?.url || images[images.length - 1]?.url;
};

const Container = styled.div`
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const SelectionCard = styled(Card) <{ $maxWidth: number }>`
  width: 100%;
  max-width: ${({ $maxWidth }) => $maxWidth}px;
  background: rgba(38, 38, 38, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(115, 115, 115, 0.5);
  border-radius: 1.25rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
`;

const Header = styled(CardHeader)`
  text-align: center;
  padding: 2rem 1.5rem 1rem;
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

const PlaylistGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  padding: 1rem 0;
  max-height: 400px;
  overflow-y: auto;
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

const PlaylistImage: React.FC<{ images: { url: string; width: number | null; height: number | null }[]; alt: string }> = React.memo(({ images, alt }) => {
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Use Intersection Observer for better lazy loading
  useEffect(() => {
    if (!imgRef.current) return;

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
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Only select and set image URL when visible
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

const PlaylistSelection: React.FC<PlaylistSelectionProps> = ({ onPlaylistSelect }) => {
  // Load view mode from localStorage, default to 'playlists'
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

  // Get responsive sizing information
  const { viewport, isMobile, isTablet } = usePlayerSizing();

  // Calculate responsive max width for the selection card
  const maxWidth = useMemo(() => {
    if (isMobile) return Math.min(viewport.width * 0.95, 400);
    if (isTablet) return Math.min(viewport.width * 0.8, 500);
    return Math.min(viewport.width * 0.6, 600);
  }, [viewport.width, isMobile, isTablet]);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('vorbis-player-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const checkAuthAndFetchPlaylists = async () => {
      try {
        setError(null);

        // Check if user is authenticated
        if (!spotifyAuth.isAuthenticated()) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        setIsAuthenticated(true);

        // PROGRESSIVE LOADING: Try to load cached data first for instant display
        // Load cached data immediately if available
        const cachedPlaylists = getCachedData<PlaylistInfo[]>('playlists');
        const cachedAlbums = getCachedData<AlbumInfo[]>('albums');

        if (cachedPlaylists && isMounted) {
          setPlaylists(cachedPlaylists);
          setIsLoading(false); // Show UI immediately with cached data
        } else {
          setIsLoading(true);
        }

        if (cachedAlbums && isMounted) {
          setAlbums(cachedAlbums);
        }

        // Fetch fresh data in the background (non-blocking)
        const fetchFreshData = async () => {
          try {
            // Fetch playlists, albums, and liked songs count in parallel
            // Pass abort signal to enable request cancellation
            const [userPlaylists, userAlbums] = await Promise.all([
              getUserPlaylists(abortController.signal),
              getUserAlbums(abortController.signal),
            ]);

            // Only update state if component is still mounted
            if (!isMounted) return;

            // Update with fresh data
            setPlaylists(userPlaylists);
            setAlbums(userAlbums);

            // Get liked songs count (lightweight request)
            let likedSongsCount = 0;
            try {
              likedSongsCount = await getLikedSongsCount(abortController.signal);
              if (isMounted) {
                setLikedSongsCount(likedSongsCount);
              }
            } catch (err) {
              // Ignore abort errors - they're expected on unmount
              if (err instanceof DOMException && err.name === 'AbortError') {
                return;
              }
              console.warn('Failed to fetch liked songs count:', err);
              // Don't fail the whole load if this fails
            }

            // Check for empty state AFTER fetching liked songs count
            // Only show error if we have no playlists, albums, AND no liked songs
            if (userPlaylists.length === 0 && userAlbums.length === 0 && likedSongsCount === 0) {
              // Only show error if we don't have cached data showing
              if (!cachedPlaylists && !cachedAlbums && isMounted) {
                setError("No playlists, albums, or liked songs found. Please create some playlists, save some albums, or like some songs in Spotify first.");
              }
            } else if (isMounted) {
              // Clear error if we have any content (playlists, albums, or liked songs)
              setError(null);
            }
          } catch (err) {
            // Ignore abort errors - they're expected on unmount
            if (err instanceof DOMException && err.name === 'AbortError') {
              return;
            }
            if (abortController.signal.aborted) return;
            console.error('Failed to fetch playlists:', err);
            // Only show error if we don't have cached data to display
            if (!cachedPlaylists && !cachedAlbums && isMounted) {
              setError(err instanceof Error ? err.message : 'Failed to load playlists');
            }
          } finally {
            if (isMounted) {
              setIsLoading(false);
            }
          }
        };

        // If we have cached data, fetch fresh data in background
        // Otherwise, wait for fresh data
        if (cachedPlaylists || cachedAlbums) {
          fetchFreshData(); // Non-blocking background refresh
        } else {
          await fetchFreshData(); // Blocking initial load
        }
      } catch (err) {
        // Ignore abort errors - they're expected on unmount
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (abortController.signal.aborted) return;
        console.error('Failed to initialize:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load playlists');
          setIsLoading(false);
        }
      }
    };

    checkAuthAndFetchPlaylists();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const handlePlaylistClick = (playlist: PlaylistInfo) => {
    console.log('🎵 Selected playlist:', playlist.name);
    onPlaylistSelect(playlist.id, playlist.name);
  };

  const handleAlbumClick = (album: AlbumInfo) => {
    console.log('🎵 Selected album:', album.name);
    onPlaylistSelect(`album:${album.id}`, album.name);
  };

  const handleLikedSongsClick = () => {
    console.log('🎵 Selected liked songs');
    onPlaylistSelect('liked-songs', 'Liked Songs');
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const handleLogin = async () => {
    try {
      await spotifyAuth.redirectToAuth();
    } catch (err) {
      console.error('Failed to redirect to Spotify auth:', err);
      setError('Failed to redirect to Spotify login');
    }
  };

  return (
    <Container>
      <SelectionCard $maxWidth={maxWidth}>
        <Header>
          <Title>Choose Your Music</Title>
          <Subtitle>Select a playlist, album, or your liked songs to start listening</Subtitle>
        </Header>

        <CardContent>
          {isLoading && (
            <LoadingState>
              <Skeleton style={{ height: '60px' }} />
              <Skeleton style={{ height: '60px' }} />
              <Skeleton style={{ height: '60px' }} />
              <p style={{ textAlign: 'center', color: 'white' }}>Loading your playlists...</p>
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
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { (e.target as HTMLButtonElement).style.background = '#1ed760'; }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { (e.target as HTMLButtonElement).style.background = '#1db954'; }}
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

          {!isLoading && isAuthenticated && !error && (playlists.length > 0 || albums.length > 0 || likedSongsCount > 0) && (
            <>
              {/* Tab Switcher */}
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

              {/* Playlists View */}
              {viewMode === 'playlists' && (
                <PlaylistGrid>
                  {/* Liked Songs Option */}
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
                          borderRadius: '0.5rem',
                          fontSize: '1.5rem',
                          color: 'white'
                        }}>
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

                  {/* Regular Playlists */}
                  {playlists.map((playlist) => (
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
                          {playlist.owner.display_name &&
                            ` • by ${playlist.owner.display_name}`
                          }
                        </PlaylistDetails>
                      </PlaylistInfo>
                    </PlaylistItem>
                  ))}

                  {playlists.length === 0 && likedSongsCount === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                      No playlists found. Create some playlists in Spotify or save some songs!
                    </div>
                  )}
                </PlaylistGrid>
              )}

              {/* Albums View */}
              {viewMode === 'albums' && (
                <PlaylistGrid>
                  {albums.map((album) => (
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

                  {albums.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                      No albums found. Save some albums in Spotify to see them here!
                    </div>
                  )}
                </PlaylistGrid>
              )}
            </>
          )}
        </CardContent>
      </SelectionCard>
    </Container>
  );
};

export default PlaylistSelection;