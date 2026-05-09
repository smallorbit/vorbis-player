import React, { useCallback } from 'react';

import { useAccentColorBackground } from '@/contexts/visualEffects';
import { Switch } from '@/components/ui/switch';

import {
  ControlBlock,
  ControlRow,
  ControlLabelText,
  ControlHelp,
  SectionGroupTitle,
} from '../AppearanceSection.styled';

/**
 * SettingsV2 accent-color-background toggle — phase 3 follow-up (#1463).
 *
 * Persists `ACCENT_COLOR_BG_PREFERRED` independently of the master
 * `visualEffectsEnabled` flag. The storage key is a preference, not a live
 * render flag — `AccentColorBackgroundContext.accentColorBackgroundEnabled`
 * derives the live flag as `visualEffectsEnabled && preferred`, so the
 * Switch stays toggleable when glow is off and the gradient simply waits
 * for glow to come back on. The help text alone communicates the
 * dependency.
 */
export const AccentColorBackgroundToggle: React.FC = () => {
  const { accentColorBackgroundPreferred, setAccentColorBackgroundPreferred } = useAccentColorBackground();

  const handleToggle = useCallback(
    (checked: boolean) => {
      setAccentColorBackgroundPreferred(checked);
    },
    [setAccentColorBackgroundPreferred],
  );

  return (
    <ControlBlock>
      <SectionGroupTitle>Background gradient</SectionGroupTitle>
      <ControlRow>
        <div>
          <ControlLabelText htmlFor="settings-v2-accent-color-bg-toggle">Accent-color background</ControlLabelText>
          <ControlHelp>Tint the page background with the current accent color. Visible when album-art glow is on.</ControlHelp>
        </div>
        <Switch
          id="settings-v2-accent-color-bg-toggle"
          checked={accentColorBackgroundPreferred}
          onCheckedChange={handleToggle}
          aria-label="Toggle accent-color background"
          variant="neutral"
        />
      </ControlRow>
    </ControlBlock>
  );
};

AccentColorBackgroundToggle.displayName = 'SettingsV2.AccentColorBackgroundToggle';

export default AccentColorBackgroundToggle;
