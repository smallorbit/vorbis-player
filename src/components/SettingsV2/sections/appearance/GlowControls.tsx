import React, { useCallback } from 'react';

import { useVisualEffectsToggle, useGlow } from '@/contexts/visualEffects';
import { useVisualEffectsState } from '@/hooks/useVisualEffectsState';
import { useCurrentTrackContext } from '@/contexts/TrackContext';
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
  AlbumOverrideLabel,
  AlbumOverrideLabelText,
  OverrideMarker,
  OverrideOptionGroups,
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

const ALBUM_FALLBACK_LABEL = 'This album';

/**
 * SettingsV2 glow controls — phase 3 port (#1451).
 *
 * Routes through `useVisualEffectsToggle` (writes `VISUAL_EFFECTS_ENABLED`)
 * and `useVisualEffectsState` (writes `GLOW_INTENSITY` + `GLOW_RATE`),
 * matching the hook + storage-key contract used by
 * `controls/QuickEffectsRow` so toggling in either surface reflects in
 * the other.
 *
 * Adds a conditional "Album override" sub-row (#1522) that writes per-album
 * intensity/rate via `useGlow` (`PER_ALBUM_GLOW` storage key) when a track
 * with an `albumId` is playing and visual effects are enabled.
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
  const { currentTrack } = useCurrentTrackContext();
  const { perAlbumGlow, setPerAlbumGlow } = useGlow();

  const albumId = currentTrack?.albumId;
  const override = albumId ? perAlbumGlow[albumId] : undefined;
  const hasOverride = albumId !== undefined && albumId in perAlbumGlow;
  const effective = override ?? { intensity: glowIntensity, rate: glowRate };

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

  const handleOverrideIntensity = useCallback(
    (intensity: number) => {
      if (!albumId) return;
      setPerAlbumGlow((prev) => ({
        ...prev,
        [albumId]: { intensity, rate: effective.rate },
      }));
    },
    [albumId, effective.rate, setPerAlbumGlow],
  );

  const handleOverrideRate = useCallback(
    (rate: number) => {
      if (!albumId) return;
      setPerAlbumGlow((prev) => ({
        ...prev,
        [albumId]: { intensity: effective.intensity, rate },
      }));
    },
    [albumId, effective.intensity, setPerAlbumGlow],
  );

  const handleResetOverride = useCallback(() => {
    if (!albumId) return;
    setPerAlbumGlow((prev) => {
      const next = { ...prev };
      delete next[albumId];
      return next;
    });
  }, [albumId, setPerAlbumGlow]);

  const albumLabel = currentTrack?.album || ALBUM_FALLBACK_LABEL;

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
            <OptionButtonGroup aria-label="Glow intensity">
              {INTENSITY_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt.value}
                  type="button"
                  $isActive={glowIntensity === opt.value}
                  onClick={() => handleGlowIntensityChange(opt.value)}
                >
                  {opt.label}
                </OptionButton>
              ))}
            </OptionButtonGroup>
          </SubControlRow>

          <SubControlRow>
            <SubControlLabel>Rate</SubControlLabel>
            <OptionButtonGroup aria-label="Glow rate">
              {RATE_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt.value}
                  type="button"
                  $isActive={glowRate === opt.value}
                  onClick={() => handleGlowRateChange(opt.value)}
                >
                  {opt.label}
                </OptionButton>
              ))}
            </OptionButtonGroup>
          </SubControlRow>

          {albumId && (
            <SubControlRow data-testid="album-override-row">
              <AlbumOverrideLabel>
                {hasOverride && <OverrideMarker data-testid="album-override-marker" aria-hidden="true" />}
                <AlbumOverrideLabelText>{albumLabel}</AlbumOverrideLabelText>
              </AlbumOverrideLabel>
              <OverrideOptionGroups>
                <OptionButtonGroup aria-label="Album glow intensity">
                  {INTENSITY_OPTIONS.map((opt) => (
                    <OptionButton
                      key={opt.value}
                      type="button"
                      $isActive={effective.intensity === opt.value}
                      onClick={() => handleOverrideIntensity(opt.value)}
                    >
                      {opt.label}
                    </OptionButton>
                  ))}
                </OptionButtonGroup>
                <OptionButtonGroup aria-label="Album glow rate">
                  {RATE_OPTIONS.map((opt) => (
                    <OptionButton
                      key={opt.value}
                      type="button"
                      $isActive={effective.rate === opt.value}
                      onClick={() => handleOverrideRate(opt.value)}
                    >
                      {opt.label}
                    </OptionButton>
                  ))}
                  <OptionButton
                    type="button"
                    $isActive={false}
                    disabled={!hasOverride}
                    onClick={handleResetOverride}
                    aria-label="Reset album glow override"
                  >
                    Reset
                  </OptionButton>
                </OptionButtonGroup>
              </OverrideOptionGroups>
            </SubControlRow>
          )}
        </>
      )}
    </ControlBlock>
  );
};

GlowControls.displayName = 'SettingsV2.GlowControls';

export default GlowControls;
