import React, { memo } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import AlbumArtFilters from './AlbumArtFilters';
import AccentColorGlowOverlay, { hexToRgb, colorDistance, DEFAULT_GLOW_RATE } from './AccentColorGlowOverlay';

interface AlbumArtProps {
  currentTrack: Track | null;
  objectPosition?: string;
  accentColor?: string;
  glowIntensity?: number;
  glowRate?: number;
  albumFilters?: {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    blur: number;
    sepia: number;
    grayscale: number;
    invert: number;
  };
}

const AlbumArtContainer = styled.div<{ accentColor?: string }>`
  
  border-radius: 1.25rem;
  position: relative;
  width: -webkit-fill-available;
  margin: 1.25rem;
  overflow: hidden;
  background: transparent;
  box-shadow: 0 8px 24px rgba(23, 22, 22, 0.7), 0 2px 8px rgba(22, 21, 21, 0.6);

  z-index: 2;
`;

const AlbumArt: React.FC<AlbumArtProps> = memo(({ currentTrack = null, accentColor, glowIntensity, glowRate, albumFilters }) => {
  const [canvasUrl, setCanvasUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!currentTrack?.image) {
      setCanvasUrl(null);
      return;
    }
    const accentColorRgb = hexToRgb(accentColor || '#000000');
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.src = currentTrack.image;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        const dist = colorDistance([r, g, b], accentColorRgb);
        const maxDistance = 100;
        if (dist < maxDistance) {
          // factor: 0 (exact match) -> 1 (at threshold)
          const factor = dist / maxDistance;
          data[i + 3] = Math.round(a * factor);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      setCanvasUrl(canvas.toDataURL());
    };
    image.onerror = () => setCanvasUrl(null);
  }, [currentTrack, accentColor]);

  if (!currentTrack) return null;

  return (
    <AlbumArtContainer accentColor={accentColor} >
      <AlbumArtFilters filters={albumFilters ? { ...albumFilters, invert: !!albumFilters.invert } : {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        blur: 0,
        sepia: 0,
        grayscale: 0,
        invert: false,
      }}>
        <AccentColorGlowOverlay
          glowIntensity={glowIntensity || 100}
          glowRate={glowRate || DEFAULT_GLOW_RATE}
          accentColor={accentColor || '#000000'}
          backgroundImage={currentTrack?.image}
        />
        {canvasUrl ? (
          <img
            src={canvasUrl}
            alt={currentTrack?.name}
            style={{
              width: '-webkit-fill-available',
              objectFit: 'cover',
              overflow: 'hidden',
              borderRadius: '1.25rem',
              display: 'block',
              zIndex: 2,
            }}
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://via.placeholder.com/400x300/1a1a1a/ffffff?text=${encodeURIComponent(currentTrack?.name || 'No Image')}`;
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: 'red' }}>
            <p>No image</p>
          </div>
        )}
      </AlbumArtFilters>
    </AlbumArtContainer>

  );
});

export default AlbumArt; 