import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { flexCenter } from '@/styles/utils';
import PlayerStateRenderer from './PlayerStateRenderer';
import PlayerContent from './PlayerContent';
import BackgroundVisualizer from './BackgroundVisualizer';
import AccentColorBackground from './AccentColorBackground';
import DebugOverlay, { useDebugActivator } from './DebugOverlay';
import ProviderSetupScreen from './ProviderSetupScreen';
import VorbisQueueDialog from './VorbisQueueDialog';
import { ProfilingProvider } from '@/contexts/ProfilingContext';
import { ProfilingOverlay } from '@/components/ProfilingOverlay';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { usePlayerLogic, mediaTrackToTrack } from '@/hooks/usePlayerLogic';
import { useColorContext } from '@/contexts/ColorContext';
import { useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { useTrackContext } from '@/contexts/TrackContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import type { ProviderSwitchInterceptor } from '@/contexts/ProviderContext';
import { resolveViaSpotify } from '@/services/spotifyResolver';
import { toAlbumPlaylistId } from '@/constants/playlist';

const Container = styled.div`
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  ${flexCenter};
`;

const AudioPlayerComponent = () => {
  const { state, handlers, radio, mediaTracksRef, setTracks, setOriginalTracks } = usePlayerLogic();
  const { debugActive, handleActivatorTap } = useDebugActivator();
  const { accentColor } = useColorContext();
  const {
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    accentColorBackgroundEnabled,
    zenModeEnabled,
  } = useVisualEffectsContext();
  const { tracks, selectedPlaylistId, currentTrack } = useTrackContext();

  const handleAlbumPlay = useCallback((albumId: string, _albumName: string) => {
    handlers.handlePlaylistSelect(toAlbumPlaylistId(albumId));
  }, [handlers]);

  const playbackHandlers = useMemo(() => ({
    onPlay: handlers.handlePlay,
    onPause: handlers.handlePause,
    onNext: handlers.handleNext,
    onPrevious: handlers.handlePrevious,
    onTrackSelect: handlers.playTrack,
    onOpenLibraryDrawer: handlers.handleOpenLibraryDrawer,
    onCloseLibraryDrawer: handlers.handleCloseLibraryDrawer,
    onPlaylistSelect: handlers.handlePlaylistSelect,
    onAlbumPlay: handleAlbumPlay,
    onBackToLibrary: handlers.handleBackToLibrary,
    onStartRadio: handlers.handleStartRadio,
  }), [handlers, handleAlbumPlay]);

  const { chosenProviderId, activeDescriptor, setProviderSwitchInterceptor } = useProviderContext();
  const needsSetup = chosenProviderId === null || !activeDescriptor?.auth.isAuthenticated();

  // VorbisQueueDialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [removedCount, setRemovedCount] = useState<number | null>(null);
  const proceedSwitchRef = useRef<(() => void) | null>(null);

  // Register provider switch interceptor when radio is active
  useEffect(() => {
    if (!radio?.isActive) {
      setProviderSwitchInterceptor(null);
      return;
    }
    const interceptor: ProviderSwitchInterceptor = (_newId, proceed, _cancel) => {
      proceedSwitchRef.current = proceed;
      setRemovedCount(null);
      setIsResolving(false);
      setDialogOpen(true);
    };
    setProviderSwitchInterceptor(interceptor);
    return () => setProviderSwitchInterceptor(null);
  }, [radio?.isActive, setProviderSwitchInterceptor]);

  const handleDialogDismiss = useCallback(() => {
    setDialogOpen(false);
    proceedSwitchRef.current = null;
    setRemovedCount(null);
    setIsResolving(false);
  }, []);

  const handleStartFresh = useCallback(() => {
    radio?.stopRadio();
    proceedSwitchRef.current?.();
    setDialogOpen(false);
    proceedSwitchRef.current = null;
    setRemovedCount(null);
    setIsResolving(false);
  }, [radio]);

  const handleKeepQueue = useCallback(async () => {
    setIsResolving(true);
    try {
      const mediaTracks = mediaTracksRef.current;
      const dropboxTracks = mediaTracks.filter((t) => t.provider === 'dropbox');
      const spotifyTracks = mediaTracks.filter((t) => t.provider === 'spotify');

      const resolved = await resolveViaSpotify(
        dropboxTracks.map((t) => ({ artist: t.artists, name: t.name, matchScore: 1 })),
      );

      const dropped = dropboxTracks.length - resolved.length;
      const resolvedQueue = [...spotifyTracks, ...resolved];

      mediaTracksRef.current = resolvedQueue;
      const trackList = resolvedQueue.map(mediaTrackToTrack);
      setOriginalTracks(trackList);
      setTracks(trackList);

      setIsResolving(false);
      setRemovedCount(dropped);
      proceedSwitchRef.current?.();
      proceedSwitchRef.current = null;
    } catch {
      setIsResolving(false);
      handleDialogDismiss();
    }
  }, [mediaTracksRef, setTracks, setOriginalTracks, handleDialogDismiss]);

  const currentTrackProvider = currentTrack?.provider;

  const autoSelectFired = useRef(false);
  useEffect(() => {
    if (needsSetup || autoSelectFired.current || selectedPlaylistId !== null) return;
    const params = new URLSearchParams(window.location.search);
    const playlistParam = params.get('playlist');
    if (!playlistParam) return;
    autoSelectFired.current = true;
    window.history.replaceState({}, '', '/');
    handlers.handlePlaylistSelect(playlistParam);
  }, [needsSetup, selectedPlaylistId, handlers]);

  const isMainPlayerActive = !state.isLoading && !state.error && selectedPlaylistId !== null && tracks.length > 0;

  const renderContent = () => {
    if (needsSetup) {
      return <ProviderSetupScreen />;
    }

    if (state.isLoading || state.error || selectedPlaylistId === null || tracks.length === 0) {
      return (
        <ProfiledComponent id="PlayerStateRenderer">
          <PlayerStateRenderer
            isLoading={state.isLoading}
            error={state.error}
            selectedPlaylistId={selectedPlaylistId}
            tracks={tracks}
            onPlaylistSelect={handlers.handlePlaylistSelect}
          />
        </ProfiledComponent>
      );
    }

    return (
      <ProfiledComponent id="PlayerContent">
        <PlayerContent
          isPlaying={state.isPlaying}
          showLibraryDrawer={state.showLibraryDrawer}
          handlers={playbackHandlers}
          radioState={radio.radioState}
          isRadioAvailable={radio.isRadioAvailable}
          radioActive={radio.isActive}
          currentTrackProvider={currentTrackProvider}
          spotifyAuthExpired={radio.spotifyAuthExpired}
          onClearSpotifyAuthExpired={radio.clearSpotifyAuthExpired}
        />
      </ProfiledComponent>
    );
  };

  return (
    <ProfilingProvider>
      <Container>
        <DebugOverlay active={debugActive} />
        <ProfilingOverlay />
        {/* 5 rapid taps in top-left corner toggles debug overlay */}
        <div
          onClick={handleActivatorTap}
          style={{ position: 'fixed', top: 0, left: 0, width: 44, height: 44, zIndex: 999990 }}
        />
        <ProfiledComponent id="AccentColorBackground">
          <AccentColorBackground
            enabled={accentColorBackgroundEnabled && isMainPlayerActive}
            accentColor={accentColor}
          />
        </ProfiledComponent>
        <ProfiledComponent id="BackgroundVisualizer">
          <BackgroundVisualizer
            enabled={backgroundVisualizerEnabled && isMainPlayerActive}
            style={backgroundVisualizerStyle}
            intensity={backgroundVisualizerIntensity}
            accentColor={accentColor}
            isPlaying={state.isPlaying}
            playbackPosition={state.playbackPosition}
            zenMode={zenModeEnabled}
          />
        </ProfiledComponent>
        {renderContent()}
        <VorbisQueueDialog
          isOpen={dialogOpen}
          isResolving={isResolving}
          removedCount={removedCount}
          onKeepQueue={handleKeepQueue}
          onStartFresh={handleStartFresh}
          onDismiss={handleDialogDismiss}
        />
      </Container>
    </ProfilingProvider>
  );
};

export default AudioPlayerComponent;
