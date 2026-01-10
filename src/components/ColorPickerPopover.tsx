import { useState, useEffect, useRef, useLayoutEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import EyedropperOverlay from './EyedropperOverlay';
import { extractTopVibrantColors } from '../utils/colorExtractor';
import type { ExtractedColor } from '../utils/colorExtractor';
import type { Track } from '../services/spotify';
import { theme } from '../styles/theme';
import { getContrastColor } from '../utils/colorUtils';

const ControlButton = styled.button.withConfig({
  shouldForwardProp: (prop) => !['isActive', 'accentColor', '$isMobile', '$isTablet'].includes(prop),
}) <{ isActive?: boolean; accentColor: string; $isMobile?: boolean; $isTablet?: boolean }>`
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return theme.spacing.xs;
    if ($isTablet) return theme.spacing.sm;
    return theme.spacing.sm;
  }};
  border-radius: ${({ $isMobile, $isTablet }) => {
    if ($isMobile) return theme.borderRadius.sm;
    if ($isTablet) return theme.borderRadius.md;
    return theme.borderRadius.md;
  }};

  svg {
    width: ${({ $isMobile, $isTablet }) => {
      if ($isMobile) return '1.25rem';
      if ($isTablet) return '1.375rem';
      return '1.5rem';
    }};
    height: ${({ $isMobile, $isTablet }) => {
      if ($isMobile) return '1.25rem';
      if ($isTablet) return '1.375rem';
      return '1.5rem';
    }};
    fill: currentColor;
  }

  ${({ isActive, accentColor }: { isActive?: boolean; accentColor: string }) => isActive ? `
    background: ${accentColor};
    color: ${getContrastColor(accentColor)};

    &:hover {
      background: ${accentColor}4D;
      color: ${getContrastColor(accentColor)};
      transform: translateY(-1px);
    }
  ` : `
    background: ${theme.colors.control.background};
    color: ${theme.colors.white};

    &:hover {
      background: ${theme.colors.control.backgroundHover};
      color: ${theme.colors.white};
      transform: translateY(-1px);
    }
  `}
`;

interface ColorPickerPopoverProps {
  accentColor: string;
  currentTrack: Track | null;
  onAccentColorChange?: (color: string) => void;
  customAccentColorOverrides: Record<string, string>;
  onCustomAccentColor: (color: string) => void;
  $isMobile?: boolean;
  $isTablet?: boolean;
}

// Custom comparison function for ColorPickerPopover memo optimization
const areColorPickerPropsEqual = (
  prevProps: ColorPickerPopoverProps,
  nextProps: ColorPickerPopoverProps
): boolean => {
  // Check if track changed (most important check)
  if (prevProps.currentTrack?.id !== nextProps.currentTrack?.id) {
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

  // Check if custom overrides for current track changed
  const currentTrackId = prevProps.currentTrack?.id;
  if (currentTrackId) {
    if (prevProps.customAccentColorOverrides[currentTrackId] !==
      nextProps.customAccentColorOverrides[currentTrackId]) {
      return false;
    }
  }

  // For callbacks, we assume they're stable (parent should use useCallback)
  return true;
};

export const ColorPickerPopover = memo<ColorPickerPopoverProps>(({
  accentColor,
  currentTrack,
  onAccentColorChange,
  customAccentColorOverrides,
  onCustomAccentColor,
  $isMobile = false,
  $isTablet = false
}) => {
  const [colorOptions, setColorOptions] = useState<ExtractedColor[] | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const [showEyedropper, setShowEyedropper] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const paletteBtnRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);

  // Get the last chosen custom color for the current track
  const getLastCustomColor = () => {
    return currentTrack?.id ? customAccentColorOverrides[currentTrack.id] : null;
  };

  // Extract colors when popover opens or track changes
  useEffect(() => {
    if (showColorPopover && currentTrack?.image) {
      console.log('[AccentColor] Extracting from image:', currentTrack.image);
      setIsExtracting(true);
      setExtractError(null);
      setColorOptions(null);
      extractTopVibrantColors(currentTrack.image, 3)
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

  return (
    <>
      <ControlButton
        accentColor={accentColor}
        onClick={() => setShowColorPopover(v => !v)}
        title="Theme options"
        ref={paletteBtnRef}
        $isMobile={$isMobile}
        $isTablet={$isTablet}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
          <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
          <path d="M14.5 17.5 4.5 15" />
        </svg>
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
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            padding: `${theme.spacing.md} ${theme.spacing.lg}`,
            zIndex: theme.zIndex.popover,
            minWidth: 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: 8, fontSize: 15 }}>
            Choose Accent Color
          </div>
          {isExtracting && <p style={{ color: '#888', fontSize: 14 }}>Extracting colors...</p>}
          {extractError && <p style={{ color: 'red', fontSize: 14 }}>{extractError}</p>}
          {!isExtracting && !extractError && (
            <div style={{ display: 'flex', gap: 12 }}>
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
                    border: color.hex === accentColor ? '3px solid #fff' : '2px solid #888',
                    background: color.hex,
                    cursor: 'pointer',
                    outline: color.hex === accentColor ? '2px solid #ffd700' : 'none',
                    boxShadow: color.hex === accentColor ? '0 0 0 2px #ffd700' : 'none',
                    transition: 'box-shadow 0.2s, border 0.2s',
                  }}
                  title={color.hex}
                  aria-label={`Choose color ${color.hex}`}
                />
              ))}
              {/* Custom color button - uses last chosen custom color for this track */}
              <button
                onClick={() => {
                  const lastCustomColor = getLastCustomColor();
                  if (lastCustomColor) {
                    onAccentColorChange?.(lastCustomColor);
                    setShowColorPopover(false);
                  }
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '10%',
                  border: '2px solid #888',
                  background: getLastCustomColor() || '#181818',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'box-shadow 0.2s, border 0.2s',
                  opacity: getLastCustomColor() ? 1 : 0.5,
                  color: getLastCustomColor() ? '#fff' : '#aaa',
                }}
                title="Use custom color"
                aria-label="Use custom color"
                disabled={!getLastCustomColor()}
              >
              </button>
              {/* Always show eyedropper button if album art is available */}
              {currentTrack?.image && (
                <ControlButton
                  accentColor={accentColor}
                  onClick={() => setShowEyedropper(true)}
                  title="Pick color from album art"
                  aria-label="Pick color from album art"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '10%',
                    border: '2px solid #888',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'box-shadow 0.2s, border 0.2s',
                    color: '#fff',
                  }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
                    <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
                    <path d="M14.5 17.5 4.5 15" />
                  </svg>
                </ControlButton>
              )}
            </div>
          )}
          {/* Reset button */}
          <button
            onClick={() => {
              if (currentTrack?.id) {
                // Remove custom color override for this track
                const newOverrides = { ...customAccentColorOverrides };
                delete newOverrides[currentTrack.id];
                onCustomAccentColor(''); // This will trigger a re-extraction

                // We need to call the parent's reset function to force color re-extraction
                // Since we don't have direct access to it, we'll use a placeholder color
                // and let the parent component handle the reset
                onAccentColorChange?.('RESET_TO_DEFAULT');
              }
              setShowColorPopover(false);
            }}
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)';
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