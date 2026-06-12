import React, { useCallback } from 'react';

import type { VisualizerStyle } from '@/types/visualizer';
import { useVisualizer } from '@/contexts/visualEffects';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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

const isVisualizerStyle = (value: string): value is VisualizerStyle =>
  VISUALIZER_STYLES.some((opt) => opt.value === value);

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
          <SubControlRow>
            <SubControlLabel id="settings-v2-visualizer-style-label">Style</SubControlLabel>
            <ToggleGroup
              type="single"
              aria-label="Visualizer style"
              value={backgroundVisualizerStyle}
              onValueChange={(v) => isVisualizerStyle(v) && setBackgroundVisualizerStyle(v)}
            >
              {VISUALIZER_STYLES.map((opt) => (
                <ToggleGroupItem key={opt.value} value={opt.value}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SubControlRow>

          <SubControlRow>
            <SubControlLabel>Intensity</SubControlLabel>
            <ToggleGroup
              type="single"
              aria-label="Visualizer intensity"
              value={String(backgroundVisualizerIntensity)}
              onValueChange={(v) => v && setBackgroundVisualizerIntensity(Number(v))}
            >
              {INTENSITY_OPTIONS.map((opt) => (
                <ToggleGroupItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SubControlRow>

          <SubControlRow>
            <SubControlLabel>Speed</SubControlLabel>
            <ToggleGroup
              type="single"
              aria-label="Visualizer speed"
              value={String(backgroundVisualizerSpeed)}
              onValueChange={(v) => v && setBackgroundVisualizerSpeed(Number(v))}
            >
              {SPEED_OPTIONS.map((opt) => (
                <ToggleGroupItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SubControlRow>
        </>
      )}
    </ControlBlock>
  );
};

VisualizerStylePicker.displayName = 'SettingsV2.VisualizerStylePicker';
