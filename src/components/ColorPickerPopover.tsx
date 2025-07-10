import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import EyedropperOverlay from './EyedropperOverlay';
import { extractTopVibrantColors } from '../utils/colorExtractor';
import type { ExtractedColor } from '../utils/colorExtractor';
import type { Track } from '../services/spotify';
import { theme } from '../styles/theme';

const ControlButton = styled.button<{ isActive?: boolean; accentColor: string }>`
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  
  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }
  
  ${({ isActive, accentColor }: { isActive?: boolean; accentColor: string }) => isActive ? `
    background: ${accentColor};
    color: ${theme.colors.white};
    
    &:hover {
      background: ${accentColor}4D;
    }
  ` : `
    background: ${theme.colors.control.background};
    color: ${theme.colors.white};
    
    &:hover {
      background: ${theme.colors.control.backgroundHover};
    }
  `}
`;

interface ColorPickerPopoverProps {
  accentColor: string;
  currentTrack: Track | null;
  onAccentColorChange?: (color: string) => void;
  customAccentColorOverrides: Record<string, string>;
  onCustomAccentColor: (color: string) => void;
}

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  accentColor,
  currentTrack,
  onAccentColorChange,
  customAccentColorOverrides,
  onCustomAccentColor
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
        style={{ position: 'relative' }}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" role="img">
          <path d="M21 12.79A9 9 0 1 1 12 3a7 7 0 0 1 7 7c0 1.38-.56 2.63-1.46 3.54-.63.63-.54 1.71.21 2.21a2 2 0 0 0 2.25.13z" fill={accentColor} />
          <circle cx="8.5" cy="10.5" r="1" fill="#fff" />
          <circle cx="12" cy="7.5" r="1" fill="#fff" />
          <circle cx="15.5" cy="10.5" r="1" fill="#fff" />
          <circle cx="12" cy="14.5" r="1" fill="#fff" />
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
                  <svg width="32" height="32" viewBox="2 2 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                    <circle cx="11" cy="11" r="3" />
                  </svg>
                </ControlButton>
              )}
            </div>
          )}
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
};

export default ColorPickerPopover;