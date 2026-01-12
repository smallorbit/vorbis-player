import { useState, useEffect, useMemo, useRef } from 'react';
import * as React from 'react';
import styled from 'styled-components';
import {
  getUserAlbums,
  getCachedData,
  spotifyAuth,
  type AlbumInfo
} from '../services/spotify';
import { theme } from '@/styles/theme';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  filterAndSortAlbums,
  getAvailableDecades,
  type AlbumSortOption,
  type YearFilterOption
} from '../utils/playlistFilters';
import { Skeleton, Alert, AlertDescription } from './styled';

interface LibraryContentProps {
  onAlbumQueue: (albumId: string) => void;
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

const Container = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  padding: ${theme.spacing.md};
  border-bottom: 1px solid ${theme.colors.popover.border};
  flex-shrink: 0;
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${theme.colors.white};
  margin: 0 0 ${theme.spacing.xs} 0;
`;

const Subtitle = styled.p`
  color: ${theme.colors.muted.foreground};
  font-size: 0.875rem;
  margin: 0;
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: ${theme.spacing.md};
  flex-wrap: wrap;
  flex-shrink: 0;
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

const AlbumsGrid = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${theme.spacing.md};
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: ${theme.spacing.md};
`;

const AlbumItem = styled.div`
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
  }
`;

const AlbumImageWrapper = styled.div`
  width: 100%;
  aspect-ratio: 1;
  border-radius: ${theme.borderRadius.md};
  overflow: hidden;
  background: linear-gradient(45deg, #333, #555);
  margin-bottom: ${theme.spacing.sm};
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const QueueButton = styled.button`
  position: absolute;
  bottom: ${theme.spacing.xs};
  right: ${theme.spacing.xs};
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${theme.colors.accent};
  border: none;
  color: ${theme.colors.black};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s, opacity 0.2s;
  opacity: 0;

  ${AlbumItem}:hover & {
    opacity: 1;
  }

  &:hover {
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const AlbumInfo = styled.div`
  min-width: 0;
`;

const AlbumName = styled.div`
  font-weight: 600;
  font-size: 0.875rem;
  color: ${theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.25rem;
`;

const AlbumDetails = styled.div`
  font-size: 0.75rem;
  color: ${theme.colors.muted.foreground};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

interface AlbumImageProps {
  images: { url: string; width: number | null; height: number | null }[];
  alt: string;
}

const AlbumImage: React.FC<AlbumImageProps> = React.memo(function AlbumImage({ images, alt }) {
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
    <AlbumImageWrapper ref={imgRef}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span style={{ fontSize: '2rem' }}>🎵</span>
      )}
    </AlbumImageWrapper>
  );
});

export const LibraryContent: React.FC<LibraryContentProps> = ({ onAlbumQueue }) => {
  const [albums, setAlbums] = useState<AlbumInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [albumSort, setAlbumSort] = useLocalStorage<AlbumSortOption>(
    'vorbis-player-album-sort',
    'recently-added'
  );
  const [yearFilter, setYearFilter] = useState<YearFilterOption>('all');

  const filteredAlbums = useMemo(() => {
    return filterAndSortAlbums(albums, searchQuery, albumSort, yearFilter);
  }, [albums, searchQuery, albumSort, yearFilter]);

  const availableDecades = useMemo(() => {
    return getAvailableDecades(albums);
  }, [albums]);

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    async function checkAuthAndFetchAlbums(): Promise<void> {
      try {
        setError(null);

        if (!spotifyAuth.isAuthenticated()) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        setIsAuthenticated(true);

        const cachedAlbums = getCachedData<AlbumInfo[]>('albums');

        if (cachedAlbums && isMounted) {
          setAlbums(cachedAlbums);
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }

        async function fetchFreshData(): Promise<void> {
          try {
            const userAlbums = await getUserAlbums(abortController.signal);

            if (!isMounted) {
              return;
            }

            setAlbums(userAlbums);

            if (userAlbums.length === 0) {
              if (!cachedAlbums && isMounted) {
                setError("No albums found. Save some albums in Spotify to see them here!");
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
            console.error('Failed to fetch albums:', err);
            if (!cachedAlbums && isMounted) {
              setError(err instanceof Error ? err.message : 'Failed to load albums');
            }
          } finally {
            if (isMounted) {
              setIsLoading(false);
            }
          }
        }

        if (cachedAlbums) {
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
          setError(err instanceof Error ? err.message : 'Failed to load albums');
          setIsLoading(false);
        }
      }
    }

    checkAuthAndFetchAlbums();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  function handleAlbumQueue(album: AlbumInfo): void {
    console.log('🎵 Queueing album:', album.name);
    onAlbumQueue(album.id);
  }

  if (!isAuthenticated) {
    return (
      <Container>
        <Header>
          <Title>Library</Title>
          <Subtitle>Connect to Spotify to browse your albums</Subtitle>
        </Header>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>Library</Title>
        <Subtitle>Queue albums to play next</Subtitle>
      </Header>

      {isLoading && (
        <div style={{ padding: theme.spacing.md, display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
          <Skeleton style={{ height: '140px' }} />
          <Skeleton style={{ height: '140px' }} />
          <Skeleton style={{ height: '140px' }} />
        </div>
      )}

      {error && (
        <div style={{ padding: theme.spacing.md }}>
          <Alert variant="destructive">
            <AlertDescription style={{ color: '#fecaca' }}>
              {error}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {!isLoading && !error && albums.length > 0 && (
        <>
          <ControlsContainer>
            <SearchInput
              type="text"
              placeholder="Search albums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

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

            {availableDecades.length > 0 && (
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

          <AlbumsGrid>
            {filteredAlbums.map((album) => (
              <AlbumItem key={album.id} onClick={() => handleAlbumQueue(album)}>
                <AlbumImageWrapper>
                  <AlbumImage
                    images={album.images}
                    alt={`${album.name} by ${album.artists}`}
                  />
                  <QueueButton
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAlbumQueue(album);
                    }}
                    title={`Queue ${album.name}`}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                  </QueueButton>
                </AlbumImageWrapper>
                <AlbumInfo>
                  <AlbumName>{album.name}</AlbumName>
                  <AlbumDetails>{album.artists}</AlbumDetails>
                </AlbumInfo>
              </AlbumItem>
            ))}

            {filteredAlbums.length === 0 && (
              <div style={{ 
                gridColumn: '1 / -1', 
                padding: theme.spacing.xl, 
                textAlign: 'center', 
                color: 'rgba(255, 255, 255, 0.6)' 
              }}>
                {searchQuery || yearFilter !== 'all'
                  ? 'No albums match your filters.'
                  : 'No albums found. Save some albums in Spotify to see them here!'
                }
              </div>
            )}
          </AlbumsGrid>
        </>
      )}

      {!isLoading && !error && albums.length === 0 && (
        <div style={{ 
          padding: theme.spacing.xl, 
          textAlign: 'center', 
          color: 'rgba(255, 255, 255, 0.6)' 
        }}>
          No albums found. Save some albums in Spotify to see them here!
        </div>
      )}
    </Container>
  );
};

export default LibraryContent;
