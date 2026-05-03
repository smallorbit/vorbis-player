import React, { useCallback } from 'react';

import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useVolume } from '@/hooks/useVolume';

import {
  Container,
  ControlBlock,
  ControlRow,
  ControlLabelText,
  ControlHelp,
  SectionGroupTitle,
  Divider,
  SliderRow,
  SliderValue,
} from './PlaybackSection.styled';

/**
 * SettingsV2 Playback section — phase 4 (#1452).
 *
 * Inventory note: the legacy `AppSettingsMenu` exposes zero playback-specific
 * controls. The genuinely user-facing playback preferences are:
 *
 *   - Default volume — `STORAGE_KEYS.VOLUME` (`useVolume()`). The chrome
 *     `controls/VolumeControl` slider already writes this; the settings UI
 *     is a second view onto the same hook + storage key.
 *   - Default shuffle — `STORAGE_KEYS.SHUFFLE_ENABLED` via
 *     `TrackContext.handleShuffleToggle`. Routing through the context keeps
 *     the live queue reorder behaviour identical to toggling from BottomBar.
 *
 * No crossfade, no gapless, no auto-advance preference exists today
 * (`useAutoAdvance` is hardcoded `enabled: true` at `usePlayerLogic.ts:167`).
 * The build matches reality.
 *
 * Neutral chrome only — no `var(--accent-color)` references; the `Switch`
 * uses `variant="neutral"` and the `Slider` uses default shadcn `--primary`.
 */

const VolumeBlock: React.FC = () => {
  const { currentTrack } = useCurrentTrackContext();
  const { volume, setVolumeLevel } = useVolume(currentTrack?.provider);

  const handleVolumeChange = useCallback(
    (values: number[]) => {
      const next = values[0];
      if (typeof next === 'number') {
        setVolumeLevel(next);
      }
    },
    [setVolumeLevel],
  );

  return (
    <ControlBlock>
      <SectionGroupTitle>Volume</SectionGroupTitle>
      <ControlRow>
        <div>
          <ControlLabelText htmlFor="settings-v2-volume-slider">Default volume</ControlLabelText>
          <ControlHelp>Persisted across sessions and applied to the active player.</ControlHelp>
        </div>
        <SliderValue aria-live="polite">{volume}%</SliderValue>
      </ControlRow>
      <SliderRow>
        <Slider
          id="settings-v2-volume-slider"
          value={[volume]}
          min={0}
          max={100}
          step={1}
          onValueChange={handleVolumeChange}
          aria-label="Default volume"
        />
      </SliderRow>
    </ControlBlock>
  );
};

VolumeBlock.displayName = 'SettingsV2.PlaybackSection.VolumeBlock';

const ShuffleBlock: React.FC = () => {
  const { shuffleEnabled, handleShuffleToggle, originalTracks } = useTrackListContext();

  const canToggle = originalTracks.length > 0;

  return (
    <ControlBlock>
      <SectionGroupTitle>Shuffle</SectionGroupTitle>
      <ControlRow>
        <div>
          <ControlLabelText htmlFor="settings-v2-shuffle-toggle">Shuffle queue</ControlLabelText>
          <ControlHelp>
            {canToggle
              ? 'Reorder the current queue and remember the preference for next time.'
              : 'Load a playlist or album to enable shuffle.'}
          </ControlHelp>
        </div>
        <Switch
          id="settings-v2-shuffle-toggle"
          checked={shuffleEnabled}
          onCheckedChange={() => handleShuffleToggle()}
          disabled={!canToggle}
          aria-label="Toggle shuffle"
          variant="neutral"
        />
      </ControlRow>
    </ControlBlock>
  );
};

ShuffleBlock.displayName = 'SettingsV2.PlaybackSection.ShuffleBlock';

export const PlaybackSection: React.FC = () => {
  return (
    <Container>
      <VolumeBlock />
      <Divider />
      <ShuffleBlock />
    </Container>
  );
};

PlaybackSection.displayName = 'SettingsV2.PlaybackSection';

export default PlaybackSection;
