import styled from 'styled-components';
import type { Track } from '@/services/spotify';
import QuickEffectsRow from '@/components/controls/QuickEffectsRow';
import { theme } from '@/styles/theme';

interface AlbumArtQuickSwapBackProps {
  currentTrack: Track | null;
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
  backgroundVisualizerStyle: 'fireflies' | 'comet';
  onBackgroundVisualizerStyleChange: (style: 'fireflies' | 'comet') => void;
  backgroundVisualizerIntensity: number;
  onBackgroundVisualizerIntensityChange: (intensity: number) => void;
  translucenceEnabled: boolean;
  onTranslucenceToggle: () => void;
  isMobile: boolean;
  isTablet: boolean;
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
  margin-bottom: ${theme.spacing.md};
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
  translucenceEnabled,
  onTranslucenceToggle,
  isMobile,
  isTablet,
}: AlbumArtQuickSwapBackProps) {
  return (
    <BacksideRoot>
      <BlurredBg $image={currentTrack?.image} />
      <DarkOverlay />

      <Content>
        <Title>Visual Effects</Title>
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
          translucenceEnabled={translucenceEnabled}
          onTranslucenceToggle={onTranslucenceToggle}
          isMobile={isMobile}
          isTablet={isTablet}
        />
      </Content>
    </BacksideRoot>
  );
}

export default AlbumArtQuickSwapBack;
