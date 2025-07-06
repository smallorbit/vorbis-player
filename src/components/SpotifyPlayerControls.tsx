import { useState, useEffect, memo, useRef, useLayoutEffect } from 'react';
import styled from 'styled-components';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { spotifyAuth, checkTrackSaved, saveTrack, unsaveTrack } from '../services/spotify';
import type { Track } from '../services/spotify';
import LikeButton from './LikeButton';
import EyedropperOverlay from './EyedropperOverlay';
import { extractTopVibrantColors } from '../utils/colorExtractor';
import type { ExtractedColor } from '../utils/colorExtractor';
import { createPortal } from 'react-dom';

// --- Styled Components ---
const PlayerControlsContainer = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }: any) => theme.spacing.sm};
  padding: ${({ theme }: any) => theme.spacing.xs} ${({ theme }: any) => theme.spacing.md} ${({ theme }: any) => theme.spacing.md} ${({ theme }: any) => theme.spacing.md};
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

const ControlButton = styled.button<{ isActive?: boolean; accentColor: string }>`
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
  
  ${({ isActive, accentColor }) => isActive ? `
    background: ${accentColor};
    color: #fff; // ${accentColor}99;
    
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

// Add Dropper SVG icon
const DropperIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19.07 4.93a3 3 0 0 1 0 4.24l-1.41 1.41-4.24-4.24 1.41-1.41a3 3 0 0 1 4.24 0z" /><path d="M17.66 7.34L6 19v3h3L20.66 10.34" /></svg>
);

// --- SpotifyPlayerControls Component ---
const SpotifyPlayerControls = memo<{
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
}>(({ currentTrack, accentColor, onPlay, onPause, onNext, onPrevious, onShowPlaylist, onAccentColorChange, onShowVisualEffects, showVisualEffects }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [previousVolume, setPreviousVolume] = useState(50);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikePending, setIsLikePending] = useState(false);
  const [colorOptions, setColorOptions] = useState<ExtractedColor[] | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const paletteBtnRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);
  const [showEyedropper, setShowEyedropper] = useState(false);
  // Custom accent color per track (from eyedropper)
  const [customAccentColorOverrides, setCustomAccentColorOverrides] = useState<Record<string, string>>({});

  // Load custom accent color overrides from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('customAccentColorOverrides');
    if (stored) {
      try {
        setCustomAccentColorOverrides(JSON.parse(stored));
      } catch (e) {
        // ignore parse errors
      }
    }
  }, []);

  // Get the last chosen custom color for the current track
  const getLastCustomColor = () => {
    return currentTrack?.id ? customAccentColorOverrides[currentTrack.id] : null;
  };

  // Save custom accent color overrides to localStorage when changed
  useEffect(() => {
    localStorage.setItem('customAccentColorOverrides', JSON.stringify(customAccentColorOverrides));
  }, [customAccentColorOverrides]);


  // When user picks a color with the eyedropper, store it as the custom color for this track
  const handleCustomAccentColor = (color: string) => {
    if (currentTrack?.id) {
      setCustomAccentColorOverrides(prev => ({ ...prev, [currentTrack.id!]: color }));
      onAccentColorChange?.(color);
    } else {
      onAccentColorChange?.(color);
    }
  };

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
  }, [showColorPopover, currentTrack?.image]);

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
          <LikeButton
            trackId={currentTrack?.id}
            isLiked={isLiked}
            isLoading={isLikePending}
            accentColor={accentColor}
            onToggleLike={handleLikeToggle}
          />

        </TrackInfoRight>
      </TrackInfoRow>

      {/* Timeline Row with time, slider, and right controls */}
      <TimelineRow>
        <TimelineLeft>
          <ControlButton accentColor={accentColor} onClick={onShowVisualEffects} isActive={showVisualEffects} title="Visual effects">
            <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path d="M20.71,4.63L19.37,3.29C19,2.9 18.35,2.9 17.96,3.29L9,12.25L11.75,15L20.71,6.04C21.1,5.65 21.1,5 20.71,4.63M7,14A3,3 0 0,0 4,17C4,18.31 2.84,19 2,19C2.92,20.22 4.5,21 6,21A4,4 0 0,0 10,17A3,3 0 0,0 7,14Z" />
            </svg>
          </ControlButton>
          <ControlButton
            accentColor={accentColor}
            onClick={() => setShowColorPopover(v => !v)}
            title="Theme options"
            ref={paletteBtnRef}
            style={{ position: 'relative' }}
          >
            {/* Palette SVG icon with dynamic fill */}
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" role="img">
              <path d="M21 12.79A9 9 0 1 1 12 3a7 7 0 0 1 7 7c0 1.38-.56 2.63-1.46 3.54-.63.63-.54 1.71.21 2.21a2 2 0 0 0 2.25.13z" fill={accentColor} />
              <circle cx="8.5" cy="10.5" r="1" fill="#fff" />
              <circle cx="12" cy="7.5" r="1" fill="#fff" />
              <circle cx="15.5" cy="10.5" r="1" fill="#fff" />
              <circle cx="12" cy="14.5" r="1" fill="#fff" />
            </svg>
          </ControlButton>
          {/* Popover menu rendered in portal, outside the button */}
          {showColorPopover && popoverPos && createPortal(
            <div
              ref={popoverRef}
              style={{
                position: 'fixed',
                left: popoverPos.left,
                top: popoverPos.top,
                transform: 'translate(-50%, -100%)',
                background: '#232323',
                borderRadius: 12,
                boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                padding: '1rem 1.25rem',
                zIndex: 9999,
                minWidth: 160,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: 8, fontSize: 15 }}>Choose Accent Color</div>
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19.07 4.93a3 3 0 0 1 0 4.24l-1.41 1.41-4.24-4.24 1.41-1.41a3 3 0 0 1 4.24 0z" />
                      <path d="M17.66 7.34L6 19v3h3L20.66 10.34" />
                    </svg>
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
                        // background: '#181818',
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
          {showEyedropper && currentTrack?.image && (
            createPortal(
              <EyedropperOverlay
                image={currentTrack.image}
                onPick={handleCustomAccentColor}
                onClose={() => setShowEyedropper(false)}
              />,
              document.body
            )
          )}

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
          <ControlButton accentColor={accentColor} onClick={onShowPlaylist} title="Show Playlist">
            <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
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