import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { getUserPlaylists, getLikedSongs, type PlaylistInfo, spotifyAuth } from '../services/spotify';
import { Card, CardHeader, CardContent } from './styled';
import { Button } from './styled';
import { Skeleton } from './styled';
import { Alert, AlertDescription } from './styled';
import { theme } from '@/styles/theme';
import { usePlayerSizing } from '../hooks/usePlayerSizing';

interface PlaylistSelectionProps {
  onPlaylistSelect: (playlistId: string, playlistName: string) => void;
}

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

const PlaylistImage = styled.div<{ $imageUrl?: string }>`
  width: 60px;
  height: 60px;
  border-radius: 0.5rem;
  background: ${props => props.$imageUrl ?
    `url(${props.$imageUrl}) center/cover` :
    'linear-gradient(45deg, #333, #555)'
  };
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  
  ${props => !props.$imageUrl && `
    &::after {
      content: '🎵';
      font-size: 1.5rem;
    }
  `}
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

const PlaylistSelection: React.FC<PlaylistSelectionProps> = ({ onPlaylistSelect }) => {
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
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

  useEffect(() => {
    const checkAuthAndFetchPlaylists = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if user is authenticated
        if (!spotifyAuth.isAuthenticated()) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        setIsAuthenticated(true);

        // Fetch playlists and liked songs count in parallel
        const [userPlaylists, likedSongs] = await Promise.all([
          getUserPlaylists(),
          getLikedSongs(1) // Just fetch one to get count without loading all
        ]);

        if (userPlaylists.length === 0 && likedSongs.length === 0) {
          setError("No playlists or liked songs found. Please create some playlists or like some songs in Spotify first.");
        } else {
          setPlaylists(userPlaylists);
          // Get actual count from API
          const token = await spotifyAuth.ensureValidToken();
          const response = await fetch('https://api.spotify.com/v1/me/tracks?limit=1', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setLikedSongsCount(data.total);
          }
        }
      } catch (err) {
        console.error('Failed to fetch playlists:', err);
        setError(err instanceof Error ? err.message : 'Failed to load playlists');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndFetchPlaylists();
  }, []);

  const handlePlaylistClick = (playlist: PlaylistInfo) => {
    console.log('🎵 Selected playlist:', playlist.name);
    onPlaylistSelect(playlist.id, playlist.name);
  };

  const handleLikedSongsClick = () => {
    console.log('🎵 Selected liked songs');
    onPlaylistSelect('liked-songs', 'Liked Songs');
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
          <Subtitle>Select a playlist or your liked songs to start listening</Subtitle>
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

          {!isLoading && isAuthenticated && !error && (playlists.length > 0 || likedSongsCount > 0) && (
            <PlaylistGrid>
              {/* Liked Songs Option */}
              {likedSongsCount > 0 && (
                <PlaylistItem onClick={handleLikedSongsClick}>
                  <PlaylistImage>
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
                  </PlaylistImage>
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
                    $imageUrl={playlist.images[0]?.url}
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
            </PlaylistGrid>
          )}
        </CardContent>
      </SelectionCard>
    </Container>
  );
};

export default PlaylistSelection;