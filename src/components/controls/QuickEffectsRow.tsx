import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import type { Track } from '@/services/spotify';
import { extractTopVibrantColors } from '@/utils/colorExtractor';
import type { ExtractedColor } from '@/utils/colorExtractor';
import { OptionButton, OptionButtonGroup } from '@/components/VisualEffectsMenu/styled';
import EyedropperOverlay from '@/components/EyedropperOverlay';
import { theme } from '@/styles/theme';

export interface QuickEffectsRowProps {
  currentTrack: Track | null;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  customAccentColorOverrides: Record<string, string>;
  onCustomAccentColor: (color: string) => void;
  glowEnabled: boolean;
  onGlowToggle: () => void;
  backgroundVisualizerEnabled: boolean;
  onBackgroundVisualizerToggle: () => void;
  backgroundVisualizerStyle: 'fireflies' | 'comet';
  onBackgroundVisualizerStyleChange: (style: 'fireflies' | 'comet') => void;
  isMobile: boolean;
  isTablet: boolean;
}

const QuickRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  width: 100%;
  margin-top: ${theme.spacing.xs};
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

const ToggleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

function QuickEffectsRow({
  currentTrack,
  accentColor,
  onAccentColorChange,
  customAccentColorOverrides,
  onCustomAccentColor,
  glowEnabled,
  onGlowToggle,
  backgroundVisualizerEnabled,
  onBackgroundVisualizerToggle,
  backgroundVisualizerStyle,
  onBackgroundVisualizerStyleChange,
}: QuickEffectsRowProps) {
  const [colorOptions, setColorOptions] = useState<ExtractedColor[]>([]);
  const [showEyedropper, setShowEyedropper] = useState(false);

  const customColor = currentTrack?.album_id
    ? customAccentColorOverrides[currentTrack.album_id]
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

  return (
    <QuickRow>
      {/* Accent: swatches + pick + reset */}
      <ToggleGroup>
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
      </ToggleGroup>

      {/* Glow */}
      <ToggleGroup>
        <QuickLabel>Glow</QuickLabel>
        <OptionButtonGroup>
          <OptionButton $accentColor={accentColor} $isActive={glowEnabled} onClick={onGlowToggle}>
            On
          </OptionButton>
          <OptionButton $accentColor={accentColor} $isActive={!glowEnabled} onClick={onGlowToggle}>
            Off
          </OptionButton>
        </OptionButtonGroup>
      </ToggleGroup>

      {/* Visualizer */}
      <ToggleGroup>
        <QuickLabel>Viz</QuickLabel>
        <OptionButtonGroup>
          <OptionButton
            $accentColor={accentColor}
            $isActive={backgroundVisualizerEnabled}
            onClick={onBackgroundVisualizerToggle}
          >
            On
          </OptionButton>
          <OptionButton
            $accentColor={accentColor}
            $isActive={!backgroundVisualizerEnabled}
            onClick={onBackgroundVisualizerToggle}
          >
            Off
          </OptionButton>
        </OptionButtonGroup>
      </ToggleGroup>

      {/* Style (when viz on) */}
      {backgroundVisualizerEnabled && (
        <ToggleGroup>
          <QuickLabel>Style</QuickLabel>
          <OptionButtonGroup>
            <OptionButton
              $accentColor={accentColor}
              $isActive={backgroundVisualizerStyle === 'fireflies'}
              onClick={() => onBackgroundVisualizerStyleChange('fireflies')}
            >
              Fireflies
            </OptionButton>
            <OptionButton
              $accentColor={accentColor}
              $isActive={backgroundVisualizerStyle === 'comet'}
              onClick={() => onBackgroundVisualizerStyleChange('comet')}
            >
              Comet
            </OptionButton>
          </OptionButtonGroup>
        </ToggleGroup>
      )}

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
