import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import type { MediaTrack } from '@/types/domain';
import { breatheBorderGlow } from '../styles/animations';
import { ZEN_ART_DURATION, ZEN_ART_EASING, ZEN_ART_ENTER_DELAY, ZEN_ART_MARGIN_H, ZEN_ART_MARGIN_V, ZEN_ART_MARGIN_H_MOBILE, ZEN_ART_MARGIN_V_MOBILE } from '@/constants/zenAnimation';

import AccentColorGlowOverlay, { DEFAULT_GLOW_RATE, DEFAULT_GLOW_INTENSITY } from './AccentColorGlowOverlay';
import { hexToRgb } from '../utils/colorUtils';
import { useImageProcessingWorker } from '../hooks/useImageProcessingWorker';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { theme } from '../styles/theme';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const ProcessingSpinner = styled.div.withConfig({
  shouldForwardProp: (prop) => !['size', 'innerSize'].includes(prop),
}) <{ size: number; innerSize: number }>`
  position: absolute;
  top: ${theme.spacing.sm};
  right: ${theme.spacing.sm};
  background: ${theme.colors.overlay.dark};
  border-radius: 50%;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${theme.zIndex.dropdown};

  &::after {
    content: '';
    width: ${({ innerSize }) => innerSize}px;
    height: ${({ innerSize }) => innerSize}px;
    border: 2px solid ${theme.colors.white};
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: ${spin} 1s linear infinite;
  }
`;

interface AlbumArtProps {
  currentTrack: MediaTrack | null;
  objectPosition?: string;
  accentColor?: string;
  glowIntensity?: number;
  glowRate?: number;
  glowEnabled?: boolean;
  zenMode?: boolean;
  translucenceEnabled?: boolean;
  translucenceOpacity?: number;
  onRetryAlbumArt?: () => void;
}


const AlbumArtContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['accentColor', 'glowIntensity', 'glowRate', 'glowEnabled', '$zenMode', '$translucenceOpacity'].includes(prop),
}) <{
  accentColor?: string;
  glowIntensity?: number;
  glowRate?: number;
  glowEnabled?: boolean;
  $zenMode?: boolean;
  $translucenceOpacity?: number;
}>`
  transform: translateZ(0);
  will-change: transform, opacity;
  isolation: isolate;
  border-radius: ${theme.borderRadius.xl};
  position: relative;
  width: 100%;
  max-width: ${({ $zenMode }) => $zenMode
    ? `min(calc(100vw - ${ZEN_ART_MARGIN_H}px), calc(100dvh - ${ZEN_ART_MARGIN_V}px))`
    : `min(calc(100vw - 48px), calc(100dvh - var(--player-controls-height, 220px) - 120px))`
  };
  transition: ${({ $zenMode }) => $zenMode
    ? `max-width ${ZEN_ART_DURATION}ms ${ZEN_ART_EASING} ${ZEN_ART_ENTER_DELAY}ms, box-shadow 0.5s ease, opacity 0.5s ease`
    : `max-width ${ZEN_ART_DURATION}ms ${ZEN_ART_EASING}, box-shadow 0.5s ease, opacity 0.5s ease`
  };
  aspect-ratio: 1;
  margin: 0 auto;
  overflow: hidden;
  background: transparent;
  /* Accent color glow for floating effect */
  ${({ accentColor, glowEnabled, glowIntensity }) => {
    // If glow is disabled, use edge + inset for definition
    if (glowEnabled === false) {
      return `
        box-shadow:
          inset 0 0 10px rgba(0, 0, 0, 0.25),
          0 0 0 1.5px rgba(255, 255, 255, 0.5),
          ${theme.shadows.albumArtDepth};
      `;
    }

    // If glow is enabled with intensity > 0, use animated breathing glow
    if (glowEnabled && glowIntensity && glowIntensity > 0 && accentColor) {
      const [r, g, b] = hexToRgb(accentColor);
      const t = (glowIntensity - 95) / (125 - 95);
      const edgeOpacity = 0.25 + t * 0.35;
      const glowA = 0.45 + t * 0.15;
      const glowB = 0.3 + t * 0.15;
      const glowC = 0.2 + t * 0.15;
      return css`
        box-shadow:
          inset 0 0 10px rgba(0, 0, 0, 0.25),
          0 0 0 1.5px rgba(255, 255, 255, ${edgeOpacity.toFixed(2)}),
          0 0 10px rgba(${r}, ${g}, ${b}, calc(${glowA.toFixed(2)} * var(--glow-opacity, 1))),
          0 0 22px rgba(${r}, ${g}, ${b}, calc(${glowB.toFixed(2)} * var(--glow-opacity, 1))),
          0 0 36px rgba(${r}, ${g}, ${b}, calc(${glowC.toFixed(2)} * var(--glow-opacity, 1))),
          ${theme.shadows.albumArtDepth};
        animation: ${breatheBorderGlow} var(--glow-rate, ${DEFAULT_GLOW_RATE}s) linear infinite;
      `;
    }

    // If glow is enabled but intensity is 0, or not specified, use full static glow
    if (accentColor) {
      const [r, g, b] = hexToRgb(accentColor);
      return `
        box-shadow:
          inset 0 0 10px rgba(0, 0, 0, 0.25),
          0 0 0 1.5px rgba(255, 255, 255, 0.4),
          0 0 10px rgba(${r}, ${g}, ${b}, 0.5),
          0 0 22px rgba(${r}, ${g}, ${b}, 0.3),
          0 0 36px rgba(${r}, ${g}, ${b}, 0.15),
          ${theme.shadows.albumArtDepth};
      `;
    }
    return `
      box-shadow:
        inset 0 0 10px rgba(0, 0, 0, 0.25),
        0 0 0 1.5px rgba(255, 255, 255, 0.5),
        0 0 10px rgba(255, 255, 255, 0.35),
        0 0 22px rgba(255, 255, 255, 0.25),
        0 0 36px rgba(255, 255, 255, 0.12),
        ${theme.shadows.albumArtDepth};
    `;
  }}
  border: none;
  z-index: ${theme.zIndex.docked};
  opacity: ${({ $translucenceOpacity }) => $translucenceOpacity ?? 1};
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;

  @media (max-width: ${theme.breakpoints.lg}) {
    ${({ $zenMode }) => $zenMode && `
      max-width: min(calc(100vw - ${ZEN_ART_MARGIN_H_MOBILE}px), calc(100dvh - ${ZEN_ART_MARGIN_V_MOBILE}px));
    `}
  }
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
    prevProps.glowRate !== nextProps.glowRate ||
    prevProps.glowEnabled !== nextProps.glowEnabled) {
    return false;
  }
  if (prevProps.zenMode !== nextProps.zenMode) {
    return false;
  }
  if (prevProps.translucenceEnabled !== nextProps.translucenceEnabled ||
      prevProps.translucenceOpacity !== nextProps.translucenceOpacity) {
    return false;
  }
  if (prevProps.onRetryAlbumArt !== nextProps.onRetryAlbumArt) {
    return false;
  }
  return true;
};

const AlbumArt: React.FC<AlbumArtProps> = memo(({ currentTrack = null, accentColor, glowIntensity, glowRate, glowEnabled, zenMode, translucenceEnabled, translucenceOpacity, onRetryAlbumArt }) => {
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { processImage } = useImageProcessingWorker();

  // Get responsive sizing information
  const { isMobile, isTablet } = usePlayerSizingContext();

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
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      ctx.drawImage(imageElement, 0, 0);
      const imageData = ctx.getImageData(0, 0, imageElement.width, imageElement.height);
      const processedImageData = await processImage(imageData, accentColorRgb, 40);
      ctx.putImageData(processedImageData, 0, 0);
      setCanvasUrl(canvas.toDataURL());
    } catch (error) {
      // Ignore expected errors from component unmounting during processing
      if (error instanceof Error && error.message === 'Component unmounted') {
        return;
      }
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

  return (
    <AlbumArtContainer
      accentColor={accentColor}
      glowIntensity={glowIntensity}
      glowRate={glowRate}
      glowEnabled={glowEnabled}
      $zenMode={zenMode}
      $translucenceOpacity={translucenceEnabled ? (translucenceOpacity ?? 0.8) : 1}
      style={currentTrack?.image ? {
        backgroundImage: `url(${currentTrack.image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      <>
        <AccentColorGlowOverlay
          glowIntensity={glowIntensity ?? DEFAULT_GLOW_INTENSITY}
          glowRate={glowRate ?? DEFAULT_GLOW_RATE}
          backgroundImage={currentTrack?.image}
        />
        {currentTrack?.image ? (
          <img
            src={glowIntensity === 0 || !canvasUrl ? currentTrack.image : canvasUrl}
            alt={currentTrack?.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
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
            backgroundColor: theme.colors.gray[900],
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: theme.colors.gray[500],
            borderRadius: theme.borderRadius['3xl']
          }}>
            <p style={{ margin: 0 }}>No image</p>
            {onRetryAlbumArt && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetryAlbumArt(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Retry
              </button>
            )}
          </div>
        )}
        {isProcessing && <ProcessingSpinner size={spinnerDimensions.size} innerSize={spinnerDimensions.innerSize} />}
      </>
    </AlbumArtContainer>

  );
}, arePropsEqual);

AlbumArt.displayName = 'AlbumArt';

export default AlbumArt; 