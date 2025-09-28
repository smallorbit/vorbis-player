import React, { Suspense, lazy } from 'react';
import styled from 'styled-components';
import { CardContent } from './styled';
import AlbumArt from './AlbumArt';
import { theme } from '@/styles/theme';
import { cardBase } from '../styles/utils';

const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu'));
const PlaylistDrawer = lazy(() => import('./PlaylistDrawer'));
const SpotifyPlayerControls = lazy(() => import('./SpotifyPlayerControls'));

interface AlbumArtFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sepia: number;
}

interface PlayerContentHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShowPlaylist: () => void;
  onShowVisualEffects: () => void;
  onCloseVisualEffects: () => void;
  onClosePlaylist: () => void;
  onTrackSelect: (index: number) => void;
  onAccentColorChange: (color: string) => void;
  onGlowToggle: () => void;
  onFilterChange: (filter: string, value: number) => void;
  onResetFilters: () => void;
  onGlowIntensityChange: (intensity: number) => void;
  onGlowRateChange: (rate: number) => void;
}

interface PlayerContentProps {
  track: {
    current: SpotifyTrack | null;
    list: SpotifyTrack[];
    currentIndex: number;
  };
  ui: {
    accentColor: string;
    showVisualEffects: boolean;
    showPlaylist: boolean;
  };
  effects: {
    enabled: boolean;
    glow: { intensity: number; rate: number };
    filters: AlbumArtFilters;
  };
  handlers: PlayerContentHandlers;
}

const ContentWrapper = styled.div`
  width: 1024px;
  height: 1186px;

  @media (max-height: ${theme.breakpoints.lg}) {
    width: 768px;
    height: 922px;
  }

  margin: 0 auto;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  box-sizing: border-box;
  position: absolute;
  z-index: 1000;
`;

const LoadingCard = styled.div.withConfig({
  shouldForwardProp: (prop: string) => !['backgroundImage', 'standalone', 'accentColor', 'glowEnabled', 'glowIntensity', 'glowRate'].includes(prop),
}) <{
  backgroundImage?: string;
  standalone?: boolean;
  accentColor?: string;
  glowEnabled?: boolean;
  glowIntensity?: number;
  glowRate?: number;
}>`
  ${cardBase};
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid rgba(34, 36, 36, 0.68);
  box-shadow: 0 8px 24px rgba(38, 36, 37, 0.7), 0 2px 8px rgba(22, 21, 21, 0.6);
  ${({ backgroundImage }) => backgroundImage ? `
    &::after {
      content: '';
      position: absolute;
      inset: 0.1rem;
      background-image: url(${backgroundImage});
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      border-radius: 1.25rem;
      z-index: 0;
    }
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(32, 30, 30, 0.7);
      backdrop-filter: blur(40px);
      border-radius: 1.25rem;
      z-index: 1;
    }
  ` : `
    background: rgba(38, 38, 38, 0.5);
    backdrop-filter: blur(12px);
  `}
`;

const ControlsLoadingFallback = () => (
  <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
    Loading controls...
  </div>
);

const EffectsLoadingFallback = () => (
  <div>Loading effects...</div>
);

const PlaylistLoadingFallback = () => (
  <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
    Loading playlist...
  </div>
);

const PlayerContent: React.FC<PlayerContentProps> = ({ track, ui, effects, handlers }) => {
  const defaultFilters = {
    brightness: 110,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    sepia: 0
  };

  return (
    <ContentWrapper>
      <LoadingCard
        backgroundImage={track.current?.image}
        accentColor={ui.accentColor}
        glowEnabled={effects.enabled}
        glowIntensity={effects.glow.intensity}
        glowRate={effects.glow.rate}
      >
        <CardContent style={{ position: 'relative', zIndex: 2, marginTop: '-0.25rem' }}>
          <AlbumArt
            currentTrack={track.current}
            accentColor={ui.accentColor}
            glowIntensity={effects.enabled ? effects.glow.intensity : 0}
            glowRate={effects.glow.rate}
            albumFilters={effects.enabled ? effects.filters : defaultFilters}
          />
        </CardContent>

        <CardContent style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2 }}>
          <Suspense fallback={<ControlsLoadingFallback />}>
            <SpotifyPlayerControls
              currentTrack={track.current}
              accentColor={ui.accentColor}
              onPlay={handlers.onPlay}
              onPause={handlers.onPause}
              onNext={handlers.onNext}
              onPrevious={handlers.onPrevious}
              onShowPlaylist={handlers.onShowPlaylist}
              trackCount={track.list.length}
              onAccentColorChange={handlers.onAccentColorChange}
              onShowVisualEffects={handlers.onShowVisualEffects}
              glowEnabled={effects.enabled}
              onGlowToggle={handlers.onGlowToggle}
            />
          </Suspense>
        </CardContent>

        {effects.enabled && (
          <Suspense fallback={<EffectsLoadingFallback />}>
            <VisualEffectsMenu
              isOpen={ui.showVisualEffects}
              onClose={handlers.onCloseVisualEffects}
              accentColor={ui.accentColor}
              filters={effects.filters}
              onFilterChange={handlers.onFilterChange}
              onResetFilters={handlers.onResetFilters}
              glowIntensity={effects.glow.intensity}
              setGlowIntensity={handlers.onGlowIntensityChange}
              glowRate={effects.glow.rate}
              setGlowRate={handlers.onGlowRateChange}
              effectiveGlow={effects.glow}
            />
          </Suspense>
        )}
      </LoadingCard>

      <Suspense fallback={<PlaylistLoadingFallback />}>
        <PlaylistDrawer
          isOpen={ui.showPlaylist}
          onClose={handlers.onClosePlaylist}
          tracks={track.list}
          currentTrackIndex={track.currentIndex}
          accentColor={ui.accentColor}
          onTrackSelect={handlers.onTrackSelect}
        />
      </Suspense>
    </ContentWrapper>
  );
};

export default PlayerContent;