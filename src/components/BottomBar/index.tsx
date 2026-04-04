import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BottomBarContainer, BottomBarInner, ZenTriggerZone } from './styled';
import { ControlButton } from '../controls/styled';
import VolumeControl from '../controls/VolumeControl';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import {
  VisualEffectsIcon,
  BackToLibraryIcon,
  QueueIcon,
  ZenModeIcon,
  ShuffleIcon,
  RadioIcon,
} from '../icons/QuickActionIcons';

const AUTOHIDE_DELAY = 1000;

interface BottomBarProps {
  zenModeEnabled?: boolean;
  isMuted: boolean;
  volume: number;
  onMuteToggle?: () => void;
  onVolumeChange?: (volume: number) => void;
  onShowVisualEffects: () => void;
  onBackToLibrary?: () => void;
  onShowQueue: () => void;
  onZenModeToggle?: () => void;
  shuffleEnabled?: boolean;
  onShuffleToggle?: () => void;
  onStartRadio?: () => void;
  radioGenerating?: boolean;
}

const BottomBar = React.memo(function BottomBar({
  zenModeEnabled,
  isMuted,
  volume,
  onMuteToggle,
  onVolumeChange,
  onShowVisualEffects,
  onBackToLibrary,
  onShowQueue,
  onZenModeToggle,
  shuffleEnabled,
  onShuffleToggle,
  onStartRadio,
  radioGenerating,
}: BottomBarProps) {
  const { isMobile, isTablet } = usePlayerSizingContext();
  const [barVisible, setBarVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isHoveringRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }
  }, []);

  const startHideTimer = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setBarVisible(false);
    }, AUTOHIDE_DELAY);
  }, [clearHideTimer]);

  const showBar = useCallback(() => {
    setBarVisible(true);
    if (!isHoveringRef.current) {
      startHideTimer();
    }
  }, [startHideTimer]);

  const handleBarMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    setBarVisible(true);
    clearHideTimer();
  }, [clearHideTimer]);

  const handleBarMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    startHideTimer();
  }, [startHideTimer]);

  useEffect(() => {
    startHideTimer();
    return () => clearHideTimer();
  }, [startHideTimer, clearHideTimer]);

  const isHidden = !barVisible;

  return createPortal(
    <>
      <ZenTriggerZone onMouseEnter={showBar} onTouchStart={showBar} />
      <BottomBarContainer
        $hidden={isHidden}
        onMouseEnter={handleBarMouseEnter}
        onMouseLeave={handleBarMouseLeave}
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
              aria-label="Shuffle"
              aria-pressed={shuffleEnabled}
            >
              <ShuffleIcon />
            </ControlButton>
          )}

          {onStartRadio && (
            <ControlButton
              $isMobile={isMobile}
              $isTablet={isTablet}
              $compact
              onClick={onStartRadio}
              title={radioGenerating ? 'Generating radio playlist...' : 'Generate radio playlist from current track'}
              disabled={radioGenerating}
              aria-label="Generate radio playlist from current track"
            >
              <RadioIcon />
            </ControlButton>
          )}

          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            $compact
            onClick={onShowVisualEffects}
            title="App settings"
            aria-label="App settings"
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
              aria-label="Back to Library"
            >
              <BackToLibraryIcon />
            </ControlButton>
          )}

          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            $compact
            onClick={onShowQueue}
            title="Show Queue"
            aria-label="Show Queue"
          >
            <QueueIcon />
          </ControlButton>

          {onZenModeToggle && (
            <ControlButton
              $isMobile={isMobile}
              $isTablet={isTablet}
              $compact
              isActive={zenModeEnabled}
              onClick={onZenModeToggle}
              title={`Zen Mode ${zenModeEnabled ? 'ON' : 'OFF'}`}
              aria-label="Zen Mode"
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
