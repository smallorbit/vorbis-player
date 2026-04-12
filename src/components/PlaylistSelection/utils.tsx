import { useState, useEffect, useRef } from 'react';
import * as React from 'react';
import { theme } from '@/styles/theme';
import { providerRegistry } from '@/providers/registry';
import type { ProviderId } from '@/types/domain';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME } from '@/constants/playlist';
import type { PlaylistInfo } from '../../services/spotify';
import { GridCardArtWrapper, PlaylistImageWrapper } from './styled';
import { MosaicThumbnail } from '../MosaicThumbnail';

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

export function getLikedSongsGradient(providerId?: string | 'unified'): string {
  if (providerId === 'unified') {
    const allProviders = providerRegistry.getAll();
    const colors = allProviders.map(p => p.color).filter(Boolean);
    if (colors.length >= 2) {
      return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
    }
    const fallback = colors[0] ?? theme.colors.accent;
    return `linear-gradient(135deg, ${fallback} 0%, ${fallback} 100%)`;
  }
  const descriptor = providerId ? providerRegistry.get(providerId as ProviderId) : undefined;
  const color = descriptor?.color ?? theme.colors.accent;
  return `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`;
}

/** Minimal playlist row for Liked Songs — used to open the same popover as other playlists in the drawer grid. */
export function likedSongsAsPlaylistInfo(provider?: ProviderId): PlaylistInfo {
  return {
    id: LIKED_SONGS_ID,
    name: LIKED_SONGS_NAME,
    description: null,
    images: [],
    tracks: null,
    owner: null,
    provider,
  };
}

export const PinIcon: React.FC<{ filled?: boolean }> = ({ filled = false }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {filled ? (
      <path d="M16 3a1 1 0 0 0-1.4-.2L12 5l-3-1.5a1 1 0 0 0-1.2.3L6 6.5a1 1 0 0 0 .1 1.3L9 10l-1 4-3.3 3.3a1 1 0 0 0 0 1.4 1 1 0 0 0 1.4 0L9.5 15l4-1 2.2 2.9a1 1 0 0 0 1.3.1l2.7-1.8a1 1 0 0 0 .3-1.2L18.5 11l2.2-2.6a1 1 0 0 0-.2-1.4L16 3z" fill="currentColor" />
    ) : (
      <path d="M16 3a1 1 0 0 0-1.4-.2L12 5l-3-1.5a1 1 0 0 0-1.2.3L6 6.5a1 1 0 0 0 .1 1.3L9 10l-1 4-3.3 3.3a1 1 0 0 0 0 1.4 1 1 0 0 0 1.4 0L9.5 15l4-1 2.2 2.9a1 1 0 0 0 1.3.1l2.7-1.8a1 1 0 0 0 .3-1.2L18.5 11l2.2-2.6a1 1 0 0 0-.2-1.4L16 3z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    )}
  </svg>
);

export const RefreshIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M21 2v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 22v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Shared hook for lazy-loading images via IntersectionObserver */
function useLazyImage(
  images: { url: string; width: number | null; height: number | null }[],
  targetSize: number,
  rootMargin: string
) {
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin, threshold: 0.01 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    if (isVisible && images) {
      setImageUrl(selectOptimalImage(images, targetSize));
    }
  }, [isVisible, images, targetSize]);

  return { ref, imageUrl };
}

interface LazyImageProps {
  images: { url: string; width: number | null; height: number | null }[];
  alt: string;
  mosaicAlbumPaths?: string[];
}

export const PlaylistImage: React.FC<LazyImageProps> = React.memo(function PlaylistImage({ images, alt, mosaicAlbumPaths }) {
  const hasMosaic = mosaicAlbumPaths && mosaicAlbumPaths.length >= 2;
  const { ref, imageUrl } = useLazyImage(hasMosaic ? [] : images, 64, '50px');

  if (hasMosaic) {
    return (
      <PlaylistImageWrapper>
        <MosaicThumbnail albumPaths={mosaicAlbumPaths} alt={alt} />
      </PlaylistImageWrapper>
    );
  }

  return (
    <PlaylistImageWrapper ref={ref}>
      {imageUrl ? (
        <img src={imageUrl} alt={alt} loading="lazy" decoding="async" />
      ) : (
        <span style={{ fontSize: '1.5rem' }}>🎵</span>
      )}
    </PlaylistImageWrapper>
  );
});

export const GridCardImageComponent: React.FC<LazyImageProps> = React.memo(function GridCardImageComponent({ images, alt, mosaicAlbumPaths }) {
  const hasMosaic = mosaicAlbumPaths && mosaicAlbumPaths.length >= 2;
  const { ref, imageUrl } = useLazyImage(hasMosaic ? [] : images, 300, '100px');

  if (hasMosaic) {
    return (
      <GridCardArtWrapper>
        <MosaicThumbnail albumPaths={mosaicAlbumPaths} alt={alt} />
      </GridCardArtWrapper>
    );
  }

  return (
    <GridCardArtWrapper ref={ref}>
      {imageUrl ? (
        <img src={imageUrl} alt={alt} loading="lazy" decoding="async" />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
        }}>
          🎵
        </div>
      )}
    </GridCardArtWrapper>
  );
});
