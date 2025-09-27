import { useState, useEffect, memo, lazy, Suspense, useCallback } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import LikeButton from './LikeButton';
import { TimelineRow, TimelineSlider } from './TimelineSlider';

// Lazy load ColorPickerPopover for better performance
const ColorPickerPopover = lazy(() => import('./ColorPickerPopover'));
import { useSpotifyControls } from '../hooks/useSpotifyControls';
import { theme } from '../styles/theme';

const sm = theme.spacing.sm;
const lg = theme.spacing.lg;

// --- Styled Components ---
const PlayerControlsContainer = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${sm} ${lg} ${lg} ${lg};
`;

// New components for the track info row
const TrackInfoOnlyRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${({ theme }) => theme.spacing.xs};
  // width: 100%;
  padding: 0 ${({ theme }) => theme.spacing.md};
`;

const PlayerTrackName = styled.div`
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  font-size: ${({ theme }) => theme.fontSize['2xl']};
  line-height: ${({ theme }) => theme.fontSize['3xl']};
  color: ${({ theme }) => theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
`;

const PlayerTrackArtist = styled.div`
  font-size: ${({ theme }) => theme.fontSize.sm};
  line-height: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray[300]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
`;

const TrackInfoRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
`;

const TrackInfoLeft = styled.div`
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const TrackInfoCenter = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 8.5rem;
  gap: ${({ theme }) => theme.spacing.xs};
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
`;

const TrackInfoRight = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ControlButton = styled.button.withConfig({
  shouldForwardProp: (prop) => !['isActive', 'accentColor'].includes(prop),
}) <{ isActive?: boolean; accentColor: string }>`
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

background: ${({ isActive, accentColor }: { isActive?: boolean; accentColor: string }) => isActive ? accentColor : theme.colors.control.background};
color: ${theme.colors.white};
  
  &:hover {
  background: ${({ isActive, accentColor }: { isActive?: boolean; accentColor: string }) => isActive ? `${accentColor}4D` : theme.colors.control.backgroundHover};
}
`;

const VolumeButton = styled.button`
  border: none;
  background: transparent;
  color: ${theme.colors.gray[400]};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: ${theme.spacing.xs};
  border-radius: ${theme.borderRadius.md};
  transition: all 0.2s ease;
  
  &:hover {
    background: ${theme.colors.control.background};
    color: ${theme.colors.white};
  }
  
  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }
`;


const TimelineLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const TimelineRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

// Custom comparison function for SpotifyPlayerControls memo optimization
const areControlsPropsEqual = (
  prevProps: SpotifyPlayerControlsProps,
  nextProps: SpotifyPlayerControlsProps
): boolean => {
  // Check if track changed (most important check)
  if (prevProps.currentTrack?.id !== nextProps.currentTrack?.id) {
    return false;
  }

  // Check accent color
  if (prevProps.accentColor !== nextProps.accentColor) {
    return false;
  }

  // Check glow settings
  if (prevProps.glowEnabled !== nextProps.glowEnabled) {
    return false;
  }

  // Check visual effects state
  if (prevProps.showVisualEffects !== nextProps.showVisualEffects) {
    return false;
  }

  // Check track count for playlist display
  if (prevProps.trackCount !== nextProps.trackCount) {
    return false;
  }

  // For callbacks, we assume they're stable (parent should use useCallback)
  // This prevents unnecessary re-renders due to function reference changes

  return true;
};

interface SpotifyPlayerControlsProps {
  currentTrack: Track | null;
  accentColor: string;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShowPlaylist: () => void;
  trackCount: number;
  onAccentColorChange?: (color: string) => void;
  onShowVisualEffects?: () => void;
  showVisualEffects?: boolean;
  // Add glow control props
  glowEnabled?: boolean;
  onGlowToggle?: () => void;
}

// --- SpotifyPlayerControls Component ---
const SpotifyPlayerControls = memo<SpotifyPlayerControlsProps>(({ currentTrack, accentColor, onPlay, onPause, onNext, onPrevious, onShowPlaylist, onAccentColorChange, onShowVisualEffects, showVisualEffects, glowEnabled, onGlowToggle }) => {
  // Custom accent color per track (from eyedropper)
  const [customAccentColorOverrides, setCustomAccentColorOverrides] = useState<Record<string, string>>({});

  // Use Spotify controls hook
  const {
    isPlaying,
    isMuted,
    volume,
    currentPosition,
    duration,
    isLiked,
    isLikePending,
    handlePlayPause,
    handleVolumeButtonClick,
    handleLikeToggle,
    handleSliderChange,
    handleSliderMouseDown,
    handleSliderMouseUp,
    formatTime,
  } = useSpotifyControls({
    currentTrack,
    onPlay,
    onPause,
    onNext,
    onPrevious
  });

  // Load custom accent color overrides from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('customAccentColorOverrides');
    if (stored) {
      try {
        setCustomAccentColorOverrides(JSON.parse(stored));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  // Save custom accent color overrides to localStorage when changed
  useEffect(() => {
    localStorage.setItem('customAccentColorOverrides', JSON.stringify(customAccentColorOverrides));
  }, [customAccentColorOverrides]);

  // When user picks a color with the eyedropper, store it as the custom color for this track
  const handleCustomAccentColor = useCallback((color: string) => {
    if (currentTrack?.id) {
      if (color === '') {
        // Empty string means reset - remove the override
        setCustomAccentColorOverrides(prev => {
          const newOverrides = { ...prev };
          delete newOverrides[currentTrack.id!];
          return newOverrides;
        });
      } else {
        setCustomAccentColorOverrides(prev => ({ ...prev, [currentTrack.id!]: color }));
      }
      onAccentColorChange?.(color);
    } else {
      onAccentColorChange?.(color);
    }
  }, [currentTrack?.id, onAccentColorChange]);

  // Handle accent color changes, including reset
  const handleAccentColorChange = useCallback((color: string) => {
    if (color === 'RESET_TO_DEFAULT' && currentTrack?.id) {
      // Remove custom color override for this track
      setCustomAccentColorOverrides(prev => {
        const newOverrides = { ...prev };
        delete newOverrides[currentTrack.id!];
        return newOverrides;
      });
      // Don't call onAccentColorChange here - let the parent re-extract the color
      return;
    }

    if (currentTrack?.id) {
      setCustomAccentColorOverrides(prev => ({ ...prev, [currentTrack.id!]: color }));
      onAccentColorChange?.(color);
    } else {
      onAccentColorChange?.(color);
    }
  }, [currentTrack?.id, onAccentColorChange]);


  return (
    <PlayerControlsContainer>
      {/* New Track Info Row - Song name and artist only */}
      <TrackInfoOnlyRow>
        <PlayerTrackName>{currentTrack?.name || 'No track selected'}</PlayerTrackName>
        <PlayerTrackArtist>{currentTrack?.artists || ''}</PlayerTrackArtist>
      </TrackInfoOnlyRow>

      {/* Controls Row - now without track info in the left section */}
      <TrackInfoRow style={{ position: 'relative' }}>
        <TrackInfoLeft>
          {/* Left side is now empty - could be used for other controls if needed */}
        </TrackInfoLeft>
        <TrackInfoCenter>
          <ControlButton accentColor={accentColor} onClick={onPrevious}>
            <svg viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </ControlButton>
          <ControlButton accentColor={accentColor} isActive={isPlaying} onClick={handlePlayPause}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </ControlButton>
          <ControlButton accentColor={accentColor} onClick={onNext}>
            <svg viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </ControlButton>
        </TrackInfoCenter>
        <TrackInfoRight>
          <ControlButton accentColor={accentColor} onClick={onShowPlaylist} title="Show Playlist">
            <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
            </svg>
          </ControlButton>
        </TrackInfoRight>
      </TrackInfoRow>

      {/* Timeline Row with time, slider, and right controls */}
      <TimelineRow>
        <TimelineLeft>
          {onGlowToggle && (
            <ControlButton
              accentColor={accentColor}
              isActive={glowEnabled}
              title={`Visual Effects ${glowEnabled ? 'enabled' : 'disabled'} `}
              onClick={onGlowToggle}
              style={{ marginLeft: 8 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v4m0 10v4m9-9h-4m-10 0H3" />
              </svg>
            </ControlButton>
          )}
          <ControlButton
            accentColor={accentColor}
            onClick={onShowVisualEffects}
            isActive={showVisualEffects}
            title="Visual effects"
            data-testid="visual-effects-button"
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

          <Suspense fallback={<div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚡</div>}>
            <ColorPickerPopover
              accentColor={accentColor}
              currentTrack={currentTrack}
              onAccentColorChange={handleAccentColorChange}
              customAccentColorOverrides={customAccentColorOverrides}
              onCustomAccentColor={handleCustomAccentColor}
            />
          </Suspense>
          <VolumeButton onClick={handleVolumeButtonClick} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? (
              <svg viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L22.46 25L23.87 23.59L2.41 2.13Z" />
              </svg>
            ) : volume > 50 ? (
              <svg viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            ) : volume > 0 ? (
              <svg viewBox="0 0 24 24">
                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M7 9v6h4l5 5V4l-5 5H7z" />
              </svg>
            )}
          </VolumeButton>
        </TimelineLeft>

        <TimelineSlider
          currentPosition={currentPosition}
          duration={duration}
          accentColor={accentColor}
          formatTime={formatTime}
          onSliderChange={handleSliderChange}
          onSliderMouseDown={handleSliderMouseDown}
          onSliderMouseUp={handleSliderMouseUp}
        />

        <TimelineRight>
          <LikeButton
            trackId={currentTrack?.id}
            isLiked={isLiked}
            isLoading={isLikePending}
            accentColor={accentColor}
            onToggleLike={handleLikeToggle}
          />


        </TimelineRight>
      </TimelineRow>
    </PlayerControlsContainer>
  );
}, areControlsPropsEqual);

SpotifyPlayerControls.displayName = 'SpotifyPlayerControls';

export default SpotifyPlayerControls; 