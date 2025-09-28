import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import type { Track } from '../services/spotify';
import AlbumArtFilters from './AlbumArtFilters';
import AccentColorGlowOverlay, { DEFAULT_GLOW_RATE, DEFAULT_GLOW_INTENSITY } from './AccentColorGlowOverlay';
import { hexToRgb } from '../utils/colorUtils';
import { useImageProcessingWorker } from '../hooks/useImageProcessingWorker';
import { usePlayerSizing } from '../hooks/usePlayerSizing';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const ProcessingSpinner = styled.div<{ size: number; innerSize: number }>`
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;

  &::after {
    content: '';
    width: ${({ innerSize }) => innerSize}px;
    height: ${({ innerSize }) => innerSize}px;
    border: 2px solid #fff;
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: ${spin} 1s linear infinite;
  }
`;

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
  };
}


const AlbumArtContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['accentColor', 'glowIntensity', 'glowRate'].includes(prop),
}) <{
  accentColor?: string;
  glowIntensity?: number;
  glowRate?: number;
}>`
  border-radius: 1.25rem;
  position: relative;
  width: -webkit-fill-available;
  margin: 1rem;
  overflow: hidden;
  background: transparent;
  box-shadow: 0 8px 24px rgba(23, 22, 22, 0.7), 0 2px 8px rgba(22, 21, 21, 0.6);
  z-index: 2;
`;

const arePropsEqual = (prevProps: AlbumArtProps, nextProps: AlbumArtProps): boolean => {
  if (prevProps.currentTrack?.id !== nextProps.currentTrack?.id) {
    return false;
  }
  if (prevProps.currentTrack?.image !== nextProps.currentTrack?.image) {
    return false;
  }
  if (prevProps.accentColor !== nextProps.accentColor) {
    return false;
  }
  if (prevProps.glowIntensity !== nextProps.glowIntensity ||
    prevProps.glowRate !== nextProps.glowRate) {
    return false;
  }
  if (!prevProps.albumFilters && !nextProps.albumFilters) {
    return true;
  }
  if (!prevProps.albumFilters || !nextProps.albumFilters) {
    return false;
  }
  const filterKeys: (keyof typeof prevProps.albumFilters)[] = [
    'brightness', 'contrast', 'saturation', 'blur', 'sepia'
  ];
  for (const key of filterKeys) {
    if (prevProps.albumFilters[key] !== nextProps.albumFilters[key]) {
      return false;
    }
  }
  return true;
};

const AlbumArt: React.FC<AlbumArtProps> = memo(({ currentTrack = null, accentColor, glowIntensity, glowRate, albumFilters }) => {
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { processImage } = useImageProcessingWorker();

  // Get responsive sizing information
  const { isMobile, isTablet } = usePlayerSizing();

  // Calculate responsive dimensions for the processing spinner
  const spinnerDimensions = useMemo(() => {
    if (isMobile) {
      return { size: 20, innerSize: 10 };
    }
    if (isTablet) {
      return { size: 22, innerSize: 11 };
    }
    return { size: 24, innerSize: 12 };
  }, [isMobile, isTablet]);

  useEffect(() => {
    if (accentColor && glowIntensity !== undefined && glowRate !== undefined) {
      const rgb = hexToRgb(accentColor);
      const root = document.documentElement;
      root.style.setProperty('--accent-color', accentColor);
      root.style.setProperty('--glow-intensity', glowIntensity.toString());
      root.style.setProperty('--glow-rate', `${glowRate}s`);
      root.style.setProperty('--accent-rgb', `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`);
    }
  }, [accentColor, glowIntensity, glowRate]);

  const processImageWithWorker = useCallback(async (
    imageElement: HTMLImageElement,
    accentColorRgb: [number, number, number]
  ) => {
    try {
      setIsProcessing(true);
      const canvas = document.createElement('canvas');
      canvas.width = imageElement.width;
      canvas.height = imageElement.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      ctx.drawImage(imageElement, 0, 0);
      const imageData = ctx.getImageData(0, 0, imageElement.width, imageElement.height);
      const processedImageData = await processImage(imageData, accentColorRgb, 60);
      ctx.putImageData(processedImageData, 0, 0);
      setCanvasUrl(canvas.toDataURL());
    } catch (error) {
      console.error('Image processing failed:', error);
      setCanvasUrl(null);
    } finally {
      setIsProcessing(false);
    }
  }, [processImage]);

  useEffect(() => {
    if (!currentTrack?.image) {
      setCanvasUrl(null);
      return;
    }
    const accentColorRgb = hexToRgb(accentColor || '#000000');
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.src = currentTrack.image;
    image.onload = () => {
      processImageWithWorker(image, accentColorRgb);
    };
    image.onerror = () => {
      console.error('Failed to load image:', currentTrack.image);
      setCanvasUrl(null);
      setIsProcessing(false);
    };
  }, [currentTrack, accentColor, processImageWithWorker]);

  if (!currentTrack) return null;

  const glowClasses = [
    'glow-container',
    glowIntensity && glowIntensity > 0 && accentColor ? 'glow-active' : ''
  ].filter(Boolean).join(' ');

  return (
    <AlbumArtContainer
      accentColor={accentColor}
      glowIntensity={glowIntensity}
      glowRate={glowRate}
      className={glowClasses}
    >
      <AlbumArtFilters filters={albumFilters ? albumFilters : {
        brightness: 110,
        contrast: 100,
        saturation: 100,
        sepia: 0
      }}>
        <AccentColorGlowOverlay
          glowIntensity={glowIntensity ?? DEFAULT_GLOW_INTENSITY}
          glowRate={glowRate ?? DEFAULT_GLOW_RATE}
          accentColor={accentColor || '#000000'}
          backgroundImage={currentTrack?.image}
        />
        {currentTrack?.image ? (
          <img
            src={glowIntensity === 0 || !canvasUrl ? currentTrack.image : canvasUrl}
            alt={currentTrack?.name}
            style={{
              width: '-webkit-fill-available',
              objectFit: 'cover',
              overflow: 'hidden',
              borderRadius: '1.25rem',
              display: 'block',
              zIndex: 2,
              opacity: isProcessing ? 0.9 : 1,
              transition: 'opacity 0.2s ease-in-out',
              transform: 'scale(1.01)',
            }}
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://via.placeholder.com/400x300/1a1a1a/ffffff?text=${encodeURIComponent(currentTrack?.name || 'No Image')}`;
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            borderRadius: '1.25rem'
          }}>
            <p>No image</p>
          </div>
        )}
        {isProcessing && <ProcessingSpinner size={spinnerDimensions.size} innerSize={spinnerDimensions.innerSize} />}
      </AlbumArtFilters>
    </AlbumArtContainer>

  );
}, arePropsEqual);

AlbumArt.displayName = 'AlbumArt';

export default AlbumArt; 