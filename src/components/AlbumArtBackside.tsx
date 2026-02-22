import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import type { Track } from '@/services/spotify';
import { extractTopVibrantColors } from '@/utils/colorExtractor';
import type { ExtractedColor } from '@/utils/colorExtractor';
import EyedropperOverlay from './EyedropperOverlay';
import { OptionButton, OptionButtonGroup } from './VisualEffectsMenu/styled';
import { theme } from '@/styles/theme';

interface AlbumArtBacksideProps {
  currentTrack: Track | null;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  customAccentColorOverrides: Record<string, string>;
  onCustomAccentColor: (color: string) => void;
  glowEnabled: boolean;
  onGlowToggle: () => void;
  backgroundVisualizerEnabled: boolean;
  onBackgroundVisualizerToggle: () => void;
  backgroundVisualizerStyle: string;
  onBackgroundVisualizerStyleChange: (style: 'particles' | 'geometric') => void;
  onClose: () => void;
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
  background: rgba(0, 0, 0, 0.75);
`;

const Content = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
`;

const SectionLabel = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
`;

const SwatchRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  z-index: 2;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.6);
  }
`;

const SwatchButton = styled.button<{ $color: string; $isActive: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  border: ${({ $isActive }) =>
    $isActive ? '3px solid #fff' : '2px solid rgba(255, 255, 255, 0.4)'};
  outline: ${({ $isActive }) => ($isActive ? '2px solid #ffd700' : 'none')};
  cursor: pointer;
  transition: box-shadow 0.2s, border 0.2s;
  padding: 0;
`;

const EyedropperButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.4);
  background: transparent;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const ResetBtn = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const ToggleLabel = styled.span`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  min-width: 60px;
`;

const AlbumArtBackside = ({
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
  onClose,
}: AlbumArtBacksideProps) => {
  const [colorOptions, setColorOptions] = useState<ExtractedColor[]>([]);
  const [showEyedropper, setShowEyedropper] = useState(false);

  const customColor = currentTrack?.album_id
    ? customAccentColorOverrides[currentTrack.album_id]
    : undefined;

  useEffect(() => {
    if (currentTrack?.image) {
      extractTopVibrantColors(currentTrack.image, 2).then(setColorOptions);
    }
  }, [currentTrack?.image]);

  return (
    <BacksideRoot onClick={(e) => e.stopPropagation()}>
      <BlurredBg $image={currentTrack?.image} />
      <DarkOverlay />

      <CloseBtn onClick={onClose} title="Close" aria-label="Close">
        &times;
      </CloseBtn>

      <Content>
        {/* Accent Color Section */}
        <div>
          <SectionLabel>Accent Color</SectionLabel>
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
              <EyedropperButton
                onClick={() => setShowEyedropper(true)}
                title="Pick color from album art"
                aria-label="Pick color from album art"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m2 22 1-1h3l9-9" />
                  <path d="M3 21v-3l9-9" />
                  <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9" />
                  <path d="m15 6 3 3" />
                </svg>
              </EyedropperButton>
            )}

            <ResetBtn
              onClick={() => {
                onCustomAccentColor('');
                onAccentColorChange('RESET_TO_DEFAULT');
              }}
              title="Reset to default color"
            >
              &#8634; Reset
            </ResetBtn>
          </SwatchRow>
        </div>

        {/* Glow Toggle */}
        <div>
          <SectionLabel>Glow</SectionLabel>
          <ToggleRow>
            <ToggleLabel />
            <OptionButtonGroup>
              <OptionButton
                $accentColor={accentColor}
                $isActive={glowEnabled}
                onClick={onGlowToggle}
              >
                On
              </OptionButton>
              <OptionButton
                $accentColor={accentColor}
                $isActive={!glowEnabled}
                onClick={onGlowToggle}
              >
                Off
              </OptionButton>
            </OptionButtonGroup>
          </ToggleRow>
        </div>

        {/* Visualizer Toggle */}
        <div>
          <SectionLabel>Visualizer</SectionLabel>
          <ToggleRow>
            <ToggleLabel />
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
          </ToggleRow>
        </div>

        {/* Visualizer Style (only when enabled) */}
        {backgroundVisualizerEnabled && (
          <div>
            <SectionLabel>Style</SectionLabel>
            <ToggleRow>
              <ToggleLabel />
              <OptionButtonGroup>
                <OptionButton
                  $accentColor={accentColor}
                  $isActive={backgroundVisualizerStyle === 'particles'}
                  onClick={() => onBackgroundVisualizerStyleChange('particles')}
                >
                  Particles
                </OptionButton>
                <OptionButton
                  $accentColor={accentColor}
                  $isActive={backgroundVisualizerStyle === 'geometric'}
                  onClick={() => onBackgroundVisualizerStyleChange('geometric')}
                >
                  Geometric
                </OptionButton>
              </OptionButtonGroup>
            </ToggleRow>
          </div>
        )}
      </Content>

      {/* Eyedropper Overlay */}
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
    </BacksideRoot>
  );
};

export default AlbumArtBackside;
