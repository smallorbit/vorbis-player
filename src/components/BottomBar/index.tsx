import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BottomBarContainer, BottomBarInner, ZenTriggerZone } from './styled';
import { ControlButton } from '../controls/styled';
import VolumeControl from '../controls/VolumeControl';
import ColorPickerPopover from '../ColorPickerPopover';
import { useCustomAccentColors } from '@/hooks/useCustomAccentColors';
import { usePlayerSizing } from '@/hooks/usePlayerSizing';
import {
  VisualEffectsIcon,
  BackToLibraryIcon,
  PlaylistIcon,
  ZenModeIcon,
  ShuffleIcon,
} from '../icons/QuickActionIcons';
import type { Track } from '@/services/spotify';

const ZEN_HIDE_DELAY = 3000;

interface BottomBarProps {
  accentColor: string;
  currentTrack: Track | null;
  zenModeEnabled?: boolean;
  isMuted: boolean;
  volume: number;
  onMuteToggle?: () => void;
  onVolumeChange?: (volume: number) => void;
  onShowVisualEffects: () => void;
  onAccentColorChange: (color: string) => void;
  onBackToLibrary?: () => void;
  onShowPlaylist: () => void;
  onZenModeToggle?: () => void;
  shuffleEnabled?: boolean;
  onShuffleToggle?: () => void;
}

export default function BottomBar({
  accentColor,
  currentTrack,
  zenModeEnabled,
  isMuted,
  volume,
  onMuteToggle,
  onVolumeChange,
  onShowVisualEffects,
  onAccentColorChange,
  onBackToLibrary,
  onShowPlaylist,
  onZenModeToggle,
  shuffleEnabled,
  onShuffleToggle,
}: BottomBarProps) {
  const { isMobile, isTablet } = usePlayerSizing();
  const [zenBarVisible, setZenBarVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const { customAccentColorOverrides, handleCustomAccentColor, handleAccentColorChange } =
    useCustomAccentColors({
      currentAlbumId: currentTrack?.album_id,
      onAccentColorChange,
    });

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
    if (!zenModeEnabled) {
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
            accentColor={accentColor}
            onClick={onMuteToggle ?? (() => {})}
            onVolumeChange={onVolumeChange ?? (() => {})}
            isMobile={isMobile}
            isTablet={isTablet}
          />

          {onShuffleToggle && (
            <ControlButton
              $isMobile={isMobile}
              $isTablet={isTablet}
              accentColor={accentColor}
              isActive={shuffleEnabled}
              onClick={onShuffleToggle}
              title={`Shuffle ${shuffleEnabled ? 'ON' : 'OFF'}`}
              aria-pressed={shuffleEnabled}
            >
              <ShuffleIcon />
            </ControlButton>
          )}

          <ColorPickerPopover
            accentColor={accentColor}
            currentTrack={currentTrack}
            onAccentColorChange={handleAccentColorChange}
            customAccentColorOverrides={customAccentColorOverrides}
            onCustomAccentColor={handleCustomAccentColor}
            $isMobile={isMobile}
            $isTablet={isTablet}
            $compact
          />

          <ControlButton
            $isMobile={isMobile}
            $isTablet={isTablet}
            $compact
            accentColor={accentColor}
            onClick={onShowVisualEffects}
            title="Visual effects"
          >
            <VisualEffectsIcon />
          </ControlButton>

          {onBackToLibrary && (
            <ControlButton
              $isMobile={isMobile}
              $isTablet={isTablet}
              $compact
              accentColor={accentColor}
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
            accentColor={accentColor}
            onClick={onShowPlaylist}
            title="Show Playlist"
          >
            <PlaylistIcon />
          </ControlButton>

          {!isMobile && onZenModeToggle && (
            <ControlButton
              $isMobile={isMobile}
              $isTablet={isTablet}
              $compact
              accentColor={accentColor}
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
}
