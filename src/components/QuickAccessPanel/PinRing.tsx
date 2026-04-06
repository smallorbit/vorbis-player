import React, { useCallback } from 'react';
import type { PlaylistInfo, AlbumInfo } from '@/services/spotify';
import type { ProviderId } from '@/types/domain';
import { getLikedSongsGradient } from '@/components/PlaylistSelection/utils';
import { useLongPress } from '@/hooks/useLongPress';
import { MosaicThumbnail } from '../MosaicThumbnail';
import {
  GridSection,
  GridContainer,
  LikedSongsCard,
  LikedSongsHeart,
  LikedSongsCount,
  LikedSongsLabel,
  GridItem,
  GridItemArt,
  GridItemName,
  GridGhostSlot,
  GridEmptyHint,
} from './styled';


interface PinRingProps {
  pinnedPlaylists: PlaylistInfo[];
  pinnedAlbums: AlbumInfo[];
  activeProviderIds: ProviderId[];
  likedSongsCount: number;
  onLoadCollection: (id: string, name: string, provider?: ProviderId) => void;
  onLoadLikedSongs: (providerIds: ProviderId[]) => void;
  onAddToQueue: (id: string, name: string, provider?: ProviderId) => void;
  accentColor?: string;
}

function getImageUrl(
  images: { url: string; width: number | null; height: number | null }[],
  targetWidth = 300,
): string | undefined {
  if (!images?.length) return undefined;
  const sorted = [...images].sort(
    (a, b) => Math.abs((a.width ?? 0) - targetWidth) - Math.abs((b.width ?? 0) - targetWidth),
  );
  return sorted[0]?.url;
}

type GridSatelliteItem =
  | { kind: 'playlist'; item: PlaylistInfo }
  | { kind: 'album'; item: AlbumInfo };

interface GridItemCardProps {
  id: string;
  name: string;
  provider?: ProviderId;
  imgUrl?: string;
  mosaicAlbumPaths?: string[];
  fallback: string;
  onPlay: (id: string, name: string, provider?: ProviderId) => void;
  onAddToQueue: (id: string, name: string, provider?: ProviderId) => void;
}

const GridItemCard: React.FC<GridItemCardProps> = ({
  id, name, provider, imgUrl, mosaicAlbumPaths, fallback, onPlay, onAddToQueue,
}) => {
  const handlePlay = useCallback(() => onPlay(id, name, provider), [id, name, provider, onPlay]);
  const handleAdd = useCallback(() => onAddToQueue(id, name, provider), [id, name, provider, onAddToQueue]);

  const longPress = useLongPress({ onShortPress: handlePlay, onLongPress: handleAdd });

  const artContent = mosaicAlbumPaths && mosaicAlbumPaths.length >= 2
    ? <MosaicThumbnail albumPaths={mosaicAlbumPaths} alt={name} />
    : imgUrl ? <img src={imgUrl} alt={name} loading="lazy" /> : fallback;

  return (
    <GridItem
      title={name}
      onContextMenu={(e) => { e.preventDefault(); handleAdd(); }}
      {...longPress}
    >
      <GridItemArt>{artContent}</GridItemArt>
      <GridItemName>{name}</GridItemName>
    </GridItem>
  );
};

const PinRing: React.FC<PinRingProps> = ({
  pinnedPlaylists,
  pinnedAlbums,
  activeProviderIds,
  likedSongsCount,
  onLoadCollection,
  onLoadLikedSongs,
  onAddToQueue,
}) => {
  const filteredPlaylists = activeProviderIds.length > 0
    ? pinnedPlaylists.filter(p => !p.provider || activeProviderIds.includes(p.provider))
    : pinnedPlaylists;

  const filteredAlbums = activeProviderIds.length > 0
    ? pinnedAlbums.filter(a => !a.provider || activeProviderIds.includes(a.provider))
    : pinnedAlbums;

  // 4-col grid, Liked Songs occupies center 2×2 (cols 2-3, rows 2-3).
  // Surrounding slots: 4 top + 2 left + 2 right + 4 bottom = 12 items max.
  const items: GridSatelliteItem[] = [
    ...filteredPlaylists.map(p => ({ kind: 'playlist' as const, item: p })),
    ...filteredAlbums.map(a => ({ kind: 'album' as const, item: a })),
  ].slice(0, 12);

  const showHint = items.length === 0;
  const ghostCount = Math.max(0, 12 - items.length);

  const gradient = getLikedSongsGradient(
    activeProviderIds.length === 1 ? activeProviderIds[0] : 'unified',
  );

  const handleLikedSongs = () => onLoadLikedSongs(activeProviderIds);

  return (
    <GridSection>
      <GridContainer>
        {/* LikedSongsCard must be first — CSS auto-placement flows other items around it */}
        <LikedSongsCard
          onClick={handleLikedSongs}
          style={{ background: gradient }}
          aria-label={`Liked Songs (${likedSongsCount})`}
        >
          <LikedSongsHeart>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </LikedSongsHeart>
          {likedSongsCount > 0 && <LikedSongsCount>{likedSongsCount}</LikedSongsCount>}
          <LikedSongsLabel>Liked Songs</LikedSongsLabel>
        </LikedSongsCard>

        {showHint ? (
          <GridEmptyHint>Pin playlists to see them here</GridEmptyHint>
        ) : (
          <>
            {items.map((sat) => {
              if (sat.kind === 'playlist') {
                const p = sat.item;
                return (
                  <GridItemCard
                    key={`playlist-${p.id}`}
                    id={p.id}
                    name={p.name}
                    provider={p.provider}
                    imgUrl={getImageUrl(p.images)}
                    mosaicAlbumPaths={p.mosaicAlbumPaths}
                    fallback="♪"
                    onPlay={onLoadCollection}
                    onAddToQueue={onAddToQueue}
                  />
                );
              }
              const a = sat.item;
              return (
                <GridItemCard
                  key={`album-${a.id}`}
                  id={`album:${a.id}`}
                  name={a.name}
                  provider={a.provider}
                  imgUrl={getImageUrl(a.images)}
                  fallback="💿"
                  onPlay={onLoadCollection}
                  onAddToQueue={onAddToQueue}
                />
              );
            })}
            {Array.from({ length: ghostCount }, (_, i) => (
              <GridGhostSlot key={`ghost-${i}`} />
            ))}
          </>
        )}
      </GridContainer>
    </GridSection>
  );
};

export default PinRing;
