/**
 * @fileoverview AudioPlayer Component
 * 
 * Main audio player interface that orchestrates the entire music playback experience.
 * Integrates Spotify Web Playback SDK, local audio playback, visual effects, and
 * library management into a unified user interface.
 * 
 * @dependencies
 * - unifiedPlayer: Central playback orchestration service
 * - usePlayerState: Global player state management
 * - usePlaylistManager: Playlist and queue management
 * - AlbumArt: Album artwork display with color extraction
 * - VisualEffectsMenu: Visual effects and filters interface
 * - PlaylistDrawer: Playlist browsing and management
 * - LocalLibraryDrawer: Local music library interface
 * 
 * @features
 * - Unified Spotify and local music playback
 * - Dynamic visual effects and color themes
 * - Responsive design with mobile support
 * - Keyboard shortcuts and accessibility
 * - Performance monitoring and optimization
 * 
 * @state
 * - tracks: Current playlist/track collection
 * - currentTrackIndex: Currently playing track position
 * - visualEffectsEnabled: Visual effects toggle state
 * - accentColor: Dynamic theme color from album art
 * - showPlaylist/showLibrary: UI drawer visibility states
 * 
 * @author Vorbis Player Team
 * @version 2.0.0
 */

import { useEffect, useMemo, useCallback, lazy, Suspense, useState } from 'react';
import styled from 'styled-components';
import { spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { CardContent } from '../components/styled';
import { flexCenter, cardBase } from '../styles/utils';
import AlbumArt from './AlbumArt';
import { extractDominantColor } from '../utils/colorExtractor';

const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu'));
const PlaylistDrawer = lazy(() => import('./PlaylistDrawer'));
const LibraryNavigation = lazy(() => import('./LibraryNavigation'));
const LocalLibraryDrawer = lazy(() => import('./LocalLibraryDrawer'));
const SpotifyPlayerControls = lazy(() => import('./SpotifyPlayerControls'));
import PlayerStateRenderer from './PlayerStateRenderer';
import { usePlayerState } from '../hooks/usePlayerState';
import { usePlaylistManager } from '../hooks/usePlaylistManager';
import { theme } from '@/styles/theme';
import { DEFAULT_GLOW_RATE, DEFAULT_GLOW_INTENSITY } from '../utils/colorUtils';
import type { LocalTrack, EnhancedTrack } from '../types/spotify';
import type { DefaultTheme } from 'styled-components';
import { unifiedPlayer, type PlaybackSource } from '../services/unifiedPlayer';
import { isElectron } from '../utils/environment';


const Container = styled.div`
  width: 100%;
  ${flexCenter};
  padding: ${({ theme }: { theme: DefaultTheme }) => theme.spacing.sm};
  
  @media (min-width: ${({ theme }: { theme: DefaultTheme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }: { theme: DefaultTheme }) => theme.spacing.sm};
  }
`;

const ContentWrapper = styled.div`
  width: 1024px;
  height: 1186px;

  @media (max-height: ${theme.breakpoints.lg}) {
    width: 768px;
    height: 922px;
  }

  margin: 0 auto;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  box-sizing: border-box;
  position: absolute;
  -webkit-app-region: no-drag;
  pointer-events: auto;
  z-index: 1000;
`;


const LoadingCard = styled.div.withConfig({
  shouldForwardProp: (prop) => !['backgroundImage', 'standalone', 'accentColor', 'glowEnabled', 'glowIntensity', 'glowRate'].includes(prop),
}) <{
  backgroundImage?: string;
  standalone?: boolean;
  accentColor?: string;
  glowEnabled?: boolean;
  glowIntensity?: number;
  glowRate?: number;
}>`
  ${cardBase};
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid rgba(34, 36, 36, 0.68);
  box-shadow: 0 8px 24px rgba(38, 36, 37, 0.7), 0 2px 8px rgba(22, 21, 21, 0.6);
  ${({ backgroundImage }) => backgroundImage ? `
    &::after {
      content: '';
      position: absolute;
      inset: 0.1rem;
      background-image: url(${backgroundImage});
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      border-radius: 1.25rem;
      z-index: 0;
    }
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(32, 30, 30, 0.7);
      backdrop-filter: blur(40px);
      border-radius: 1.25rem;
      z-index: 1;
    }
  ` : `
    background: rgba(38, 38, 38, 0.5);
    backdrop-filter: blur(12px);
  `}
`;


const AudioPlayerComponent = () => {
  const [showLocalLibraryDrawer, setShowLocalLibraryDrawer] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);

  const {
    tracks,
    currentTrackIndex,
    isLoading,
    error,
    selectedPlaylistId,
    showPlaylist,
    showLibrary,
    accentColor,
    showVisualEffects,
    visualEffectsEnabled,
    setVisualEffectsEnabled,




    accentColorOverrides,
    albumFilters,
    setTracks,
    setCurrentTrackIndex,
    setIsLoading,
    setError,
    setSelectedPlaylistId,
    setShowPlaylist,
    setShowLibrary,
    setAccentColor,
    setShowVisualEffects,



    setAccentColorOverrides,
    handleFilterChange,
    handleResetFilters,
    restoreSavedFilters,
  } = usePlayerState();

  // Set up unified player event listeners for local tracks
  useEffect(() => {
    const handleQueueChanged = ({ queue, currentIndex }: { queue: EnhancedTrack[], currentIndex: number }) => {
      console.log('🎵 Queue changed:', { currentIndex, trackName: queue[currentIndex]?.name });

      // Update UI state to match unified player state
      if (queue.length > 0 && currentIndex >= 0) {
        // Convert all tracks in the queue to UI format
        const uiTracks = queue.map(track => ({
          id: track.id,
          name: track.name,
          artists: track.artists[0].name,
          album: track.album.name,
          duration_ms: track.duration_ms,
          uri: track.uri,
          image: track.album.images[0]?.url,
          source: 'local' as const
        }));

        setCurrentTrackIndex(currentIndex);
        setTracks(uiTracks); // Maintain the full queue
      }
    };

    const handlePlaybackStarted = ({ track, source }: { track: EnhancedTrack | null, source: PlaybackSource }) => {
      console.log('🎵 Playback started:', { trackName: track?.name || 'unknown', source });
      // Note: We'll handle isPlaying state in the SpotifyPlayerControls component
    };

    const handlePlaybackPaused = ({ track, source }: { track: EnhancedTrack | null, source: PlaybackSource }) => {
      console.log('🎵 Playback paused:', { trackName: track?.name || 'unknown', source });
      // Note: We'll handle isPlaying state in the SpotifyPlayerControls component
    };

    const handlePlaybackStopped = ({ track, source }: { track: EnhancedTrack | null, source: PlaybackSource }) => {
      console.log('🎵 Playback stopped:', { trackName: track?.name || 'unknown', source });
      // Note: We'll handle isPlaying state in the SpotifyPlayerControls component
    };

    // Subscribe to unified player events
    unifiedPlayer.on('queueChanged', handleQueueChanged as (...args: unknown[]) => void);
    unifiedPlayer.on('playbackStarted', handlePlaybackStarted as (...args: unknown[]) => void);
    unifiedPlayer.on('playbackPaused', handlePlaybackPaused as (...args: unknown[]) => void);
    unifiedPlayer.on('playbackStopped', handlePlaybackStopped as (...args: unknown[]) => void);

    return () => {
      // Cleanup event listeners
      unifiedPlayer.off('queueChanged', handleQueueChanged as (...args: unknown[]) => void);
      unifiedPlayer.off('playbackStarted', handlePlaybackStarted as (...args: unknown[]) => void);
      unifiedPlayer.off('playbackPaused', handlePlaybackPaused as (...args: unknown[]) => void);
      unifiedPlayer.off('playbackStopped', handlePlaybackStopped as (...args: unknown[]) => void);
    };
  }, [setCurrentTrackIndex, setTracks]);

  // Global glow state (these will be managed by the VisualEffectsMenu)
  const [glowIntensity, setGlowIntensity] = useState(DEFAULT_GLOW_INTENSITY); // Medium
  const [glowRate, setGlowRate] = useState(DEFAULT_GLOW_RATE);
  const [savedGlowIntensity, setSavedGlowIntensity] = useState<number | null>(null);
  const [savedGlowRate, setSavedGlowRate] = useState<number | null>(null);

  // Use global glow settings
  const effectiveGlow = { intensity: glowIntensity, rate: glowRate };

  // Wrapper functions that save settings when glow values change
  const handleGlowIntensityChange = useCallback((intensity: number) => {
    setGlowIntensity(intensity);
    setSavedGlowIntensity(intensity);
  }, []);

  const handleGlowRateChange = useCallback((rate: number) => {
    setGlowRate(rate);
    setSavedGlowRate(rate);
  }, []);

  const playTrack = useCallback(async (index: number) => {
    if (tracks[index]) {
      try {
        // In Electron mode, only handle local tracks
        if (isElectron()) {
          // Local tracks should be handled by the unified player
          // This function will mainly be used for UI track selection
          setCurrentTrackIndex(index);
          return;
        }

        const isAuthenticated = spotifyAuth.isAuthenticated();

        if (!isAuthenticated) {
          return;
        }

        await spotifyPlayer.playTrack(tracks[index].uri);
        setCurrentTrackIndex(index);

        setTimeout(async () => {
          const state = await spotifyPlayer.getCurrentState();
          if (state) {
            if (state.paused && state.position === 0) {
              try {
                await spotifyPlayer.resume();
              } catch (resumeError) {
                console.error('Failed to resume after playback attempt:', resumeError);
              }
            }
          } else {
            try {
              const token = await spotifyAuth.ensureValidToken();
              const deviceId = spotifyPlayer.getDeviceId();

              if (deviceId) {
                await fetch('https://api.spotify.com/v1/me/player', {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    device_ids: [deviceId],
                    play: true
                  })
                });
              }
            } catch (error) {
              console.error('Failed to activate device:', error);
            }
          }
        }, 1500);

      } catch (error) {
        console.error('Failed to play track:', error);
      }
    }
  }, [tracks, setCurrentTrackIndex]);

  const { handlePlaylistSelect: originalHandlePlaylistSelect } = usePlaylistManager({
    setError,
    setIsLoading,
    setSelectedPlaylistId,
    setTracks,
    setCurrentTrackIndex,
    playTrack
  });

  const handlePlaylistSelect = useCallback(async (playlistId: string) => {
    setIsLocalMode(false);
    return originalHandlePlaylistSelect(playlistId);
  }, [originalHandlePlaylistSelect]);

  // Handle local music track selection
  const handleLocalTrackSelect = useCallback(async (track: LocalTrack) => {
    setIsLocalMode(true);
    try {
      const enhancedTrack: EnhancedTrack = {
        ...track,
        id: track.id,
        name: track.name,
        artists: [{ name: track.artist, uri: `local:artist:${track.artist}` }],
        album: {
          name: track.album,
          uri: `local:album:${track.album}`,
          images: track.albumArt ? [{ url: track.albumArt, height: 640, width: 640 }] : []
        },
        duration_ms: track.duration,
        uri: `local:${track.id}`,
        source: 'local',
        filePath: track.filePath,
        format: track.format,
        bitrate: track.bitrate
      };

      // Create Track object for UI state
      const uiTrack = {
        id: track.id,
        name: track.name,
        artists: track.artist,
        album: track.album,
        duration_ms: track.duration,
        uri: `local:${track.id}`,
        image: track.albumArt,
        source: 'local' as const
      };

      // Set up unified player queue with this track
      unifiedPlayer.setQueue([enhancedTrack], 0);

      // Update UI state
      setCurrentTrackIndex(0);
      setTracks([uiTrack]);
      setSelectedPlaylistId('local-library'); // Set a playlist ID for local tracks

    } catch (error) {
      console.error('Failed to play local track:', error);
      setError('Failed to play local music file');
    }
  }, [setCurrentTrackIndex, setTracks, setError, setSelectedPlaylistId, setIsLocalMode]);

  // Handle queuing multiple local tracks
  const handleQueueLocalTracks = useCallback(async (localTracks: LocalTrack[], startIndex = 0) => {
    console.log('🎵 handleQueueLocalTracks called:', {
      tracksCount: localTracks.length,
      startIndex,
      firstTrack: localTracks[0]?.name,
      selectedTrack: localTracks[startIndex]?.name
    });
    try {
      const enhancedTracks: EnhancedTrack[] = localTracks.map(track => ({
        ...track,
        id: track.id,
        name: track.name,
        artists: [{ name: track.artist, uri: `local:artist:${track.artist}` }],
        album: {
          name: track.album,
          uri: `local:album:${track.album}`,
          images: track.albumArt ? [{ url: track.albumArt, height: 640, width: 640 }] : []
        },
        duration_ms: track.duration,
        uri: `local:${track.id}`,
        source: 'local',
        filePath: track.filePath,
        format: track.format,
        bitrate: track.bitrate
      }));

      // Create Track objects for UI state
      const uiTracks = localTracks.map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artist,
        album: track.album,
        duration_ms: track.duration,
        uri: `local:${track.id}`,
        image: track.albumArt,
        source: 'local' as const
      }));

      // Set up the queue
      unifiedPlayer.setQueue(enhancedTracks, startIndex);

      // Start playing
      if (enhancedTracks.length > 0) {
        await unifiedPlayer.loadTrack(enhancedTracks[startIndex], true);
      }

      // Update UI state
      setTracks(uiTracks);
      setCurrentTrackIndex(startIndex);
      setSelectedPlaylistId('local-library'); // Set a playlist ID for local tracks
      setIsLocalMode(true);

    } catch (error) {
      console.error('Failed to queue local tracks:', error);
      setError('Failed to load local music tracks');
    }
  }, [setTracks, setCurrentTrackIndex, setError, setSelectedPlaylistId, setIsLocalMode]);

  useEffect(() => {
    // Skip Spotify authentication in Electron mode
    if (isElectron()) {
      return;
    }

    const handleAuthRedirect = async () => {
      try {
        await spotifyAuth.handleRedirect();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Authentication failed');
      }
    };

    handleAuthRedirect();
  }, [setError]);

  useEffect(() => {
    const handlePlayerStateChange = (state: SpotifyPlaybackState | null) => {
      if (state && state.track_window.current_track) {
        const currentTrack = state.track_window.current_track;
        const trackIndex = tracks.findIndex(track => track.id === currentTrack.id);

        if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
          setCurrentTrackIndex(trackIndex);
        }
      }
    };

    spotifyPlayer.onPlayerStateChanged(handlePlayerStateChange);
  }, [tracks, currentTrackIndex, setCurrentTrackIndex]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let hasEnded = false;

    const checkForSongEnd = async () => {
      try {
        const state = await spotifyPlayer.getCurrentState();
        if (state && state.track_window.current_track && tracks.length > 0) {
          const currentTrack = state.track_window.current_track;
          const duration = currentTrack.duration_ms;
          const position = state.position;
          const timeRemaining = duration - position;

          if (!hasEnded && duration > 0 && position > 0 && (
            timeRemaining <= 2000 ||
            position >= duration - 1000
          )) {

            hasEnded = true;

            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            if (tracks[nextIndex]) {
              setTimeout(() => {
                playTrack(nextIndex);
                hasEnded = false;
              }, 500);
            }
          }
        }
      } catch {
        // Silently handle errors during song end detection
      }
    };

    if (tracks.length > 0) {
      pollInterval = setInterval(checkForSongEnd, 2000);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [tracks, currentTrackIndex, playTrack]);

  const currentTrack = useMemo(() => tracks[currentTrackIndex] || null, [tracks, currentTrackIndex]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;

    // Check if current track is local
    if (currentTrack && (currentTrack as EnhancedTrack).source === 'local') {
      // Use unified player for local tracks
      unifiedPlayer.next();
    } else {
      // Use existing logic for Spotify tracks
      const nextIndex = (currentTrackIndex + 1) % tracks.length;
      playTrack(nextIndex);
    }
  }, [currentTrackIndex, tracks.length, playTrack, currentTrack]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;

    // Check if current track is local
    if (currentTrack && (currentTrack as EnhancedTrack).source === 'local') {
      // Use unified player for local tracks
      unifiedPlayer.previous();
    } else {
      // Use existing logic for Spotify tracks
      const prevIndex = currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
      playTrack(prevIndex);
    }
  }, [currentTrackIndex, tracks.length, playTrack, currentTrack]);

  useEffect(() => {
    const extractColor = async () => {
      if (currentTrack?.id && accentColorOverrides[currentTrack.id]) {
        setAccentColor(accentColorOverrides[currentTrack.id]);
        return;
      }
      if (currentTrack?.image) {
        try {
          const dominantColor = await extractDominantColor(currentTrack.image);
          if (dominantColor) {
            setAccentColor(dominantColor.hex);
          } else {
            setAccentColor(theme.colors.accent);
          }
        } catch {
          setAccentColor(theme.colors.accent);
        }
      } else {
        setAccentColor(theme.colors.accent);
      }
    };
    extractColor();
  }, [currentTrack?.id, currentTrack?.image, accentColorOverrides, setAccentColor]);

  const handlePlay = useCallback(() => {
    if (currentTrack) {
      // Check if it's a local track
      if ((currentTrack as EnhancedTrack).source === 'local') {
        // Use unified player for local tracks
        unifiedPlayer.play();
      } else {
        // Use existing logic for Spotify tracks
        playTrack(currentTrackIndex);
      }
    } else {
      spotifyPlayer.resume();
    }
  }, [currentTrack, currentTrackIndex, playTrack]);

  const handlePause = useCallback(() => {
    // Check if current track is local
    if (currentTrack && (currentTrack as EnhancedTrack).source === 'local') {
      // Use unified player for local tracks
      unifiedPlayer.pause();
    } else {
      // Use Spotify player for Spotify tracks
      spotifyPlayer.pause();
    }
  }, [currentTrack]);

  const handleShowPlaylist = useCallback(() => {
    // If in local mode, show the local library drawer instead
    if (isLocalMode) {
      setShowLocalLibraryDrawer(prev => !prev);
    } else {
      setShowPlaylist(prev => !prev);
    }
    // In Electron mode, we need to ensure the library navigation shows the appropriate view
    // When opening playlist (showPlaylist becomes true), switch to Spotify view
    // When closing playlist (showPlaylist becomes false), switch back to local view
  }, [isLocalMode, setShowPlaylist]);

  const handleShowVisualEffects = useCallback(() => {
    setShowVisualEffects(true);
  }, [setShowVisualEffects]);

  const handleCloseVisualEffects = useCallback(() => {
    setShowVisualEffects(false);
  }, [setShowVisualEffects]);

  const handleVisualEffectsToggle = useCallback(() => {
    if (visualEffectsEnabled) {
      setVisualEffectsEnabled(false);
    } else {
      setVisualEffectsEnabled(true);
      restoreSavedFilters();
      if (savedGlowIntensity !== null) {
        setGlowIntensity(savedGlowIntensity);
      }
      if (savedGlowRate !== null) {
        setGlowRate(savedGlowRate);
      }
    }
  }, [visualEffectsEnabled, restoreSavedFilters, savedGlowIntensity, savedGlowRate, setVisualEffectsEnabled]);

  const handleClosePlaylist = useCallback(() => {
    setShowPlaylist(false);
  }, [setShowPlaylist]);

  const handleCloseLibrary = useCallback(() => {
    setShowLibrary(false);
  }, [setShowLibrary]);

  const handleCloseLocalLibraryDrawer = useCallback(() => {
    setShowLocalLibraryDrawer(false);
  }, []);

  const handleAccentColorChange = useCallback((color: string) => {
    if (color === 'RESET_TO_DEFAULT' && currentTrack?.id) {
      setAccentColorOverrides(prev => {
        const newOverrides = { ...prev };
        delete newOverrides[currentTrack.id!];
        return newOverrides;
      });
      if (currentTrack?.image) {
        extractDominantColor(currentTrack.image)
          .then(dominantColor => {
            if (dominantColor) {
              setAccentColor(dominantColor.hex);
            } else {
              setAccentColor(theme.colors.accent);
            }
          })
          .catch(() => {
            setAccentColor(theme.colors.accent);
          });
      } else {
        setAccentColor(theme.colors.accent);
      }
      return;
    }

    if (currentTrack?.id) {
      setAccentColorOverrides(prev => ({ ...prev, [currentTrack.id]: color }));
      setAccentColor(color);
    } else {
      setAccentColor(color);
    }
  }, [currentTrack?.id, currentTrack?.image, setAccentColorOverrides, setAccentColor]);

  const renderContent = () => {
    const stateRenderer = (
      <PlayerStateRenderer
        isLoading={isLoading}
        error={error}
        selectedPlaylistId={selectedPlaylistId}
        tracks={tracks}
        onPlaylistSelect={handlePlaylistSelect}
      />
    );

    // In Electron mode, always show the full interface with LibraryNavigation
    if (isElectron()) {
      return (
        <ContentWrapper>
          <LoadingCard
            backgroundImage={currentTrack?.image}
            accentColor={accentColor}
            glowEnabled={visualEffectsEnabled}
            glowIntensity={effectiveGlow.intensity}
            glowRate={effectiveGlow.rate}
          >
            <CardContent style={{ position: 'relative', zIndex: 2, marginTop: '-0.25rem' }}>
              {stateRenderer}
            </CardContent>
            <CardContent style={{ position: 'relative', zIndex: 2 }}>
              <AlbumArt
                currentTrack={currentTrack}
                accentColor={accentColor}
                glowIntensity={visualEffectsEnabled ? effectiveGlow.intensity : 0}
                glowRate={effectiveGlow.rate}
                albumFilters={visualEffectsEnabled ? albumFilters : {
                  brightness: 110,
                  contrast: 100,
                  saturation: 100,
                  hue: 0,
                  blur: 0,
                  sepia: 0
                }}
              />
            </CardContent>
            <CardContent style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2 }}>
              <Suspense fallback={<div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>Loading controls...</div>}>
                <SpotifyPlayerControls
                  currentTrack={currentTrack}
                  accentColor={accentColor}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onNext={handleNext}
                  onPrevious={handlePrevious}
                  onShowPlaylist={handleShowPlaylist}
                  trackCount={tracks.length}
                  onAccentColorChange={handleAccentColorChange}
                  onShowVisualEffects={handleShowVisualEffects}
                  glowEnabled={visualEffectsEnabled}
                  onGlowToggle={handleVisualEffectsToggle}
                  isLocalMode={isLocalMode}
                />
              </Suspense>
            </CardContent>
          </LoadingCard>

          {visualEffectsEnabled && (
            <Suspense fallback={<div>Loading effects...</div>}>
              <VisualEffectsMenu
                isOpen={showVisualEffects}
                onClose={handleCloseVisualEffects}
                accentColor={accentColor}
                filters={albumFilters}
                onFilterChange={handleFilterChange}
                onResetFilters={handleResetFilters}
                glowIntensity={glowIntensity}
                setGlowIntensity={handleGlowIntensityChange}
                glowRate={glowRate}
                setGlowRate={handleGlowRateChange}
                effectiveGlow={effectiveGlow}
              />
            </Suspense>
          )}

          {showLibrary && (
            <Suspense fallback={<div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '400px', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>Loading library...</div>}>
              <LibraryNavigation
                onTrackSelect={handleLocalTrackSelect}
                onQueueTracks={handleQueueLocalTracks}
                onPlaylistSelect={handlePlaylistSelect}
                showPlaylist={showPlaylist}
                activeSource={showPlaylist ? 'spotify' : 'local'}
                onClose={handleCloseLibrary}
              />
            </Suspense>
          )}

          <Suspense fallback={<div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '80vh', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>Loading library...</div>}>
            <LocalLibraryDrawer
              isOpen={showLocalLibraryDrawer}
              onClose={handleCloseLocalLibraryDrawer}
              onTrackSelect={handleLocalTrackSelect}
              onQueueTracks={handleQueueLocalTracks}
              currentTrackId={currentTrack?.id}
              accentColor={accentColor}
            />
          </Suspense>
        </ContentWrapper>
      );
    }

    // Web mode - only show full interface when ready
    if (stateRenderer.props.isLoading || stateRenderer.props.error || !stateRenderer.props.selectedPlaylistId || stateRenderer.props.tracks.length === 0) {
      return stateRenderer;
    }

    return (
      <ContentWrapper>
        <LoadingCard
          backgroundImage={currentTrack?.image}
          accentColor={accentColor}
          glowEnabled={visualEffectsEnabled}
          glowIntensity={effectiveGlow.intensity}
          glowRate={effectiveGlow.rate}
        >

          <CardContent style={{ position: 'relative', zIndex: 2, marginTop: '-0.25rem' }}>
            <AlbumArt currentTrack={currentTrack} accentColor={accentColor} glowIntensity={visualEffectsEnabled ? effectiveGlow.intensity : 0} glowRate={effectiveGlow.rate} albumFilters={visualEffectsEnabled ? albumFilters : {
              brightness: 110,
              contrast: 100,
              saturation: 100,
              hue: 0,
              blur: 0,
              sepia: 0
            }} />
          </CardContent>
          <CardContent style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2 }}>
            <Suspense fallback={<div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>Loading controls...</div>}>
              <SpotifyPlayerControls
                currentTrack={currentTrack}
                accentColor={accentColor}
                onPlay={handlePlay}
                onPause={handlePause}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onShowPlaylist={handleShowPlaylist}
                trackCount={tracks.length}
                onAccentColorChange={handleAccentColorChange}
                onShowVisualEffects={handleShowVisualEffects}
                glowEnabled={visualEffectsEnabled}
                onGlowToggle={handleVisualEffectsToggle}
                isLocalMode={isLocalMode}
              />
            </Suspense>
          </CardContent>
          {visualEffectsEnabled && <Suspense fallback={<div>Loading effects...</div>}>
            <VisualEffectsMenu
              isOpen={showVisualEffects}
              onClose={handleCloseVisualEffects}
              accentColor={accentColor}
              filters={albumFilters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
              glowIntensity={glowIntensity}
              setGlowIntensity={handleGlowIntensityChange}
              glowRate={glowRate}
              setGlowRate={handleGlowRateChange}
              effectiveGlow={effectiveGlow}
            />
          </Suspense>}
        </LoadingCard>

        <Suspense fallback={<div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>Loading playlist...</div>}>
          <PlaylistDrawer
            isOpen={showPlaylist}
            onClose={handleClosePlaylist}
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            accentColor={accentColor}
            onTrackSelect={playTrack}
          />
        </Suspense>

        <Suspense fallback={<div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '400px', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>Loading library...</div>}>
          <LibraryNavigation
            onTrackSelect={handleLocalTrackSelect}
            onQueueTracks={handleQueueLocalTracks}
            onPlaylistSelect={handlePlaylistSelect}
            showPlaylist={showPlaylist}
          />
        </Suspense>

      </ContentWrapper>
    );
  };

  return (
    <Container>
      {renderContent()}
    </Container>
  );
};

export default AudioPlayerComponent;
