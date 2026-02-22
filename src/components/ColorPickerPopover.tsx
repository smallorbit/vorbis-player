import { useState, useEffect, useRef, useLayoutEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import EyedropperOverlay from './EyedropperOverlay';
import { extractTopVibrantColors } from '../utils/colorExtractor';
import type { ExtractedColor } from '../utils/colorExtractor';
import type { Track } from '../services/spotify';
import { theme } from '../styles/theme';
import { ControlButton } from './controls/styled';
import { ColorPickerIcon } from './icons/QuickActionIcons';

interface ColorPickerPopoverProps {
  accentColor: string;
  currentTrack: Track | null;
  onAccentColorChange?: (color: string) => void;
  customAccentColorOverrides: Record<string, string>;
  onCustomAccentColor: (color: string) => void;
  $isMobile?: boolean;
  $isTablet?: boolean;
  $compact?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

// Custom comparison function for ColorPickerPopover memo optimization
const areColorPickerPropsEqual = (
  prevProps: ColorPickerPopoverProps,
  nextProps: ColorPickerPopoverProps
): boolean => {
  // Check if album changed (accent colors are per-album)
  if (prevProps.currentTrack?.album_id !== nextProps.currentTrack?.album_id) {
    return false;
  }

  // Check accent color
  if (prevProps.accentColor !== nextProps.accentColor) {
    return false;
  }

  // Check responsive sizing
  if (prevProps.$isMobile !== nextProps.$isMobile) {
    return false;
  }

  if (prevProps.$isTablet !== nextProps.$isTablet) {
    return false;
  }

  // Check if custom overrides for current album changed
  const currentAlbumId = prevProps.currentTrack?.album_id;
  if (currentAlbumId) {
    if (prevProps.customAccentColorOverrides[currentAlbumId] !==
      nextProps.customAccentColorOverrides[currentAlbumId]) {
      return false;
    }
  }

  // For callbacks, we assume they're stable (parent should use useCallback)
  return true;
};

const ColorPickerPopover = memo<ColorPickerPopoverProps>(({
  accentColor,
  currentTrack,
  onAccentColorChange,
  customAccentColorOverrides,
  onCustomAccentColor,
  $isMobile = false,
  $isTablet = false,
  $compact,
  onOpenChange
}) => {
  const [colorOptions, setColorOptions] = useState<ExtractedColor[] | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const [showEyedropper, setShowEyedropper] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const paletteBtnRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);

  const lastCustomColor = currentTrack?.album_id
    ? customAccentColorOverrides[currentTrack.album_id]
    : null;

  // Extract colors when popover opens or track changes
  useEffect(() => {
    if (showColorPopover && currentTrack?.image) {
      console.log('[AccentColor] Extracting from image:', currentTrack.image);
      setIsExtracting(true);
      setExtractError(null);
      setColorOptions(null);
      extractTopVibrantColors(currentTrack.image, 2)
        .then(colors => {
          console.log('[AccentColor] Extracted colors:', colors);
          setColorOptions(colors);
          setIsExtracting(false);
        })
        .catch(err => {
          console.error('[AccentColor] Extraction error:', err);
          setExtractError('Failed to extract colors');
          setIsExtracting(false);
        });
    } else if (showColorPopover) {
      console.log('[AccentColor] No image found for current track:', currentTrack);
    }
  }, [showColorPopover, currentTrack?.image, currentTrack]);

  // Close popover on outside click
  useEffect(() => {
    if (!showColorPopover) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        paletteBtnRef.current &&
        !paletteBtnRef.current.contains(e.target as Node)
      ) {
        setShowColorPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showColorPopover]);

  // When popover opens, calculate position
  useLayoutEffect(() => {
    if (showColorPopover && paletteBtnRef.current) {
      const rect = paletteBtnRef.current.getBoundingClientRect();
      setPopoverPos({
        left: rect.left + rect.width * 1.5,
        top: rect.top - 12, // 12px gap above button
      });
    }
  }, [showColorPopover]);

  useEffect(() => {
    onOpenChange?.(showColorPopover);
  }, [showColorPopover, onOpenChange]);

  return (
    <>
      <ControlButton
        accentColor={accentColor}
        onClick={() => setShowColorPopover(v => !v)}
        title="Theme options"
        ref={paletteBtnRef}
        $isMobile={$isMobile}
        $isTablet={$isTablet}
        $compact={$compact}
      >
        <ColorPickerIcon />
      </ControlButton>

      {/* Popover menu rendered in portal */}
      {showColorPopover && popoverPos && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            left: popoverPos.left,
            top: popoverPos.top,
            transform: 'translate(-50%, -100%)',
            background: theme.colors.popover.background,
            borderRadius: theme.borderRadius.xl,
            boxShadow: theme.shadows.popover,
            padding: `${theme.spacing.md} ${theme.spacing.lg}`,
            zIndex: theme.zIndex.popover,
            minWidth: 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <div style={{ color: theme.colors.white, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.sm, fontSize: theme.fontSize.lg }}>
            Choose Accent Color
          </div>
          {isExtracting && <p style={{ color: theme.colors.gray[500], fontSize: theme.fontSize.sm }}>Extracting colors...</p>}
          {extractError && <p style={{ color: theme.colors.error, fontSize: theme.fontSize.sm }}>{extractError}</p>}
          {!isExtracting && !extractError && (
            <div style={{ display: 'flex', gap: theme.spacing.md }}>
              {(colorOptions ?? []).map((color) => (
                <button
                  key={color.hex}
                  onClick={() => {
                    onAccentColorChange?.(color.hex);
                    setShowColorPopover(false);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '10%',
                    border: color.hex === accentColor ? `3px solid ${theme.colors.white}` : `2px solid ${theme.colors.gray[500]}`,
                    background: color.hex,
                    cursor: 'pointer',
                    outline: color.hex === accentColor ? `2px solid ${theme.colors.selection}` : 'none',
                    boxShadow: color.hex === accentColor ? `0 0 0 2px ${theme.colors.selection}` : 'none',
                    transition: `box-shadow ${theme.transitions.fast}, border ${theme.transitions.fast}`,
                  }}
                  title={color.hex}
                  aria-label={`Choose color ${color.hex}`}
                />
              ))}
              {/* Custom color swatch - only shown when user has picked a custom color for this album */}
              {lastCustomColor && (
                <button
                  onClick={() => {
                    onAccentColorChange?.(lastCustomColor);
                    setShowColorPopover(false);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '10%',
                    border: lastCustomColor === accentColor ? `3px solid ${theme.colors.white}` : `2px solid ${theme.colors.gray[500]}`,
                    background: lastCustomColor,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: `box-shadow ${theme.transitions.fast}, border ${theme.transitions.fast}`,
                    outline: lastCustomColor === accentColor ? `2px solid ${theme.colors.selection}` : 'none',
                    boxShadow: lastCustomColor === accentColor ? `0 0 0 2px ${theme.colors.selection}` : 'none',
                  }}
                  title="Use custom color"
                  aria-label="Use custom color"
                />
              )}
              {/* Always show eyedropper button if album art is available */}
              {currentTrack?.image && (
                <button
                  onClick={() => setShowEyedropper(true)}
                  title="Pick color from album art"
                  aria-label="Pick color from album art"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '10%',
                    border: `2px solid ${theme.colors.gray[500]}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: `box-shadow ${theme.transitions.fast}, border ${theme.transitions.fast}`,
                    color: theme.colors.white,
                    background: 'transparent',
                    padding: 0,
                  }}
                >
                  <ColorPickerIcon />
                </button>
              )}
            </div>
          )}
          {/* Reset button */}
          <button
            onClick={() => {
              if (currentTrack?.album_id) {
                onCustomAccentColor('');
                onAccentColorChange?.('RESET_TO_DEFAULT');
              }
              setShowColorPopover(false);
            }}
            style={{
              marginTop: theme.spacing.sm,
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              background: theme.colors.control.background,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              color: theme.colors.white,
              fontSize: theme.fontSize.xs,
              cursor: 'pointer',
              transition: `all ${theme.transitions.fast} ease`,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = theme.colors.control.backgroundHover;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = theme.colors.control.background;
            }}
            title="Reset to default color"
          >
            Reset to Default
          </button>
        </div>,
        document.body
      )}

      {/* Eyedropper overlay */}
      {showEyedropper && currentTrack?.image && (
        createPortal(
          <EyedropperOverlay
            image={currentTrack.image}
            onPick={onCustomAccentColor}
            onClose={() => setShowEyedropper(false)}
          />,
          document.body
        )
      )}
    </>
  );
}, areColorPickerPropsEqual);

ColorPickerPopover.displayName = 'ColorPickerPopover';

export default ColorPickerPopover;