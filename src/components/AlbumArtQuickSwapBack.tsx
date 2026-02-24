import { useState, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import type { Track } from '@/services/spotify';
import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';
import type { AlbumInfo } from '@/services/spotify';
import { useLibrarySync } from '@/hooks/useLibrarySync';
import { usePinnedItems } from '@/hooks/usePinnedItems';
import { toAlbumPlaylistId, LIKED_SONGS_ID, LIKED_SONGS_NAME } from '@/constants/playlist';
import { theme } from '@/styles/theme';

interface AlbumArtQuickSwapBackProps {
  currentTrack: Track | null;
  onPlaylistSelect: (playlistId: string, playlistName: string) => void;
  onClose: () => void;
}

type ViewMode = 'playlists' | 'albums';

function selectImageUrl(
  images: { url: string; width: number | null; height: number | null }[],
  targetSize: number = 300
): string | undefined {
  if (!images?.length) return undefined;
  const suitable = images
    .filter((img) => (img.width || 0) >= targetSize)
    .sort((a, b) => (a.width || 0) - (b.width || 0));
  return suitable[0]?.url || images[images.length - 1]?.url;
}

const BacksideRoot = styled.div`
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: rotateY(180deg);
  border-radius: ${theme.borderRadius['3xl']};
  overflow: hidden;
`;

const BlurredBg = styled.div<{ $image?: string }>`
  position: absolute;
  inset: 0;
  background-image: ${({ $image }) => ($image ? `url(${$image})` : 'none')};
  background-size: cover;
  background-position: center;
  filter: blur(20px);
  transform: scale(1.1);
`;

const DarkOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
`;

const Content = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: ${theme.spacing.lg};
  box-sizing: border-box;
`;

const TabBar = styled.div`
  display: flex;
  gap: 0;
  margin-bottom: ${theme.spacing.md};
  border-bottom: 2px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
`;

const Tab = styled.button.attrs({ type: 'button' as const })<{ $active: boolean }>`
  flex: 1;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  background: none;
  border: none;
  color: ${({ $active }) => ($active ? theme.colors.spotify : 'rgba(255, 255, 255, 0.5)')};
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.semibold};
  cursor: pointer;
  transition: color 0.15s ease;
  border-bottom: 2px solid ${({ $active }) => ($active ? theme.colors.spotify : 'transparent')};
  margin-bottom: -2px;

  &:focus { outline: none; }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: ${theme.spacing.sm};
  flex: 1;
  min-height: 0;
`;

const ItemButton = styled.button.attrs({ type: 'button' as const })`
  position: relative;
  display: block;
  padding: 0;
  background: none;
  border: 2px solid transparent;
  border-radius: ${theme.borderRadius.lg};
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
  overflow: hidden;
  min-height: 0;

  &:hover, &:active {
    border-color: rgba(255, 255, 255, 0.3);
    transform: scale(1.02);
  }
`;

const Thumbnail = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const LikedSongsThumb = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  color: ${theme.colors.white};
  background: linear-gradient(135deg, ${theme.colors.spotify} 0%, ${theme.colors.spotifyLight} 100%);
`;

const FallbackThumb = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  font-size: ${theme.fontSize.sm};
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  padding: ${theme.spacing.xl};
  line-height: 1.5;
`;

function AlbumArtQuickSwapBack({
  currentTrack,
  onPlaylistSelect,
  onClose,
}: AlbumArtQuickSwapBackProps) {
  const { playlists, albums } = useLibrarySync();
  const { pinnedPlaylistIds, pinnedAlbumIds } = usePinnedItems();

  const defaultTab: ViewMode = pinnedPlaylistIds.length > 0 ? 'playlists' : 'albums';
  const [viewMode, setViewMode] = useState<ViewMode>(defaultTab);

  const pinnedPlaylists = useMemo(() => {
    const likedSongsEntry: CachedPlaylistInfo = {
      id: LIKED_SONGS_ID,
      name: LIKED_SONGS_NAME,
      description: null,
      images: [],
      tracks: { total: 0 },
      owner: { display_name: '' },
    };
    const hasLikedSongs = pinnedPlaylistIds.includes(LIKED_SONGS_ID);
    const otherIds = pinnedPlaylistIds.filter((id) => id !== LIKED_SONGS_ID);
    const others = otherIds
      .map((id) => playlists.find((p) => p.id === id))
      .filter((p): p is CachedPlaylistInfo => p != null);
    const result = hasLikedSongs ? [likedSongsEntry, ...others] : others;
    return result.slice(0, 4);
  }, [playlists, pinnedPlaylistIds]);

  const pinnedAlbums = useMemo(() => {
    return pinnedAlbumIds
      .map((id) => albums.find((a) => a.id === id))
      .filter((a): a is AlbumInfo => a != null)
      .slice(0, 4);
  }, [albums, pinnedAlbumIds]);

  const handlePlaylistClick = useCallback(
    (playlistId: string, name: string) => {
      onPlaylistSelect(playlistId, name);
      onClose();
    },
    [onPlaylistSelect, onClose]
  );

  const handleTabClick = useCallback((e: React.MouseEvent, mode: ViewMode) => {
    e.stopPropagation();
    setViewMode(mode);
  }, []);

  const items = viewMode === 'playlists' ? pinnedPlaylists : pinnedAlbums;
  const hasAnyPinned = pinnedPlaylists.length > 0 || pinnedAlbums.length > 0;

  return (
    <BacksideRoot>
      <BlurredBg $image={currentTrack?.image} />
      <DarkOverlay />

      <Content>
        {hasAnyPinned && (
          <TabBar>
            <Tab
              $active={viewMode === 'playlists'}
              onClick={(e) => handleTabClick(e, 'playlists')}
            >
              Playlists ({pinnedPlaylists.length})
            </Tab>
            <Tab
              $active={viewMode === 'albums'}
              onClick={(e) => handleTabClick(e, 'albums')}
            >
              Albums ({pinnedAlbums.length})
            </Tab>
          </TabBar>
        )}

        {!hasAnyPinned ? (
          <EmptyState>
            Pin playlists or albums in the Library to swap quickly here.
          </EmptyState>
        ) : items.length === 0 ? (
          <EmptyState>
            No pinned {viewMode}. Switch tabs or pin some in the Library.
          </EmptyState>
        ) : (
          <Grid>
            {viewMode === 'playlists' &&
              pinnedPlaylists.map((playlist) => {
                const imageUrl = selectImageUrl(playlist.images ?? [], 300);
                const isLikedSongs = playlist.id === LIKED_SONGS_ID;
                return (
                  <ItemButton
                    key={playlist.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlaylistClick(playlist.id, playlist.name);
                    }}
                    title={playlist.name}
                  >
                    {isLikedSongs ? (
                      <LikedSongsThumb aria-label="Liked Songs">&#9829;</LikedSongsThumb>
                    ) : (
                      <Thumbnail>
                        {imageUrl ? (
                          <img src={imageUrl} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <FallbackThumb>&#127925;</FallbackThumb>
                        )}
                      </Thumbnail>
                    )}
                  </ItemButton>
                );
              })}
            {viewMode === 'albums' &&
              pinnedAlbums.map((album) => {
                const imageUrl = selectImageUrl(album.images ?? [], 300);
                const playlistId = toAlbumPlaylistId(album.id);
                return (
                  <ItemButton
                    key={album.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlaylistClick(playlistId, album.name);
                    }}
                    title={`${album.name} – ${album.artists}`}
                  >
                    <Thumbnail>
                      {imageUrl ? (
                        <img src={imageUrl} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <FallbackThumb>&#127925;</FallbackThumb>
                      )}
                    </Thumbnail>
                  </ItemButton>
                );
              })}
          </Grid>
        )}
      </Content>
    </BacksideRoot>
  );
}

export default AlbumArtQuickSwapBack;
