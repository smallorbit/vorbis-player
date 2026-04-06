import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { PlaylistInfo, AlbumInfo } from '@/services/spotify';
import type { ProviderId } from '@/types/domain';
import { getLikedSongsGradient } from '@/components/PlaylistSelection/utils';
import { useLongPress } from '@/hooks/useLongPress';
import {
  RingSection,
  RingContainer,
  CenterButton,
  CenterCount,
  SatelliteButton,
  SatelliteArt,
  SatelliteName,
  GhostSlot,
  GhostHint,
} from './styled';

const MIN_GHOST_COUNT = 4;

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
): string | undefined {
  if (!images?.length) return undefined;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[sorted.length - 1]?.url ?? sorted[0]?.url;
}

type SatelliteItem =
  | { kind: 'playlist'; item: PlaylistInfo }
  | { kind: 'album'; item: AlbumInfo };

interface SatelliteProps {
  $x: number;
  $y: number;
  id: string;
  name: string;
  provider?: ProviderId;
  imgUrl?: string;
  fallback: string;
  onPlay: (id: string, name: string, provider?: ProviderId) => void;
  onAddToQueue: (id: string, name: string, provider?: ProviderId) => void;
}

const Satellite: React.FC<SatelliteProps> = ({
  $x, $y, id, name, provider, imgUrl, fallback, onPlay, onAddToQueue,
}) => {
  const handlePlay = useCallback(() => onPlay(id, name, provider), [id, name, provider, onPlay]);
  const handleAdd = useCallback(() => onAddToQueue(id, name, provider), [id, name, provider, onAddToQueue]);

  const longPress = useLongPress({ onShortPress: handlePlay, onLongPress: handleAdd });

  return (
    <SatelliteButton
      $x={$x}
      $y={$y}
      title={name}
      onContextMenu={(e) => { e.preventDefault(); handleAdd(); }}
      {...longPress}
    >
      <SatelliteArt>
        {imgUrl ? <img src={imgUrl} alt={name} loading="lazy" /> : fallback}
      </SatelliteArt>
      <SatelliteName>{name}</SatelliteName>
    </SatelliteButton>
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [radius, setRadius] = useState(110);

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      const size = containerRef.current?.getBoundingClientRect().width ?? 260;
      setRadius(Math.round(size * 0.38));
    };
    const observer = new ResizeObserver(update);
    observer.observe(containerRef.current);
    update();
    return () => observer.disconnect();
  }, []);

  const filteredPlaylists = activeProviderIds.length > 0
    ? pinnedPlaylists.filter(p => !p.provider || activeProviderIds.includes(p.provider))
    : pinnedPlaylists;

  const filteredAlbums = activeProviderIds.length > 0
    ? pinnedAlbums.filter(a => !a.provider || activeProviderIds.includes(a.provider))
    : pinnedAlbums;

  const satellites: SatelliteItem[] = [
    ...filteredPlaylists.slice(0, 8).map(p => ({ kind: 'playlist' as const, item: p })),
    ...filteredAlbums.slice(0, 8).map(a => ({ kind: 'album' as const, item: a })),
  ].slice(0, 16);

  const ghostCount = Math.max(0, MIN_GHOST_COUNT - satellites.length);
  const totalSlots = satellites.length + ghostCount;
  const showHint = satellites.length === 0;

  const slotPositions = (count: number) =>
    Array.from({ length: count }, (_, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      return {
        x: Math.round(radius * Math.cos(angle)),
        y: Math.round(radius * Math.sin(angle)),
      };
    });

  const positions = totalSlots > 0 ? slotPositions(totalSlots) : [];

  const gradient = getLikedSongsGradient(
    activeProviderIds.length === 1 ? activeProviderIds[0] : 'unified',
  );

  const handleLikedSongs = () => onLoadLikedSongs(activeProviderIds);

  return (
    <RingSection>
      <RingContainer ref={containerRef}>
        {positions.map((pos, i) => {
          const sat = satellites[i];
          if (!sat) {
            return <GhostSlot key={`ghost-${i}`} $x={pos.x} $y={pos.y} />;
          }
          if (sat.kind === 'playlist') {
            const p = sat.item;
            return (
              <Satellite
                key={`playlist-${p.id}`}
                $x={pos.x}
                $y={pos.y}
                id={p.id}
                name={p.name}
                provider={p.provider}
                imgUrl={getImageUrl(p.images)}
                fallback="♪"
                onPlay={onLoadCollection}
                onAddToQueue={onAddToQueue}
              />
            );
          }
          const a = sat.item;
          return (
            <Satellite
              key={`album-${a.id}`}
              $x={pos.x}
              $y={pos.y}
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

        <CenterButton
          onClick={handleLikedSongs}
          style={{ background: gradient }}
          aria-label={`Liked Songs (${likedSongsCount})`}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="white"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <CenterCount>{likedSongsCount > 0 ? likedSongsCount : '♥'}</CenterCount>
        </CenterButton>

        {showHint && (
          <GhostHint>Pin playlists to fill these</GhostHint>
        )}
      </RingContainer>
    </RingSection>
  );
};

export default PinRing;
