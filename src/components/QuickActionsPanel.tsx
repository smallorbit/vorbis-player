import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import { usePlayerSizing } from '@/hooks/usePlayerSizing';
import { ControlButton } from './controls/styled';
import ColorPickerPopover from './ColorPickerPopover';
import { useCustomAccentColors } from '@/hooks/useCustomAccentColors';
import type { Track } from '@/services/spotify';

interface QuickActionsPanelProps {
  accentColor: string;
  currentTrack: Track | null;
  glowEnabled: boolean;
  onShowPlaylist: () => void;
  onShowVisualEffects: () => void;
  onGlowToggle: () => void;
  onAccentColorChange: (color: string) => void;
  isVisible?: boolean;
}

const PanelWrapper = styled.div<{ $isOpen: boolean; $transitionDuration: number; $transitionEasing: string }>`
  position: absolute;
  top: 50%;
  left: 100%;
  transform: translateY(-50%) translateX(${({ $isOpen }) => ($isOpen ? '0' : 'calc(-12px)')});
  transition: transform ${({ $transitionDuration }) => $transitionDuration}ms ${({ $transitionEasing }) => $transitionEasing};
  z-index: ${theme.zIndex.popover};
`;

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs};
  background: ${theme.colors.overlay.dark};
  border: 1px solid ${theme.colors.popover.border};
  border-right: none;
  border-top-left-radius: ${theme.borderRadius.lg};
  border-bottom-left-radius: ${theme.borderRadius.lg};
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
  backdrop-filter: blur(${theme.drawer.backdropBlur});
`;

const ToggleHandle = styled.button<{ $accentColor: string }>`
  position: absolute;
  top: 50%;
  left: -12px;
  transform: translateY(-50%);
  width: 12px;
  height: 48px;
  border: none;
  border-top-left-radius: ${theme.borderRadius.md};
  border-bottom-left-radius: ${theme.borderRadius.md};
  background: ${({ $accentColor }) => $accentColor};
  cursor: pointer;
`;

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  accentColor,
  currentTrack,
  glowEnabled,
  onShowPlaylist,
  onShowVisualEffects,
  onGlowToggle,
  onAccentColorChange,
  isVisible = true
}) => {
  const { isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizing();

  const defaultOpen = useMemo(() => !isMobile, [isMobile]);
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  const { customAccentColorOverrides, handleCustomAccentColor, handleAccentColorChange } = useCustomAccentColors({
    currentTrackId: currentTrack?.id,
    onAccentColorChange
  });

  if (!isVisible) return null;

  return (
    <PanelWrapper $isOpen={isOpen} $transitionDuration={transitionDuration} $transitionEasing={transitionEasing} onClick={(e) => e.stopPropagation()}>
      <PanelContainer>
        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          onClick={onShowPlaylist}
          title="Show Playlist"
        >
          <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
            <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
          </svg>
        </ControlButton>

        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          isActive={glowEnabled}
          onClick={onGlowToggle}
          title={`Visual Effects ${glowEnabled ? 'enabled' : 'disabled'}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v4m0 10v4m9-9h-4m-10 0H3" />
          </svg>
        </ControlButton>

        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          isActive={false}
          onClick={onShowVisualEffects}
          title="Visual effects"
          data-testid="quick-visual-effects-button"
        >
          <svg viewBox="0 0 24 24" style={{ display: 'block' }} width="1.5rem" height="1.5rem" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 00.12-.64l-2-3.46a.5.5 0 00-.6-.22l-2.49 1a7.03 7.03 0 00-1.7-.98l-.38-2.65A.488.488 0 0014 2h-4a.488.488 0 00-.5.42l-.38 2.65c-.63.25-1.21.57-1.77.98l-2.49-1a.5.5 0 00-.6.22l-2 3.46a.5.5 0 00.12.64l2.11 1.65c-.05.32-.08.65-.08.99s.03.67.08.99l-2.11 1.65a.5.5 0 00-.12.64l2 3.46c.14.24.44.33.7.22l2.49-1c.54.41 1.13.74 1.77.98l.38 2.65c.05.28.27.42.5.42h4c.23 0 .45-.14.5-.42l.38-2.65c.63-.25 1.22-.57 1.77-.98l2.49 1c.26.11.56.02.7-.22l2-3.46a.5.5 0 00-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z"
            />
            <circle cx="12" cy="12" r="2" fill="#fff" />
          </svg>
        </ControlButton>

        <ColorPickerPopover
          accentColor={accentColor}
          currentTrack={currentTrack}
          onAccentColorChange={handleAccentColorChange}
          customAccentColorOverrides={customAccentColorOverrides}
          onCustomAccentColor={handleCustomAccentColor}
          $isMobile={isMobile}
          $isTablet={isTablet}
        />
      </PanelContainer>

      <ToggleHandle $accentColor={accentColor} aria-label={isOpen ? 'Collapse quick actions' : 'Expand quick actions'} onClick={() => setIsOpen(v => !v)} />
    </PanelWrapper>
  );
};

export default QuickActionsPanel;


