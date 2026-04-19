import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BottomBarContainer, BottomBarInner, ZenGripPill, ZenTriggerZone, ZenBackdrop } from './styled';
import { ControlButton } from '../controls/styled';
import VolumeControl from '../controls/VolumeControl';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useQapEnabled } from '@/hooks/useQapEnabled';
import { useVolume } from '@/hooks/useVolume';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useZenMode } from '@/contexts/visualEffects';
import { useBottomBarActions } from '@/contexts/BottomBarActionsContext';
import {
  VisualEffectsIcon,
  BackToLibraryIcon,
  QueueIcon,
  ZenModeIcon,
  ShuffleIcon,
  RadioIcon,
  QuickAccessPanelIcon,
} from '../icons/QuickActionIcons';

const AUTOHIDE_DELAY = 1000;

const BottomBar = React.memo(function BottomBar() {
  const { isMobile, isTablet, isTouchDevice } = usePlayerSizingContext();
  const [qapEnabled] = useQapEnabled();
  const { currentTrack } = useCurrentTrackContext();
  const { isMuted, volume, handleMuteToggle, setVolumeLevel } = useVolume(currentTrack?.provider);
  const { shuffleEnabled, handleShuffleToggle } = useTrackListContext();
  const { zenModeEnabled } = useZenMode();
  const {
    hidden,
    showSettings,
    showQueue,
    openLibrary,
    toggleZenMode,
    startRadio,
    openQuickAccessPanel,
    radioGenerating,
  } = useBottomBarActions();

  const [barVisible, setBarVisible] = useState(!zenModeEnabled);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isHoveringRef = useRef(false);
  const touchLockedRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }
  }, []);

  const startHideTimer = useCallback(() => {
    if (touchLockedRef.current) return;
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

  const handleTouchToggle = useCallback(() => {
    if (barVisible) {
      touchLockedRef.current = false;
      setBarVisible(false);
    } else {
      touchLockedRef.current = true;
      setBarVisible(true);
      clearHideTimer();
    }
  }, [barVisible, clearHideTimer]);

  const handleBackdropDismiss = useCallback(() => {
    touchLockedRef.current = false;
    setBarVisible(false);
  }, []);

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
    if (!zenModeEnabled) return;
    startHideTimer();
    return () => clearHideTimer();
  }, [zenModeEnabled, startHideTimer, clearHideTimer]);

  useEffect(() => {
    if (zenModeEnabled) return;
    clearHideTimer();
    touchLockedRef.current = false;
    setBarVisible(true);
  }, [zenModeEnabled, clearHideTimer]);

  if (hidden) return null;

  const isHidden = !barVisible && zenModeEnabled;

  return createPortal(
    <>
      {zenModeEnabled && barVisible && isTouchDevice && (
        <ZenBackdrop onTouchStart={handleBackdropDismiss} onClick={handleBackdropDismiss} />
      )}
      {zenModeEnabled && (
        <ZenTriggerZone
          onMouseEnter={isTouchDevice ? undefined : showBar}
          onTouchStart={isTouchDevice ? handleTouchToggle : undefined}
        >
          <ZenGripPill $visible={!barVisible} />
        </ZenTriggerZone>
      )}
      <BottomBarContainer
        $hidden={isHidden}
        onMouseEnter={handleBarMouseEnter}
        onMouseLeave={handleBarMouseLeave}
      >
        <BottomBarInner>
          <VolumeControl
            isMuted={isMuted}
            volume={volume}
            onClick={handleMuteToggle}
            onVolumeChange={setVolumeLevel}
            isMobile={isMobile}
            isTablet={isTablet}
          />

          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            isActive={shuffleEnabled}
            onClick={handleShuffleToggle}
            title={`Shuffle ${shuffleEnabled ? 'ON' : 'OFF'}`}
            aria-label="Shuffle"
            aria-pressed={shuffleEnabled}
          >
            <ShuffleIcon />
          </ControlButton>

          {startRadio && (
            <ControlButton
              $isMobile={isMobile}
              $isTablet={isTablet}
              $compact
              onClick={startRadio}
              title={radioGenerating ? 'Generating radio playlist...' : 'Generate radio playlist from current track'}
              disabled={radioGenerating}
              aria-label="Generate radio playlist from current track"
            >
              <RadioIcon />
            </ControlButton>
          )}

          {qapEnabled && openQuickAccessPanel && (
            <ControlButton
              $isMobile={isMobile}
              $isTablet={isTablet}
              $compact
              onClick={openQuickAccessPanel}
              title="Quick Access Panel"
              aria-label="Quick Access Panel"
            >
              <QuickAccessPanelIcon />
            </ControlButton>
          )}

          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            $compact
            onClick={showSettings}
            title="App settings"
            aria-label="App settings"
          >
            <VisualEffectsIcon />
          </ControlButton>

          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            $compact
            onClick={openLibrary}
            title="Back to Library"
            aria-label="Back to Library"
          >
            <BackToLibraryIcon />
          </ControlButton>

          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            $compact
            onClick={showQueue}
            title="Show Queue"
            aria-label="Show Queue"
          >
            <QueueIcon />
          </ControlButton>

          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            $compact
            isActive={zenModeEnabled}
            onClick={toggleZenMode}
            title={`Zen Mode ${zenModeEnabled ? 'ON' : 'OFF'}`}
            aria-label="Zen Mode"
            aria-pressed={zenModeEnabled}
          >
            <ZenModeIcon />
          </ControlButton>
        </BottomBarInner>
      </BottomBarContainer>
    </>,
    document.body
  );
});

export default BottomBar;
