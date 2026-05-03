import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pipette } from 'lucide-react';

import { useColorContext } from '@/contexts/ColorContext';
import { useCurrentTrackContext } from '@/contexts/TrackContext';
import { extractTopVibrantColors, type ExtractedColor } from '@/utils/colorExtractor';
import EyedropperOverlay from '@/components/EyedropperOverlay';
import { Button } from '@/components/ui/button';

import {
  ControlBlock,
  ControlHelp,
  SectionGroupTitle,
  SubControlRow,
  SubControlLabel,
  SwatchRow,
  SwatchButton,
  SwatchIconButton,
} from '../AppearanceSection.styled';

/**
 * Mirrors the dual-key write contract used by
 * `PlayerContent/AlbumArtSection.handleCustomAccentColor` (writes BOTH
 * `ACCENT_COLOR_OVERRIDES` AND `CUSTOM_ACCENT_COLORS`) and
 * `handleAccentColorChange` (intercepts the `'RESET_TO_DEFAULT'` sentinel).
 *
 * The eyedropper picks must dual-write so the chrome's "custom" swatch
 * (`controls/QuickEffectsRow`) keeps rendering. Palette swatches single-write
 * to `ACCENT_COLOR_OVERRIDES` (matches legacy behaviour — palette clicks
 * never overwrite the eyedropper-picked custom swatch).
 */
const RESET_SENTINEL = 'RESET_TO_DEFAULT' as const;

export const AccentColorManager: React.FC = () => {
  const { currentTrack } = useCurrentTrackContext();
  const {
    accentColor,
    customAccentColors,
    setAccentColor,
    handleSetAccentColorOverride,
    handleRemoveAccentColorOverride,
    handleResetAccentColorOverride,
    handleSetCustomAccentColor,
    handleRemoveCustomAccentColor,
  } = useColorContext();

  const [colorOptions, setColorOptions] = useState<ExtractedColor[]>([]);
  const [showEyedropper, setShowEyedropper] = useState(false);

  const albumId = currentTrack?.albumId;
  const customColor = albumId ? customAccentColors[albumId] : undefined;

  useEffect(() => {
    if (currentTrack?.image) {
      let cancelled = false;
      extractTopVibrantColors(currentTrack.image, 2).then((colors) => {
        if (!cancelled) setColorOptions(colors);
      });
      return () => {
        cancelled = true;
      };
    }
    setColorOptions([]);
    return undefined;
  }, [currentTrack?.image]);

  const applyAccentColor = useCallback(
    (color: string) => {
      if (!albumId) return;
      handleSetAccentColorOverride(albumId, color);
      setAccentColor(color);
    },
    [albumId, handleSetAccentColorOverride, setAccentColor],
  );

  const applyCustomAccentColor = useCallback(
    (color: string) => {
      if (!albumId) return;
      if (color === '') {
        handleRemoveAccentColorOverride(albumId);
        handleRemoveCustomAccentColor(albumId);
        return;
      }
      handleSetAccentColorOverride(albumId, color);
      handleSetCustomAccentColor(albumId, color);
      setAccentColor(color);
    },
    [
      albumId,
      handleSetAccentColorOverride,
      handleRemoveAccentColorOverride,
      handleSetCustomAccentColor,
      handleRemoveCustomAccentColor,
      setAccentColor,
    ],
  );

  const handleReset = useCallback(() => {
    if (!albumId) return;
    applyCustomAccentColor('');
    handleResetAccentColorOverride(albumId);
  }, [albumId, applyCustomAccentColor, handleResetAccentColorOverride]);

  const handleEyedropperPick = useCallback(
    (color: string) => {
      applyCustomAccentColor(color);
      setShowEyedropper(false);
    },
    [applyCustomAccentColor],
  );

  const noTrack = !currentTrack || !albumId;

  return (
    <ControlBlock>
      <SectionGroupTitle>Accent Color</SectionGroupTitle>
      <ControlHelp>
        Override the per-album accent color. Pick from the album-art palette, sample any pixel with the eyedropper,
        or reset to the auto-extracted color.
      </ControlHelp>
      <SubControlRow>
        <SubControlLabel>Color</SubControlLabel>
        <SwatchRow>
          {colorOptions.map((color) => (
            <SwatchButton
              key={color.hex}
              type="button"
              $color={color.hex}
              $isActive={color.hex === accentColor}
              onClick={() => applyAccentColor(color.hex)}
              title={color.hex}
              aria-label={`Choose color ${color.hex}`}
            />
          ))}
          {customColor && (
            <SwatchButton
              type="button"
              $color={customColor}
              $isActive={customColor === accentColor}
              onClick={() => applyAccentColor(customColor)}
              title="Custom color"
              aria-label="Use custom color"
            />
          )}
          <SwatchIconButton
            type="button"
            onClick={() => setShowEyedropper(true)}
            disabled={!currentTrack?.image}
            title="Pick color from album art"
            aria-label="Pick color from album art"
          >
            <Pipette aria-hidden="true" />
          </SwatchIconButton>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={noTrack}
            aria-label="Reset accent color to default"
          >
            Reset
          </Button>
        </SwatchRow>
      </SubControlRow>
      {noTrack && <ControlHelp>Start playing a track to override its accent color.</ControlHelp>}

      {showEyedropper &&
        currentTrack?.image &&
        createPortal(
          <EyedropperOverlay
            image={currentTrack.image}
            onPick={handleEyedropperPick}
            onClose={() => setShowEyedropper(false)}
          />,
          document.body,
        )}
    </ControlBlock>
  );
};

AccentColorManager.displayName = 'SettingsV2.AccentColorManager';

export { RESET_SENTINEL };
export default AccentColorManager;
