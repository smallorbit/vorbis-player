import React, { useRef, useState, useEffect } from 'react';
import type { PlaylistInfo, AlbumInfo } from '@/services/spotify';
import type { ProviderId } from '@/types/domain';
import { getLikedSongsGradient } from '@/components/PlaylistSelection/utils';
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

const PinRing: React.FC<PinRingProps> = ({
  pinnedPlaylists,
  pinnedAlbums,
  activeProviderIds,
  likedSongsCount,
  onLoadCollection,
  onLoadLikedSongs,
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

  const handleLikedSongs = () => {
    onLoadLikedSongs(activeProviderIds);
  };

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
            const imgUrl = getImageUrl(p.images);
            return (
              <SatelliteButton
                key={`playlist-${p.id}`}
                $x={pos.x}
                $y={pos.y}
                onClick={() => onLoadCollection(p.id, p.name, p.provider)}
                title={p.name}
              >
                <SatelliteArt>
                  {imgUrl ? (
                    <img src={imgUrl} alt={p.name} loading="lazy" />
                  ) : (
                    '♪'
                  )}
                </SatelliteArt>
                <SatelliteName>{p.name}</SatelliteName>
              </SatelliteButton>
            );
          }
          const a = sat.item;
          const imgUrl = getImageUrl(a.images);
          return (
            <SatelliteButton
              key={`album-${a.id}`}
              $x={pos.x}
              $y={pos.y}
              onClick={() => onLoadCollection(`album:${a.id}`, a.name, a.provider)}
              title={a.name}
            >
              <SatelliteArt>
                {imgUrl ? (
                  <img src={imgUrl} alt={a.name} loading="lazy" />
                ) : (
                  '💿'
                )}
              </SatelliteArt>
              <SatelliteName>{a.name}</SatelliteName>
            </SatelliteButton>
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
