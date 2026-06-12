import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import type { MediaTrack } from '@/types/domain';
import type { VisualizerStyle } from '@/types/visualizer';
import { extractTopVibrantColors } from '@/utils/colorExtractor';
import type { ExtractedColor } from '@/utils/colorExtractor';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import EyedropperOverlay from '@/components/EyedropperOverlay';
import { Switch } from '@/components/ui/switch';
import { theme } from '@/styles/theme';

interface QuickEffectsRowProps {
  currentTrack: MediaTrack | null;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  customAccentColorOverrides: Record<string, string>;
  onCustomAccentColor: (color: string) => void;
  glowEnabled: boolean;
  onGlowToggle: () => void;
  glowIntensity?: number | undefined;
  onGlowIntensityChange?: ((v: number) => void) | undefined;
  glowRate?: number | undefined;
  onGlowRateChange?: ((v: number) => void) | undefined;
  backgroundVisualizerEnabled: boolean;
  onBackgroundVisualizerToggle: () => void;
  backgroundVisualizerStyle: VisualizerStyle;
  onBackgroundVisualizerStyleChange: (style: VisualizerStyle) => void;
  backgroundVisualizerIntensity?: number | undefined;
  onBackgroundVisualizerIntensityChange?: ((intensity: number) => void) | undefined;
  backgroundVisualizerSpeed?: number | undefined;
  onBackgroundVisualizerSpeedChange?: ((speed: number) => void) | undefined;
  translucenceEnabled: boolean;
  onTranslucenceToggle: () => void;
  isMobile: boolean;
  isTablet: boolean;
}

const VISUALIZER_STYLES: readonly VisualizerStyle[] = ['fireflies', 'comet', 'wave', 'grid'];

const isVisualizerStyle = (value: string): value is VisualizerStyle =>
  (VISUALIZER_STYLES as readonly string[]).includes(value);

const QuickRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.spacing.xs};
  width: 100%;
  margin-top: 2px;
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
  border: 1px solid ${({ theme }) => theme.colors.control.border};
  outline: ${({ $isActive }) => ($isActive ? '2px solid var(--accent-contrast-color)' : 'none')};
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: outline ${({ theme }) => theme.transitions.fast};
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
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  gap: 3px;
`;

const SubSettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.xs};
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
  backgroundVisualizerSpeed,
  onBackgroundVisualizerSpeedChange,
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
  const hasVizSpeed = backgroundVisualizerSpeed !== undefined && onBackgroundVisualizerSpeedChange;

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
          <Switch checked={glowEnabled} onCheckedChange={onGlowToggle} aria-label="Toggle glow" />
        </SectionHeader>
        {(hasGlowSubSettings || hasGlowRate) && glowEnabled && (
          <SubSettings>
            {hasGlowSubSettings && (
              <SubSettingRow>
                <SubLabel>Intensity</SubLabel>
                <ToggleGroup
                  type="single"
                  variant="accent"
                  aria-label="Glow intensity"
                  value={String(glowIntensity)}
                  onValueChange={(v) => v && onGlowIntensityChange(Number(v))}
                >
                  <ToggleGroupItem value="95">Less</ToggleGroupItem>
                  <ToggleGroupItem value="110">Normal</ToggleGroupItem>
                  <ToggleGroupItem value="125">More</ToggleGroupItem>
                </ToggleGroup>
              </SubSettingRow>
            )}
            {hasGlowRate && (
              <SubSettingRow>
                <SubLabel>Rate</SubLabel>
                <ToggleGroup
                  type="single"
                  variant="accent"
                  aria-label="Glow rate"
                  value={String(glowRate)}
                  onValueChange={(v) => v && onGlowRateChange(Number(v))}
                >
                  <ToggleGroupItem value="5">Slower</ToggleGroupItem>
                  <ToggleGroupItem value="4">Normal</ToggleGroupItem>
                  <ToggleGroupItem value="3">Faster</ToggleGroupItem>
                </ToggleGroup>
              </SubSettingRow>
            )}
          </SubSettings>
        )}
      </SectionCard>

      {/* Visualizer section */}
      <SectionCard>
        <SectionHeader>
          <SectionTitle>Visualizer</SectionTitle>
          <Switch checked={backgroundVisualizerEnabled} onCheckedChange={onBackgroundVisualizerToggle} aria-label="Toggle visualizer" />
        </SectionHeader>
        {backgroundVisualizerEnabled && <SubSettings>
          <SubSettingRow>
            <SubLabel>Style</SubLabel>
            <ToggleGroup
              type="single"
              variant="accent"
              aria-label="Visualizer style"
              value={backgroundVisualizerStyle}
              onValueChange={(v) => isVisualizerStyle(v) && onBackgroundVisualizerStyleChange(v)}
            >
              <ToggleGroupItem value="fireflies">Fireflies</ToggleGroupItem>
              <ToggleGroupItem value="comet">Comet</ToggleGroupItem>
              <ToggleGroupItem value="wave">Wave</ToggleGroupItem>
              <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
            </ToggleGroup>
          </SubSettingRow>
          {hasVizIntensity && (
            <SubSettingRow>
              <SubLabel>Intensity</SubLabel>
              <ToggleGroup
                type="single"
                variant="accent"
                aria-label="Visualizer intensity"
                value={String(backgroundVisualizerIntensity)}
                onValueChange={(v) => v && onBackgroundVisualizerIntensityChange(Number(v))}
              >
                <ToggleGroupItem value="20">Less</ToggleGroupItem>
                <ToggleGroupItem value="40">Normal</ToggleGroupItem>
                <ToggleGroupItem value="60">More</ToggleGroupItem>
              </ToggleGroup>
            </SubSettingRow>
          )}
          {hasVizSpeed && (
            <SubSettingRow>
              <SubLabel>Speed</SubLabel>
              <ToggleGroup
                type="single"
                variant="accent"
                aria-label="Visualizer speed"
                value={String(backgroundVisualizerSpeed)}
                onValueChange={(v) => v && onBackgroundVisualizerSpeedChange(Number(v))}
              >
                <ToggleGroupItem value="0.5">Slower</ToggleGroupItem>
                <ToggleGroupItem value="0.7">Normal</ToggleGroupItem>
                <ToggleGroupItem value="1.2">Faster</ToggleGroupItem>
              </ToggleGroup>
            </SubSettingRow>
          )}
        </SubSettings>}
      </SectionCard>

      {/* Translucent section */}
      <SectionCard>
        <SectionHeader>
          <SectionTitle>Translucent</SectionTitle>
          <Switch checked={translucenceEnabled} onCheckedChange={onTranslucenceToggle} aria-label="Toggle translucence" />
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
