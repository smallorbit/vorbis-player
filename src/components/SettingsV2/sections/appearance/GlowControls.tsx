import React, { useCallback } from 'react';

import { useVisualEffectsToggle } from '@/contexts/visualEffects';
import { useVisualEffectsState } from '@/hooks/useVisualEffectsState';
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

const INTENSITY_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 95, label: 'Less' },
  { value: 110, label: 'Normal' },
  { value: 125, label: 'More' },
] as const;

const RATE_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 5.0, label: 'Slower' },
  { value: 4.0, label: 'Normal' },
  { value: 3.0, label: 'Faster' },
] as const;

/**
 * SettingsV2 glow controls — phase 3 port (#1451).
 *
 * Routes through `useVisualEffectsToggle` (writes `VISUAL_EFFECTS_ENABLED`)
 * and `useVisualEffectsState` (writes `GLOW_INTENSITY` + `GLOW_RATE`),
 * matching the hook + storage-key contract used by
 * `controls/QuickEffectsRow` so toggling in either surface reflects in
 * the other.
 */
export const GlowControls: React.FC = () => {
  const { visualEffectsEnabled, setVisualEffectsEnabled } = useVisualEffectsToggle();
  const {
    glowIntensity,
    glowRate,
    handleGlowIntensityChange,
    handleGlowRateChange,
    restoreGlowSettings,
  } = useVisualEffectsState();

  const handleToggle = useCallback(
    (checked: boolean) => {
      if (checked) {
        setVisualEffectsEnabled(true);
        restoreGlowSettings();
      } else {
        setVisualEffectsEnabled(false);
      }
    },
    [setVisualEffectsEnabled, restoreGlowSettings],
  );

  return (
    <ControlBlock>
      <SectionGroupTitle>Glow</SectionGroupTitle>
      <ControlRow>
        <div>
          <ControlLabelText htmlFor="settings-v2-glow-toggle">Album-art glow</ControlLabelText>
          <ControlHelp>Pulse a soft halo behind the album art.</ControlHelp>
        </div>
        <Switch
          id="settings-v2-glow-toggle"
          checked={visualEffectsEnabled}
          onCheckedChange={handleToggle}
          aria-label="Toggle album-art glow"
          variant="neutral"
        />
      </ControlRow>

      {visualEffectsEnabled && (
        <>
          <SubControlRow>
            <SubControlLabel>Intensity</SubControlLabel>
            <ToggleGroup
              type="single"
              aria-label="Glow intensity"
              value={String(glowIntensity)}
              onValueChange={(v) => v && handleGlowIntensityChange(Number(v))}
            >
              {INTENSITY_OPTIONS.map((opt) => (
                <ToggleGroupItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SubControlRow>

          <SubControlRow>
            <SubControlLabel>Rate</SubControlLabel>
            <ToggleGroup
              type="single"
              aria-label="Glow rate"
              value={String(glowRate)}
              onValueChange={(v) => v && handleGlowRateChange(Number(v))}
            >
              {RATE_OPTIONS.map((opt) => (
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

GlowControls.displayName = 'SettingsV2.GlowControls';
