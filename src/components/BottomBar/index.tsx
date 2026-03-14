import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BottomBarContainer, BottomBarInner, ZenTriggerZone } from './styled';
import { ControlButton } from '../controls/styled';
import VolumeControl from '../controls/VolumeControl';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import {
  VisualEffectsIcon,
  BackToLibraryIcon,
  PlaylistIcon,
  ZenModeIcon,
  ShuffleIcon,
} from '../icons/QuickActionIcons';

const ZEN_HIDE_DELAY = 3000;

interface BottomBarProps {
  zenModeEnabled?: boolean;
  isMuted: boolean;
  volume: number;
  onMuteToggle?: () => void;
  onVolumeChange?: (volume: number) => void;
  onShowVisualEffects: () => void;
  onBackToLibrary?: () => void;
  onShowPlaylist: () => void;
  onZenModeToggle?: () => void;
  shuffleEnabled?: boolean;
  onShuffleToggle?: () => void;
}

const BottomBar = React.memo(function BottomBar({
  zenModeEnabled,
  isMuted,
  volume,
  onMuteToggle,
  onVolumeChange,
  onShowVisualEffects,
  onBackToLibrary,
  onShowPlaylist,
  onZenModeToggle,
  shuffleEnabled,
  onShuffleToggle,
}: BottomBarProps) {
  const { isMobile, isTablet } = usePlayerSizingContext();
  const [zenBarVisible, setZenBarVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const zenEntryGuardRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }
  }, []);

  const startHideTimer = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setZenBarVisible(false);
    }, ZEN_HIDE_DELAY);
  }, [clearHideTimer]);

  const showBar = useCallback(() => {
    if (zenEntryGuardRef.current) return;
    setZenBarVisible(true);
    startHideTimer();
  }, [startHideTimer]);

  const handleBarMouseEnter = useCallback(() => {
    if (!zenModeEnabled) return;
    setZenBarVisible(true);
    clearHideTimer();
  }, [zenModeEnabled, clearHideTimer]);

  const handleBarMouseLeave = useCallback(() => {
    if (!zenModeEnabled) return;
    startHideTimer();
  }, [zenModeEnabled, startHideTimer]);

  const handleBarInteraction = useCallback(() => {
    if (!zenModeEnabled) return;
    clearHideTimer();
    startHideTimer();
  }, [zenModeEnabled, clearHideTimer, startHideTimer]);

  useEffect(() => {
    if (zenModeEnabled) {
      zenEntryGuardRef.current = true;
      const guardTimer = setTimeout(() => {
        zenEntryGuardRef.current = false;
      }, 500);
      return () => clearTimeout(guardTimer);
    } else {
      zenEntryGuardRef.current = false;
      setZenBarVisible(false);
      clearHideTimer();
    }
  }, [zenModeEnabled, clearHideTimer]);

  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  const isHidden = zenModeEnabled && !zenBarVisible;

  return createPortal(
    <>
      {zenModeEnabled && (
        <ZenTriggerZone
          onMouseEnter={showBar}
          onTouchStart={showBar}
        />
      )}
      <BottomBarContainer
        $zenHidden={isHidden}
        onMouseEnter={handleBarMouseEnter}
        onMouseLeave={handleBarMouseLeave}
        onClick={handleBarInteraction}
      >
        <BottomBarInner>
          <VolumeControl
            isMuted={isMuted}
            volume={volume}
            onClick={onMuteToggle ?? (() => {})}
            onVolumeChange={onVolumeChange ?? (() => {})}
            isMobile={isMobile}
            isTablet={isTablet}
          />

          {onShuffleToggle && (
            <ControlButton
              $isMobile={isMobile}
              $isTablet={isTablet}
              isActive={shuffleEnabled}
              onClick={onShuffleToggle}
              title={`Shuffle ${shuffleEnabled ? 'ON' : 'OFF'}`}
              aria-pressed={shuffleEnabled}
            >
              <ShuffleIcon />
            </ControlButton>
          )}

          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            $compact
            onClick={onShowVisualEffects}
            title="App settings"
          >
            <VisualEffectsIcon />
          </ControlButton>

          {onBackToLibrary && (
            <ControlButton
              $isMobile={isMobile}
              $isTablet={isTablet}
              $compact
              onClick={onBackToLibrary}
              title="Back to Library"
            >
              <BackToLibraryIcon />
            </ControlButton>
          )}

          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            $compact
            onClick={onShowPlaylist}
            title="Show Playlist"
          >
            <PlaylistIcon />
          </ControlButton>

          {onZenModeToggle && (
            <ControlButton
              $isMobile={isMobile}
              $isTablet={isTablet}
              $compact
              isActive={zenModeEnabled}
              onClick={onZenModeToggle}
              title={`Zen Mode ${zenModeEnabled ? 'ON' : 'OFF'}`}
              aria-pressed={zenModeEnabled}
            >
              <ZenModeIcon />
            </ControlButton>
          )}
        </BottomBarInner>
      </BottomBarContainer>
    </>,
    document.body
  );
});

export default BottomBar;
