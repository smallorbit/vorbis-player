import { useState, useEffect, memo, useRef } from 'react';
import styled from 'styled-components';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { spotifyAuth, checkTrackSaved, saveTrack, unsaveTrack } from '../services/spotify';
import type { Track } from '../services/spotify';
import LikeButton from './LikeButton';
// ... existing code ...
// Copy all styled components and the SpotifyPlayerControls component from AudioPlayer.tsx here
// ... existing code ... 

// --- Styled Components ---
const PlayerControlsContainer = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }: any) => theme.spacing.sm};
  padding: ${({ theme }: any) => theme.spacing.xs} ${({ theme }: any) => theme.spacing.md} ${({ theme }: any) => theme.spacing.md} ${({ theme }: any) => theme.spacing.md};
`;

const PlayerTrackInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const PlayerTrackName = styled.div`
  font-weight: ${({ theme }: any) => theme.fontWeight.semibold};
  font-size: ${({ theme }: any) => theme.fontSize.base};
  line-height: 1.25;
  color: ${({ theme }: any) => theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PlayerTrackArtist = styled.div`
  font-size: ${({ theme }: any) => theme.fontSize.sm};
  margin-top: ${({ theme }: any) => theme.spacing.xs};
  color: ${({ theme }: any) => theme.colors.gray[400]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }: any) => theme.spacing.xs};
  
  @media (min-width: ${({ theme }: any) => theme.breakpoints.sm}) {
    justify-content: flex-start;
  }
`;

const TrackInfoRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }: any) => theme.spacing.sm};
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
  gap: ${({ theme }: any) => theme.spacing.xs};
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
`;

const TrackInfoRight = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }: any) => theme.spacing.xs};
`;

const ControlButtons = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: any) => theme.spacing.sm};
  flex-shrink: 0;
`;

const ControlButton = styled.button<{ isPlaying?: boolean; accentColor: string }>`
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0.5rem;
  border-radius: 0.375rem;
  
  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }
  
  ${({ isPlaying, accentColor }) => isPlaying ? `
    background: ${accentColor}33;
    color: ${accentColor};
    
    &:hover {
      background: ${accentColor}4D;
    }
  ` : `
    background: rgba(115, 115, 115, 0.2);
    color: white;
    
    &:hover {
      background: rgba(115, 115, 115, 0.3);
    }
  `}
`;

const VolumeButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }: any) => theme.colors.gray[400]};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0.3rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(115, 115, 115, 0.2);
    color: ${({ theme }: any) => theme.colors.white};
  }
  
  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }
`;

const VideoToggleButton = styled.button<{ isActive: boolean }>`
  border: none;
  background: transparent;
  color: ${({ theme, isActive }: any) => isActive ? theme.colors.white : theme.colors.gray[400]};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0.3rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(115, 115, 115, 0.2);
    color: ${({ theme }: any) => theme.colors.white};
  }
  
  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }
`;

const TimelineContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: any) => theme.spacing.sm};
  width: 100%;
  margin: ${({ theme }: any) => theme.spacing.sm} 0;
`;

const TimelineSlider = styled.input<{ accentColor: string }>`
  flex: 1;
  height: 4px;
  background: rgba(115, 115, 115, 0.3);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: ${props => props.accentColor} !important;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: none;
    transition: all 0.2s ease;
    
    &:hover {
      transform: scale(1.2);
    }
  }
  
  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: ${props => props.accentColor} !important;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: none;
    transition: all 0.2s ease;
    
    &:hover {
      transform: scale(1.2);
    }
  }
  
  /* Progress fill effect */
  background: linear-gradient(
    to right,
    ${props => props.accentColor} 0%,
    ${props => props.accentColor} ${(props) => props.value && props.max ? (Number(props.value) / Number(props.max)) * 100 : 0}%,
    rgba(115, 115, 115, 0.3) ${(props) => props.value && props.max ? (Number(props.value) / Number(props.max)) * 100 : 0}%,
    rgba(115, 115, 115, 0.3) 100%
  );
`;

const TimeLabel = styled.span`
  color: ${({ theme }: any) => theme.colors.gray[400]};
  font-size: ${({ theme }: any) => theme.fontSize.sm};
  font-family: monospace;
  min-width: 40px;
  text-align: center;
`;

const TimelineRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: any) => theme.spacing.sm};
  width: 100%;
  margin: 0;
`;

const TimelineLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: any) => theme.spacing.xs};
`;

const TimelineRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: any) => theme.spacing.xs};
`;

// --- SpotifyPlayerControls Component ---
const SpotifyPlayerControls = memo<{
  currentTrack: Track | null;
  accentColor: string;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShowPlaylist: () => void;
  onShowSettings: () => void;
  trackCount: number;
  showVideo: boolean;
  onToggleVideo: () => void;
}>(({ currentTrack, accentColor, onPlay, onPause, onNext, onPrevious, onShowPlaylist, onShowSettings, showVideo, onToggleVideo }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [previousVolume, setPreviousVolume] = useState(50);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikePending, setIsLikePending] = useState(false);

  useEffect(() => {
    const checkPlaybackState = async () => {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setIsPlaying(!state.paused);
        if (!isDragging) {
          setCurrentPosition(state.position);
        }
        if (state.track_window.current_track) {
          setDuration(state.track_window.current_track.duration_ms);
        }
      }
    };

    const interval = setInterval(checkPlaybackState, 1000);
    return () => clearInterval(interval);
  }, [isDragging]);

  useEffect(() => {
    // Set initial volume to 50%
    spotifyPlayer.setVolume(0.5);
    setVolume(50);
    setPreviousVolume(50);
  }, []);

  // Check like status when track changes
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!currentTrack?.id) {
        setIsLiked(false);
        return;
      }

      try {
        setIsLikePending(true);
        const liked = await checkTrackSaved(currentTrack.id);
        setIsLiked(liked);
      } catch (error) {
        console.error('Failed to check like status:', error);
        setIsLiked(false);
      } finally {
        setIsLikePending(false);
      }
    };

    checkLikeStatus();
  }, [currentTrack?.id]);

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    if (newMutedState) {
      // Store current volume before muting
      setPreviousVolume(volume);
      spotifyPlayer.setVolume(0);
    } else {
      // Restore previous volume when unmuting
      const volumeToRestore = previousVolume > 0 ? previousVolume : 50;
      setVolume(volumeToRestore);
      spotifyPlayer.setVolume(volumeToRestore / 100);
    }
  };

  const handleVolumeButtonClick = () => {
    handleMuteToggle();
  };

  const handleLikeToggle = async () => {
    if (!currentTrack?.id || isLikePending) return;

    try {
      setIsLikePending(true);
      
      // Optimistic update
      const newLikedState = !isLiked;
      setIsLiked(newLikedState);

      // Make API call
      if (newLikedState) {
        await saveTrack(currentTrack.id);
      } else {
        await unsaveTrack(currentTrack.id);
      }
    } catch (error) {
      console.error('Failed to toggle like status:', error);
      // Revert optimistic update on error
      setIsLiked(!isLiked);
    } finally {
      setIsLikePending(false);
    }
  };

  const handleSeek = async (position: number) => {
    try {
      const token = await spotifyAuth.ensureValidToken();
      const deviceId = spotifyPlayer.getDeviceId();

      if (!deviceId) {
        console.error('No device ID available for seeking');
        return;
      }

      await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(position)}&device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const position = parseInt(e.target.value);
    setCurrentPosition(position);
  };

  const handleSliderMouseDown = () => {
    setIsDragging(true);
  };

  const handleSliderMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    const position = parseInt((e.target as HTMLInputElement).value);
    setIsDragging(false);
    handleSeek(position);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <PlayerControlsContainer>
      {/* Track Info Row with three columns */}
      <TrackInfoRow style={{ position: 'relative' }}>
        <TrackInfoLeft>
          <PlayerTrackName>{currentTrack?.name || 'No track selected'}</PlayerTrackName>
          <PlayerTrackArtist>{currentTrack?.artists || ''}</PlayerTrackArtist>
        </TrackInfoLeft>
        <TrackInfoCenter>
          
        </TrackInfoCenter>
        <TrackInfoRight>
          <LikeButton
            trackId={currentTrack?.id}
            isLiked={isLiked}
            isLoading={isLikePending}
            accentColor={accentColor}
            onToggleLike={handleLikeToggle}
          />
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
            <ControlButton accentColor={accentColor} onClick={onShowSettings} title="Settings">
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
                </svg>
            </ControlButton>
            <VideoToggleButton isActive={showVideo} onClick={onToggleVideo} title={showVideo ? 'Hide Video' : 'Show Video'}>
            {showVideo ? (
              <svg viewBox="0 0 24 24">
                <path d="M17 10.5V7C17 6.45 16.55 6 16 6H4C3.45 6 3 6.45 3 7V17C3 17.55 3.45 18 4 18H16C16.55 18 17 17.55 17 17V13.5L21 17.5V6.5L17 10.5Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M21 6.5L17 10.5V7C17 6.45 16.55 6 16 6H4C3.45 6 3 6.45 3 7V17C3 17.55 3.45 18 4 18H16C16.55 18 17 17.55 17 17V13.5L21 17.5V6.5M16 16H4V8H16V16M2.41 2.13L1 3.54L4.86 7.4C4.33 7.69 4 8.31 4 9V15C4 16.1 4.9 17 6 17H12C12.69 17 13.31 16.67 13.6 16.14L22.46 25L23.87 23.59L2.41 2.13Z" />
              </svg>
            )}
          </VideoToggleButton>
          <VolumeButton onClick={handleVolumeButtonClick} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? (
              <svg viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
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
        <TimeLabel>{formatTime(currentPosition)}</TimeLabel>
        <TimelineSlider
          type="range"
          min="0"
          max={duration}
          value={currentPosition}
          accentColor={accentColor}
          onChange={handleSliderChange}
          onMouseDown={handleSliderMouseDown}
          onMouseUp={handleSliderMouseUp}
        />
        <TimeLabel>{formatTime(duration)}</TimeLabel>
        <TimelineRight>
          
          <ControlButton accentColor={accentColor} onClick={onPrevious}>
            <svg viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </ControlButton>
          <ControlButton accentColor={accentColor} isPlaying={isPlaying} onClick={handlePlayPause}>
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
     
        </TimelineRight>
      </TimelineRow>
    </PlayerControlsContainer>
  );
});

SpotifyPlayerControls.displayName = 'SpotifyPlayerControls';

export default SpotifyPlayerControls;
// ... existing code ... 