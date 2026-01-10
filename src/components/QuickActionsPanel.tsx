import React from 'react';
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
  glowEnabled: boolean; // Keep for debug mode display
  onShowPlaylist: () => void;
  onShowVisualEffects: () => void;
  onGlowToggle: () => void; // Keep for debug mode
  onAccentColorChange: (color: string) => void;
  onBackgroundVisualizerToggle?: () => void; // Background visualizer toggle handler (kept for debug mode)
  backgroundVisualizerEnabled?: boolean; // Background visualizer enabled state (kept for debug mode)
  debugModeEnabled?: boolean; // Debug mode toggle
  onBackToLibrary?: () => void; // Back to library navigation handler
  isVisible?: boolean;
}

const PanelWrapper = styled.div<{ $transitionDuration: number; $transitionEasing: string }>`
  position: absolute;
  top: 50%;
  left: 100%;
  transform: translateY(-50%);
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
  border-top-right-radius: ${theme.borderRadius.lg};
  border-bottom-right-radius: ${theme.borderRadius.lg};
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
  backdrop-filter: blur(${theme.drawer.backdropBlur});
`;

const DebugSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs};
  margin-top: ${theme.spacing.xs};
  border-top: 1px dashed rgba(255, 255, 255, 0.2);
  border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
`;

const DebugLabel = styled.div`
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;


export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  accentColor,
  currentTrack,
  // glowEnabled, onGlowToggle, onBackgroundVisualizerToggle, backgroundVisualizerEnabled kept for API compatibility
  onShowPlaylist,
  onShowVisualEffects,
  onAccentColorChange,
  onBackToLibrary,
  debugModeEnabled = false,
  isVisible = true
}) => {
  const { isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizing();

  const { customAccentColorOverrides, handleCustomAccentColor, handleAccentColorChange } = useCustomAccentColors({
    currentTrackId: currentTrack?.id,
    onAccentColorChange
  });

  if (!isVisible) return null;

  return (
    <PanelWrapper $transitionDuration={transitionDuration} $transitionEasing={transitionEasing} onClick={(e) => e.stopPropagation()}>
      <PanelContainer>
        {onBackToLibrary && (
          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            accentColor={accentColor}
            onClick={onBackToLibrary}
            title="Back to Library"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
            </svg>
          </ControlButton>
        )}

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

        {/* Debug controls - only shown when debug mode is enabled (press 'D' to toggle) */}
        {debugModeEnabled && (
          <DebugSection>
            <DebugLabel>Debug Mode</DebugLabel>
            {/* Future debug tools can go here */}
          </DebugSection>
        )}
      </PanelContainer>
    </PanelWrapper>
  );
};

export default QuickActionsPanel;


