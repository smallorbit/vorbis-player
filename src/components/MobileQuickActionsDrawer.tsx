import React from 'react';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import { usePlayerSizing } from '@/hooks/usePlayerSizing';
import { ControlButton } from './controls/styled';
import ColorPickerPopover from './ColorPickerPopover';
import { useCustomAccentColors } from '@/hooks/useCustomAccentColors';
import type { Track } from '@/services/spotify';

interface MobileQuickActionsDrawerProps {
  accentColor: string;
  currentTrack: Track | null;
  glowEnabled: boolean;
  backgroundVisualizerEnabled?: boolean;
  onShowPlaylist: () => void;
  onShowVisualEffects: () => void;
  onGlowToggle: () => void;
  onBackgroundVisualizerToggle?: () => void;
  onAccentColorChange: (color: string) => void;
  onBackToLibrary?: () => void;
  debugModeEnabled?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

/* Sub drawer: sits below the controls panel, slides out from underneath it */
const DrawerWrapper = styled.div`
  width: 100%;
  flex-shrink: 0;
  overflow: hidden;
`;

/* Handle at the seam between controls panel and sub drawer - tap to expand/collapse */
const DrawerHandle = styled.button<{ $isExpanded: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid ${theme.colors.popover.border};
  border-top: none;
  border-radius: 0 0 ${theme.borderRadius.md} ${theme.borderRadius.md};
  cursor: pointer;
  color: ${theme.colors.gray[400]};
  transition: all 0.2s ease;

  &:hover {
    background: rgba(50, 50, 50, 0.8);
    color: ${theme.colors.white};
  }

  svg {
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 0.2s ease;
    transform: ${({ $isExpanded }) => ($isExpanded ? 'rotate(180deg)' : 'rotate(0)')};
  }
`;

/* Content slides down from underneath the handle when expanded */
const DrawerContent = styled.div<{ $isExpanded: boolean; $transitionDuration: number; $transitionEasing: string }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm};
  background: ${theme.colors.overlay.dark};
  border: 1px solid ${theme.colors.popover.border};
  border-top: none;
  border-radius: 0 0 ${theme.borderRadius.lg} ${theme.borderRadius.lg};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(${theme.drawer.backdropBlur});

  max-height: ${({ $isExpanded }) => ($isExpanded ? '280px' : '0')};
  opacity: ${({ $isExpanded }) => ($isExpanded ? '1' : '0')};
  padding-top: ${({ $isExpanded }) => ($isExpanded ? theme.spacing.sm : '0')};
  padding-bottom: ${({ $isExpanded }) => ($isExpanded ? theme.spacing.sm : '0')};
  overflow: hidden;
  border-width: ${({ $isExpanded }) => ($isExpanded ? '1px' : '0')};
  border-top-width: 0;

  transition:
    max-height ${({ $transitionDuration, $transitionEasing }) => `${$transitionDuration}ms ${$transitionEasing}`},
    opacity ${({ $transitionDuration, $transitionEasing }) => `${$transitionDuration}ms ${$transitionEasing}`},
    padding ${({ $transitionDuration, $transitionEasing }) => `${$transitionDuration}ms ${$transitionEasing}`},
    border-width ${({ $transitionDuration, $transitionEasing }) => `${$transitionDuration}ms ${$transitionEasing}`};
`;

const DebugSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
  padding: ${theme.spacing.xs};
  margin-top: ${theme.spacing.xs};
  border-top: 1px dashed rgba(255, 255, 255, 0.2);
  width: 100%;
`;

const DebugLabel = styled.div`
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const MobileQuickActionsDrawer: React.FC<MobileQuickActionsDrawerProps> = ({
  accentColor,
  currentTrack,
  glowEnabled,
  backgroundVisualizerEnabled,
  onShowPlaylist,
  onShowVisualEffects,
  onGlowToggle,
  onBackgroundVisualizerToggle,
  onAccentColorChange,
  onBackToLibrary,
  debugModeEnabled = false,
  isExpanded,
  onToggleExpand,
}) => {
  const { isMobile, isTablet, transitionDuration, transitionEasing } = usePlayerSizing();

  const { customAccentColorOverrides, handleCustomAccentColor, handleAccentColorChange } = useCustomAccentColors({
    currentTrackId: currentTrack?.id,
    onAccentColorChange,
  });

  return (
    <DrawerWrapper onClick={(e) => e.stopPropagation()}>
      <DrawerHandle
        $isExpanded={isExpanded}
        onClick={onToggleExpand}
        title={isExpanded ? 'Collapse quick actions' : 'Expand quick actions'}
        aria-expanded={isExpanded}
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 10l5 5 5-5H7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </DrawerHandle>

      <DrawerContent
        $isExpanded={isExpanded}
        $transitionDuration={transitionDuration}
        $transitionEasing={transitionEasing}
      >
        {/* Glow toggle - from LeftQuickActionsPanel */}
        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          isActive={glowEnabled}
          onClick={onGlowToggle}
          title={`Visual Effects ${glowEnabled ? 'enabled' : 'disabled'}`}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 12H22M18.5 5.5L19.5 4.5M12 3V2M5.5 5.5L4.5 4.5M3 12H2M10 22H14M17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.0503 8.2341 15.8124 10 16.584V19H14V16.584C15.7659 15.8124 17 14.0503 17 12Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </ControlButton>

        {/* Background visualizer toggle - from LeftQuickActionsPanel */}
        {onBackgroundVisualizerToggle && (
          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            accentColor={accentColor}
            isActive={backgroundVisualizerEnabled}
            onClick={onBackgroundVisualizerToggle}
            title={`Background Visualizer ${backgroundVisualizerEnabled ? 'ON' : 'OFF'}`}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.4303 15.0014H4.40034C2.58034 15.0014 1.42034 13.0514 2.30034 11.4514L4.63034 7.21141L6.81034 3.24141C7.72034 1.59141 10.1003 1.59141 11.0103 3.24141L13.2003 7.21141L14.2503 9.12141L15.5303 11.4514C16.4103 13.0514 15.2503 15.0014 13.4303 15.0014Z" fill="currentColor" />
              <path d="M22.6507 15.999C22.6507 19.589 19.7407 22.499 16.1507 22.499C13.1007 22.499 10.5507 20.409 9.84075 17.569C9.77075 17.269 10.0007 16.999 10.3107 16.999H14.0807C15.4707 16.999 16.7307 16.279 17.4407 15.089C18.1407 13.889 18.1707 12.449 17.4907 11.229L16.9907 10.309C16.8007 9.96898 17.0707 9.55898 17.4507 9.62898C20.4107 10.229 22.6507 12.849 22.6507 15.999Z" fill="currentColor" />
            </svg>
          </ControlButton>
        )}

        {/* Playlist - from QuickActionsPanel */}
        <ControlButton
          $isMobile={isMobile}
          $isTablet={isTablet}
          accentColor={accentColor}
          onClick={onShowPlaylist}
          title="Show Playlist"
        >
          <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
            <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" fill="currentColor" />
          </svg>
        </ControlButton>

        {/* Visual effects - from QuickActionsPanel */}
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

        {debugModeEnabled && (
          <DebugSection>
            <DebugLabel>Debug Mode</DebugLabel>
          </DebugSection>
        )}
      </DrawerContent>
    </DrawerWrapper>
  );
};

export default MobileQuickActionsDrawer;
