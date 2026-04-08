import { useRef } from 'react';
import styled from 'styled-components';
import type { MediaTrack } from '@/types/domain';
import type { VisualizerStyle } from '@/types/visualizer';
import QuickEffectsRow from '@/components/controls/QuickEffectsRow';
import { theme } from '@/styles/theme';

interface AlbumArtQuickSwapBackProps {
  currentTrack: MediaTrack | null;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  customAccentColorOverrides: Record<string, string>;
  onCustomAccentColor: (color: string) => void;
  glowEnabled: boolean;
  onGlowToggle: () => void;
  glowIntensity: number;
  onGlowIntensityChange: (v: number) => void;
  glowRate: number;
  onGlowRateChange: (v: number) => void;
  backgroundVisualizerEnabled: boolean;
  onBackgroundVisualizerToggle: () => void;
  backgroundVisualizerStyle: VisualizerStyle;
  onBackgroundVisualizerStyleChange: (style: VisualizerStyle) => void;
  backgroundVisualizerIntensity: number;
  onBackgroundVisualizerIntensityChange: (intensity: number) => void;
  backgroundVisualizerSpeed: number;
  onBackgroundVisualizerSpeedChange: (speed: number) => void;
  translucenceEnabled: boolean;
  onTranslucenceToggle: () => void;
  isMobile: boolean;
  isTablet: boolean;
  onClose: () => void;
  onRetryAlbumArt?: () => void;
}

const BacksideRoot = styled.div`
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: rotateY(180deg);
  border-radius: ${theme.borderRadius.xl};
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
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: ${theme.spacing.lg};
  box-sizing: border-box;
`;

const Title = styled.div`
  font-size: ${theme.fontSize.sm};
  font-weight: ${theme.fontWeight.semibold};
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: ${theme.spacing.xs};
`;

const CloseButton = styled.button`
  position: absolute;
  top: ${theme.spacing.sm};
  right: ${theme.spacing.sm};
  z-index: 2;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.6);
    color: rgba(255, 255, 255, 1);
  }

  &:active {
    background: rgba(0, 0, 0, 0.75);
  }
`;

const RetryButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  margin-top: ${theme.spacing.md};
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${theme.borderRadius.lg};
  font-size: ${theme.fontSize.xs};
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  &:active {
    background: rgba(255, 255, 255, 0.25);
  }
`;

function AlbumArtQuickSwapBack({
  currentTrack,
  accentColor,
  onAccentColorChange,
  customAccentColorOverrides,
  onCustomAccentColor,
  glowEnabled,
  onGlowToggle,
  glowIntensity,
  onGlowIntensityChange,
  glowRate,
  onGlowRateChange,
  backgroundVisualizerEnabled,
  onBackgroundVisualizerToggle,
  backgroundVisualizerStyle,
  onBackgroundVisualizerStyleChange,
  backgroundVisualizerIntensity,
  onBackgroundVisualizerIntensityChange,
  backgroundVisualizerSpeed,
  onBackgroundVisualizerSpeedChange,
  translucenceEnabled,
  onTranslucenceToggle,
  isMobile,
  isTablet,
  onClose,
  onRetryAlbumArt,
}: AlbumArtQuickSwapBackProps) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    pointerStartRef.current = null;
    if (dx < 10 && dy < 10) {
      if (controlsRef.current?.contains(e.target as Node)) return;
      onClose();
    }
  };

  return (
    <BacksideRoot onClick={(e) => e.stopPropagation()}>
      <BlurredBg $image={currentTrack?.image} />
      <DarkOverlay />
      <CloseButton aria-label="Close menu" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</CloseButton>

      <Content onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        {!isMobile && <Title>Visual Effects</Title>}
        <div ref={controlsRef} onClick={(e) => e.stopPropagation()}>
        <QuickEffectsRow
          currentTrack={currentTrack}
          accentColor={accentColor}
          onAccentColorChange={onAccentColorChange}
          customAccentColorOverrides={customAccentColorOverrides}
          onCustomAccentColor={onCustomAccentColor}
          glowEnabled={glowEnabled}
          onGlowToggle={onGlowToggle}
          glowIntensity={glowIntensity}
          onGlowIntensityChange={onGlowIntensityChange}
          glowRate={glowRate}
          onGlowRateChange={onGlowRateChange}
          backgroundVisualizerEnabled={backgroundVisualizerEnabled}
          onBackgroundVisualizerToggle={onBackgroundVisualizerToggle}
          backgroundVisualizerStyle={backgroundVisualizerStyle}
          onBackgroundVisualizerStyleChange={onBackgroundVisualizerStyleChange}
          backgroundVisualizerIntensity={backgroundVisualizerIntensity}
          onBackgroundVisualizerIntensityChange={onBackgroundVisualizerIntensityChange}
          backgroundVisualizerSpeed={backgroundVisualizerSpeed}
          onBackgroundVisualizerSpeedChange={onBackgroundVisualizerSpeedChange}
          translucenceEnabled={translucenceEnabled}
          onTranslucenceToggle={onTranslucenceToggle}
          isMobile={isMobile}
          isTablet={isTablet}
        />
        </div>
        {onRetryAlbumArt && !currentTrack?.image && (
          <RetryButton onClick={(e) => { e.stopPropagation(); onRetryAlbumArt(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Retry Artwork
          </RetryButton>
        )}
      </Content>
    </BacksideRoot>
  );
}

export default AlbumArtQuickSwapBack;
