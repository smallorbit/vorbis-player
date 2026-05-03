import React, { useCallback } from 'react';

import type { VisualizerStyle } from '@/types/visualizer';
import { useVisualizer } from '@/contexts/visualEffects';
import { Switch } from '@/components/ui/switch';
import { OptionButton, OptionButtonGroup } from '@/components/AppSettingsMenu/styled';

import {
  ControlBlock,
  ControlRow,
  ControlLabelText,
  ControlHelp,
  SectionGroupTitle,
  SubControlRow,
  SubControlLabel,
} from '../AppearanceSection.styled';

const VISUALIZER_STYLES: ReadonlyArray<{ value: VisualizerStyle; label: string }> = [
  { value: 'fireflies', label: 'Fireflies' },
  { value: 'comet', label: 'Comet' },
  { value: 'wave', label: 'Wave' },
  { value: 'grid', label: 'Grid' },
] as const;

const INTENSITY_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 20, label: 'Less' },
  { value: 40, label: 'Normal' },
  { value: 60, label: 'More' },
] as const;

const SPEED_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0.5, label: 'Slower' },
  { value: 0.7, label: 'Normal' },
  { value: 1.2, label: 'Faster' },
] as const;

/**
 * SettingsV2 visualizer-style picker — phase 3 port (#1451).
 *
 * Reads + writes the same `VisualizerContext` (and therefore the same
 * `BG_VISUALIZER_*` storage keys) as the legacy `controls/QuickEffectsRow`
 * so toggling in either surface reflects in the other immediately.
 */
export const VisualizerStylePicker: React.FC = () => {
  const {
    backgroundVisualizerEnabled,
    setBackgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    setBackgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    setBackgroundVisualizerIntensity,
    backgroundVisualizerSpeed,
    setBackgroundVisualizerSpeed,
  } = useVisualizer();

  const handleToggle = useCallback(
    (checked: boolean) => {
      setBackgroundVisualizerEnabled(checked);
    },
    [setBackgroundVisualizerEnabled],
  );

  return (
    <ControlBlock>
      <SectionGroupTitle>Visualizer</SectionGroupTitle>
      <ControlRow>
        <div>
          <ControlLabelText htmlFor="settings-v2-visualizer-toggle">Background visualizer</ControlLabelText>
          <ControlHelp>Animate the background based on the current track.</ControlHelp>
        </div>
        <Switch
          id="settings-v2-visualizer-toggle"
          checked={backgroundVisualizerEnabled}
          onCheckedChange={handleToggle}
          aria-label="Toggle background visualizer"
          variant="neutral"
        />
      </ControlRow>

      {backgroundVisualizerEnabled && (
        <>
          <SubControlRow role="radiogroup" aria-label="Visualizer style">
            <SubControlLabel id="settings-v2-visualizer-style-label">Style</SubControlLabel>
            <OptionButtonGroup>
              {VISUALIZER_STYLES.map((opt) => (
                <OptionButton
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={backgroundVisualizerStyle === opt.value}
                  $isActive={backgroundVisualizerStyle === opt.value}
                  onClick={() => setBackgroundVisualizerStyle(opt.value)}
                >
                  {opt.label}
                </OptionButton>
              ))}
            </OptionButtonGroup>
          </SubControlRow>

          <SubControlRow>
            <SubControlLabel>Intensity</SubControlLabel>
            <OptionButtonGroup aria-label="Visualizer intensity">
              {INTENSITY_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt.value}
                  type="button"
                  $isActive={backgroundVisualizerIntensity === opt.value}
                  onClick={() => setBackgroundVisualizerIntensity(opt.value)}
                >
                  {opt.label}
                </OptionButton>
              ))}
            </OptionButtonGroup>
          </SubControlRow>

          <SubControlRow>
            <SubControlLabel>Speed</SubControlLabel>
            <OptionButtonGroup aria-label="Visualizer speed">
              {SPEED_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt.value}
                  type="button"
                  $isActive={backgroundVisualizerSpeed === opt.value}
                  onClick={() => setBackgroundVisualizerSpeed(opt.value)}
                >
                  {opt.label}
                </OptionButton>
              ))}
            </OptionButtonGroup>
          </SubControlRow>
        </>
      )}
    </ControlBlock>
  );
};

VisualizerStylePicker.displayName = 'SettingsV2.VisualizerStylePicker';

export default VisualizerStylePicker;
