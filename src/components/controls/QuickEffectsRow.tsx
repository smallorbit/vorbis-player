import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import type { MediaTrack } from '@/types/domain';
import type { VisualizerStyle } from '@/types/visualizer';
import { extractTopVibrantColors } from '@/utils/colorExtractor';
import type { ExtractedColor } from '@/utils/colorExtractor';
import { OptionButton, OptionButtonGroup } from '@/components/VisualEffectsMenu/styled';
import EyedropperOverlay from '@/components/EyedropperOverlay';
import Switch from '@/components/controls/Switch';
import { theme } from '@/styles/theme';

interface QuickEffectsRowProps {
  currentTrack: MediaTrack | null;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  customAccentColorOverrides: Record<string, string>;
  onCustomAccentColor: (color: string) => void;
  glowEnabled: boolean;
  onGlowToggle: () => void;
  glowIntensity?: number;
  onGlowIntensityChange?: (v: number) => void;
  glowRate?: number;
  onGlowRateChange?: (v: number) => void;
  backgroundVisualizerEnabled: boolean;
  onBackgroundVisualizerToggle: () => void;
  backgroundVisualizerStyle: VisualizerStyle;
  onBackgroundVisualizerStyleChange: (style: VisualizerStyle) => void;
  backgroundVisualizerIntensity?: number;
  onBackgroundVisualizerIntensityChange?: (intensity: number) => void;
  translucenceEnabled: boolean;
  onTranslucenceToggle: () => void;
  isMobile: boolean;
  isTablet: boolean;
}

const QuickRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.spacing.sm};
  width: 100%;
  margin-top: ${theme.spacing.xs};
`;

const RowLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  flex-wrap: wrap;
`;

const QuickLabel = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.muted.foreground};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-right: 2px;
`;

const SwatchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const SwatchButton = styled.button<{ $color: string; $isActive: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  border: ${({ theme, $isActive }) =>
    $isActive ? `2px solid ${theme.colors.white}` : `1px solid ${theme.colors.control.border}`};
  outline: ${({ theme, $isActive }) => ($isActive ? `2px solid ${theme.colors.selection}` : 'none')};
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: border ${({ theme }) => theme.transitions.fast};
`;

const IconButton = styled.button`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.colors.control.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.muted.foreground};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: background ${({ theme }) => theme.transitions.fast}, color ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.control.backgroundHover};
    color: ${({ theme }) => theme.colors.white};
  }

  svg {
    width: 12px;
    height: 12px;
  }
`;

const ResetBtn = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-size: 10px;
  padding: 2px 6px;
  cursor: pointer;
  flex-shrink: 0;
  transition: color ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.white};
  }
`;

/* Section card that groups a feature toggle with its sub-settings */
const SectionCard = styled.div`
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: ${theme.borderRadius.lg};
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SectionTitle = styled.span`
  font-size: 11px;
  font-weight: ${theme.fontWeight.semibold};
  color: rgba(255, 255, 255, 0.85);
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const SubSettings = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
`;

const SubSettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  flex-wrap: wrap;
`;

const SubLabel = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.muted.foreground};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  min-width: 52px;
`;

function QuickEffectsRow({
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
}: QuickEffectsRowProps) {
  const [colorOptions, setColorOptions] = useState<ExtractedColor[]>([]);
  const [showEyedropper, setShowEyedropper] = useState(false);

  const customColor = currentTrack?.albumId
    ? customAccentColorOverrides[currentTrack.albumId]
    : undefined;

  useEffect(() => {
    if (currentTrack?.image) {
      extractTopVibrantColors(currentTrack.image, 2).then(setColorOptions);
    } else {
      setColorOptions([]);
    }
  }, [currentTrack?.image]);

  const handleResetColor = () => {
    onCustomAccentColor('');
    onAccentColorChange('RESET_TO_DEFAULT');
  };

  const hasGlowSubSettings = glowIntensity !== undefined && onGlowIntensityChange;
  const hasGlowRate = glowRate !== undefined && onGlowRateChange;
  const hasVizIntensity = backgroundVisualizerIntensity !== undefined && onBackgroundVisualizerIntensityChange;

  return (
    <QuickRow>
      {/* Color swatches + eyedropper + reset */}
      <RowLine>
        <QuickLabel>Color</QuickLabel>
        <SwatchRow>
          {colorOptions.map((color) => (
            <SwatchButton
              key={color.hex}
              $color={color.hex}
              $isActive={color.hex === accentColor}
              onClick={() => onAccentColorChange(color.hex)}
              title={color.hex}
              aria-label={`Choose color ${color.hex}`}
            />
          ))}
          {customColor && (
            <SwatchButton
              $color={customColor}
              $isActive={customColor === accentColor}
              onClick={() => onAccentColorChange(customColor)}
              title="Custom color"
              aria-label="Use custom color"
            />
          )}
          {currentTrack?.image && (
            <IconButton
              onClick={() => setShowEyedropper(true)}
              title="Pick color from album art"
              aria-label="Pick color from album art"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m2 22 1-1h3l9-9" />
                <path d="M3 21v-3l9-9" />
                <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9" />
                <path d="m15 6 3 3" />
              </svg>
            </IconButton>
          )}
          <ResetBtn onClick={handleResetColor} title="Reset to default color">
            Reset
          </ResetBtn>
        </SwatchRow>
      </RowLine>

      {/* Glow section */}
      <SectionCard>
        <SectionHeader>
          <SectionTitle>Glow</SectionTitle>
          <Switch on={glowEnabled} onToggle={onGlowToggle} ariaLabel="Toggle glow" />
        </SectionHeader>
        {(hasGlowSubSettings || hasGlowRate) && glowEnabled && (
          <SubSettings>
            {hasGlowSubSettings && (
              <SubSettingRow>
                <SubLabel>Intensity</SubLabel>
                <OptionButtonGroup>
                  <OptionButton $isActive={glowIntensity === 95} onClick={() => onGlowIntensityChange(95)}>Less</OptionButton>
                  <OptionButton $isActive={glowIntensity === 110} onClick={() => onGlowIntensityChange(110)}>Normal</OptionButton>
                  <OptionButton $isActive={glowIntensity === 125} onClick={() => onGlowIntensityChange(125)}>More</OptionButton>
                </OptionButtonGroup>
              </SubSettingRow>
            )}
            {hasGlowRate && (
              <SubSettingRow>
                <SubLabel>Rate</SubLabel>
                <OptionButtonGroup>
                  <OptionButton $isActive={glowRate === 5.0} onClick={() => onGlowRateChange(5.0)}>Slower</OptionButton>
                  <OptionButton $isActive={glowRate === 4.0} onClick={() => onGlowRateChange(4.0)}>Normal</OptionButton>
                  <OptionButton $isActive={glowRate === 3.0} onClick={() => onGlowRateChange(3.0)}>Faster</OptionButton>
                </OptionButtonGroup>
              </SubSettingRow>
            )}
          </SubSettings>
        )}
      </SectionCard>

      {/* Visualizer section */}
      <SectionCard>
        <SectionHeader>
          <SectionTitle>Visualizer</SectionTitle>
          <Switch on={backgroundVisualizerEnabled} onToggle={onBackgroundVisualizerToggle} ariaLabel="Toggle visualizer" />
        </SectionHeader>
        {backgroundVisualizerEnabled && <SubSettings>
          <SubSettingRow>
            <SubLabel>Style</SubLabel>
            <OptionButtonGroup>
              <OptionButton
                $isActive={backgroundVisualizerStyle === 'fireflies'}
                onClick={() => onBackgroundVisualizerStyleChange('fireflies')}
              >
                Fireflies
              </OptionButton>
              <OptionButton
                $isActive={backgroundVisualizerStyle === 'comet'}
                onClick={() => onBackgroundVisualizerStyleChange('comet')}
              >
                Comet
              </OptionButton>
            </OptionButtonGroup>
          </SubSettingRow>
          {hasVizIntensity && (
            <SubSettingRow>
              <SubLabel>Intensity</SubLabel>
              <OptionButtonGroup>
                <OptionButton
                  $isActive={backgroundVisualizerIntensity === 20}
                  onClick={() => onBackgroundVisualizerIntensityChange(20)}
                >
                  Less
                </OptionButton>
                <OptionButton
                  $isActive={backgroundVisualizerIntensity === 40}
                  onClick={() => onBackgroundVisualizerIntensityChange(40)}
                >
                  Normal
                </OptionButton>
                <OptionButton
                  $isActive={backgroundVisualizerIntensity === 60}
                  onClick={() => onBackgroundVisualizerIntensityChange(60)}
                >
                  More
                </OptionButton>
              </OptionButtonGroup>
            </SubSettingRow>
          )}
        </SubSettings>}
      </SectionCard>

      {/* Translucent section */}
      <SectionCard>
        <SectionHeader>
          <SectionTitle>Translucent</SectionTitle>
          <Switch on={translucenceEnabled} onToggle={onTranslucenceToggle} ariaLabel="Toggle translucence" />
        </SectionHeader>
      </SectionCard>

      {showEyedropper &&
        currentTrack?.image &&
        createPortal(
          <EyedropperOverlay
            image={currentTrack.image}
            onPick={(color) => {
              onCustomAccentColor(color);
              onAccentColorChange(color);
              setShowEyedropper(false);
            }}
            onClose={() => setShowEyedropper(false)}
          />,
          document.body
        )}
    </QuickRow>
  );
}

export default QuickEffectsRow;
