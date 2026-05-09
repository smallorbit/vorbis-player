import React, { useCallback } from 'react';

import { useTranslucence } from '@/contexts/visualEffects';
import { Switch } from '@/components/ui/switch';
import { OptionButton, OptionButtonGroup } from '@/components/AppSettingsMenu/styled';

import { AccentColorManager } from './appearance/AccentColorManager';
import { GlowControls } from './appearance/GlowControls';
import { VisualizerStylePicker } from './appearance/VisualizerStylePicker';
import {
  Container,
  ControlBlock,
  ControlRow,
  ControlLabelText,
  ControlHelp,
  SectionGroupTitle,
  SubControlRow,
  SubControlLabel,
  Divider,
} from './AppearanceSection.styled';

const OPACITY_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0.6, label: 'Subtle' },
  { value: 0.8, label: 'Default' },
  { value: 0.95, label: 'Strong' },
] as const;

/**
 * SettingsV2 Appearance section — phase 3 port (#1451).
 *
 * Composes the four appearance control groups, each routed through the same
 * hook + storage-key contract as the legacy `controls/QuickEffectsRow`:
 *
 *   - {@link AccentColorManager}  → `ColorContext` (`ACCENT_COLOR_OVERRIDES` +
 *     `CUSTOM_ACCENT_COLORS`; preserves the dual-key write rule + the
 *     `'RESET_TO_DEFAULT'` sentinel verbatim).
 *   - {@link GlowControls}        → `useVisualEffectsToggle` +
 *     `useVisualEffectsState` (`VISUAL_EFFECTS_ENABLED` + `GLOW_INTENSITY` +
 *     `GLOW_RATE`).
 *   - {@link VisualizerStylePicker} → `VisualizerContext` (`BG_VISUALIZER_*`).
 *   - Translucence on/off + opacity → `TranslucenceContext`
 *     (`TRANSLUCENCE_ENABLED` + `TRANSLUCENCE_OPACITY`). The opacity preset
 *     (Subtle / Default / Strong) is revealed only when translucence is on.
 *
 * v2 chrome stays neutral (`hsl(var(--*))` only) — the player-chrome accent
 * variant lives in `controls/QuickEffectsRow` and is intentionally not
 * mirrored here.
 */
const TranslucenceToggle: React.FC = () => {
  const {
    translucenceEnabled,
    setTranslucenceEnabled,
    translucenceOpacity,
    setTranslucenceOpacity,
  } = useTranslucence();

  const handleToggle = useCallback(
    (checked: boolean) => {
      setTranslucenceEnabled(checked);
    },
    [setTranslucenceEnabled],
  );

  return (
    <ControlBlock>
      <SectionGroupTitle>Translucence</SectionGroupTitle>
      <ControlRow>
        <div>
          <ControlLabelText htmlFor="settings-v2-translucence-toggle">Translucent surfaces</ControlLabelText>
          <ControlHelp>Apply a frosted-glass effect to layered panels.</ControlHelp>
        </div>
        <Switch
          id="settings-v2-translucence-toggle"
          checked={translucenceEnabled}
          onCheckedChange={handleToggle}
          aria-label="Toggle translucence"
          variant="neutral"
        />
      </ControlRow>

      {translucenceEnabled && (
        <SubControlRow>
          <SubControlLabel>Opacity</SubControlLabel>
          <OptionButtonGroup aria-label="Translucence opacity">
            {OPACITY_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.value}
                type="button"
                $isActive={translucenceOpacity === opt.value}
                onClick={() => setTranslucenceOpacity(opt.value)}
              >
                {opt.label}
              </OptionButton>
            ))}
          </OptionButtonGroup>
        </SubControlRow>
      )}
    </ControlBlock>
  );
};

TranslucenceToggle.displayName = 'SettingsV2.TranslucenceToggle';

export const AppearanceSection: React.FC = () => {
  return (
    <Container>
      <AccentColorManager />
      <Divider />
      <GlowControls />
      <Divider />
      <VisualizerStylePicker />
      <Divider />
      <TranslucenceToggle />
    </Container>
  );
};

AppearanceSection.displayName = 'SettingsV2.AppearanceSection';

export default AppearanceSection;
