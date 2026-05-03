import React, { useCallback } from 'react';

import { useTranslucence } from '@/contexts/visualEffects';
import { Switch } from '@/components/ui/switch';

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
  Divider,
} from './AppearanceSection.styled';

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
 *   - Translucence on/off          → `TranslucenceContext`
 *     (`TRANSLUCENCE_ENABLED`). Opacity slider is intentionally omitted —
 *     `TRANSLUCENCE_OPACITY` has no v1 UI today and is deferred to #1463.
 *
 * v2 chrome stays neutral (`hsl(var(--*))` only) — the player-chrome accent
 * variant lives in `controls/QuickEffectsRow` and is intentionally not
 * mirrored here.
 */
const TranslucenceToggle: React.FC = () => {
  const { translucenceEnabled, setTranslucenceEnabled } = useTranslucence();

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
