import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { flexCenter, srOnly } from '@/styles/utils';
import { theme } from '@/styles/theme';
import PlayerStateRenderer from './PlayerStateRenderer';
import PlayerContent from './PlayerContent';
import BackgroundVisualizer from './BackgroundVisualizer';
import AccentColorBackground from './AccentColorBackground';
import DebugOverlay, { useDebugActivator } from './DebugOverlay';
import ProviderSetupScreen from './ProviderSetupScreen';
import { toast } from 'sonner';
import { ProfilingProvider } from '@/contexts/ProfilingContext';
import { ProfilingOverlay } from '@/components/ProfilingOverlay';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { usePlayerLogic } from '@/hooks/usePlayerLogic';
import { useColorContext } from '@/contexts/ColorContext';
import {
  useAccentColorBackground,
  useVisualEffectsToggle,
  useVisualizer,
} from '@/contexts/visualEffects';
import { PlayerSizingProvider } from '@/contexts/PlayerSizingContext';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { LIKED_SONGS_NAME } from '@/constants/playlist';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import { decodeLegacySelection } from '@/services/sessionPersistence';
import { queueStore } from '@/stores/queueStore';
import QuickAccessPanel from './QuickAccessPanel';
import { CmdKPalette } from './CmdKPalette';
import type { CollectionSelection, MediaCollection, MediaTrack } from '@/types/domain';
import { collectionToRef, keyToCollectionRef } from '@/types/domain';
import type { SearchArtist } from '@/services/cache/librarySearch';

const Settings = lazy(() => import('./Settings'));
const LibraryRoute = lazy(() => import('./LibraryRoute'));

const RESUME_TOAST_ID = 'resume-toast';
const FALLTHROUGH_TOAST_ID = 'fallthrough-toast';
const DISCONNECT_TOAST_ID = 'disconnect-toast';

const Container = styled.div`
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  ${flexCenter};
`;

const QuickAccessOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.zIndex.banner};
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 60px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
`;

const ScreenReaderAnnouncement = styled.div`
  ${srOnly}
`;

const AudioPlayerComponent = () => {
  const { state, handlers, radio, currentPlaybackProviderRef: playbackProviderRef, expectedTrackIdRef } = usePlayerLogic();
  const { debugActive, handleActivatorTap } = useDebugActivator();
  const { accentColor } = useColorContext();
  const {
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    backgroundVisualizerSpeed,
  } = useVisualizer();
  const { accentColorBackgroundEnabled } = useAccentColorBackground();
  const { isSettingsOpen, setIsSettingsOpen } = useVisualEffectsToggle();
  const { tracks, selection, setSelection } = useTrackListContext();
  const { currentTrack, currentTrackIndex, showQueue, setShowQueue } = useCurrentTrackContext();

  const resolveDisplayProvider = useCallback((): import('@/types/domain').ProviderId | undefined => (
    currentTrack?.provider
    ?? playbackProviderRef.current
    ?? undefined
  ), [currentTrack, playbackProviderRef]);

  // Track the current playback provider — derives from the ref but as React state for re-renders
  const [displayProviderId, setDisplayProviderId] = useState<import('@/types/domain').ProviderId | undefined>(
    resolveDisplayProvider()
  );
  useEffect(() => {
    setDisplayProviderId(resolveDisplayProvider());
  }, [resolveDisplayProvider]);

  const collectionNameRef = useRef<string>('');
  const pendingLibraryQueryRef = useRef<string | undefined>(undefined);

  const getLivePosition = useCallback(async (): Promise<number | null> => {
    const drivingId = playbackProviderRef.current;
    if (!drivingId) return null;
    const { providerRegistry } = await import('@/providers/registry');
    const descriptor = providerRegistry.get(drivingId);
    const ps = await descriptor?.playback.getState();
    return ps?.positionMs ?? null;
  }, [playbackProviderRef]);

  const { lastSession, resetLastSession } = useSessionPersistence(
    selection,
    collectionNameRef.current,
    tracks,
    currentTrackIndex,
    currentTrack?.id,
    currentTrack?.name,
    currentTrack?.artists,
    currentTrack?.image,
    state.playbackPosition,
    getLivePosition,
  );

  const handleAlbumPlay = useCallback((albumId: string, albumName: string) => {
    const provider = currentTrack?.provider ?? 'spotify';
    collectionNameRef.current = albumName;
    handlers.loadCollection({
      type: 'collection',
      ref: { provider, kind: 'album', id: albumId },
      name: albumName,
    });
  }, [handlers, currentTrack?.provider]);

  const handleSelectCollection = useCallback(
    (collectionSelection: CollectionSelection) => {
      if (collectionSelection.name) collectionNameRef.current = collectionSelection.name;
      handlers.loadCollection(collectionSelection);
    },
    [handlers]
  );

  const handleCmdKSelectTrack = useCallback(
    (track: MediaTrack) => {
      const result = handlers.insertTracksNext([track], track.name);
      if (result && result.added > 0) {
        toast(`Added "${track.name}" to play next.`, {
          id: 'cmdk-add-track',
          action: {
            label: 'View',
            onClick: () => {
              handlers.handleCloseLibrary();
              setShowQueue(true);
            },
          },
        });
      }
    },
    [handlers, setShowQueue],
  );

  const handleCmdKInsertCollectionNext = useCallback(
    async (collectionSelection: CollectionSelection) => {
      const name = collectionSelection.name ?? '';
      const result = await handlers.insertCollectionNext(collectionSelection);
      if (result && result.added > 0) {
        const trackWord = result.added === 1 ? 'track' : 'tracks';
        toast(`Added ${result.added} ${trackWord} from "${name}" to play next.`, {
          id: 'cmdk-add-collection',
          action: {
            label: 'View',
            onClick: () => {
              handlers.handleCloseLibrary();
              setShowQueue(true);
            },
          },
        });
      }
      return result;
    },
    [handlers, setShowQueue],
  );

  const handleCmdKSelectAlbum = useCallback(
    (album: MediaCollection) => {
      void handleCmdKInsertCollectionNext({ type: 'collection', ref: collectionToRef(album), name: album.name });
    },
    [handleCmdKInsertCollectionNext],
  );

  const handleCmdKSelectPlaylist = useCallback(
    (playlist: MediaCollection) => {
      void handleCmdKInsertCollectionNext({ type: 'collection', ref: collectionToRef(playlist), name: playlist.name });
    },
    [handleCmdKInsertCollectionNext],
  );

  const handleCmdKSelectArtist = useCallback((_artist: SearchArtist) => {
    // #1408 deferral: there is no programmatic "filter Library by artist"
    // mechanism today. Falling back to opening Library without a filter so the
    // user can navigate to the artist manually. A follow-up should add a
    // proper artist-filter route into Library.
    handlers.handleOpenLibrary();
  }, [handlers]);

  const [showQuickAccessPanel, setShowQuickAccessPanel] = useState(false);
  const handleOpenQuickAccessPanel = useCallback(() => setShowQuickAccessPanel(true), []);
  const handleCloseQuickAccessPanel = useCallback(() => setShowQuickAccessPanel(false), []);

  const handleHydrateFired = useCallback((track: import('@/types/domain').MediaTrack, skipped: boolean) => {
    // Hydrate has been consumed — clear the saved session so a subsequent
    // collection load (which transiently shows isLoading=true and remounts
    // PlayerStateRenderer) doesn't trigger a second hydrate that would
    // overwrite the just-loaded collection's index and position with the
    // resumed session's.
    resetLastSession();
    const message = skipped
      ? `Couldn't resume previous track — starting from next in queue.`
      : `Resuming '${track.name}' — press play to continue.`;
    toast(message, { id: RESUME_TOAST_ID, duration: Infinity });
  }, [resetLastSession]);
  const handleHydrateFailed = useCallback(() => {
    resetLastSession();
    toast(`Couldn't resume your last session.`, { id: RESUME_TOAST_ID, duration: Infinity });
  }, [resetLastSession]);
  const withResumeDismiss = useCallback(
    // Generic-recovery cast: TS can't re-derive T from the wrapper's parameter list.
    <T extends (...args: never[]) => unknown>(fn: T): T => ((...args) => {
      toast.dismiss(RESUME_TOAST_ID);
      return fn(...args);
    }) as T,
    [],
  );
  const handleOpenLibraryWithQuery = useCallback((query: string) => {
    pendingLibraryQueryRef.current = query;
    withResumeDismiss(handlers.handleOpenLibrary)();
  }, [handlers, withResumeDismiss]);
  useEffect(() => {
    if (showQueue) toast.dismiss(RESUME_TOAST_ID);
  }, [showQueue]);
  const handleLibraryPlayNext = useCallback(
    async (collectionSelection: CollectionSelection) => {
      const name = collectionSelection.name ?? '';
      const result = await handlers.insertCollectionNext(collectionSelection);
      if (result && result.added > 0) {
        const trackWord = result.added === 1 ? 'track' : 'tracks';
        toast(`Added ${result.added} ${trackWord} from "${name}" to play next.`, {
          id: 'lib-play-next',
          action: {
            label: 'View',
            onClick: () => {
              handlers.handleCloseLibrary();
              setShowQueue(true);
            },
          },
        });
      }
    },
    [handlers, setShowQueue],
  );

  const handleAddToQueueFromPanel = useCallback(
    async (collectionSelection: CollectionSelection) => {
      const result = await handlers.handleAddToQueue(collectionSelection);
      if (result && result.added > 0) {
        const title = result.collectionName?.trim();
        const label = title ? `"${title}"` : 'this collection';
        const trackWord = result.added === 1 ? 'track' : 'tracks';
        toast(`Added ${result.added} ${trackWord} from ${label} to your queue.`, {
          id: 'qap-add-queue',
          action: {
            label: 'View',
            onClick: () => {
              handlers.handleCloseLibrary();
              setShowQueue(true);
            },
          },
        });
      }
      return result;
    },
    [handlers, setShowQueue],
  );

  const handlePlayLikedTracks = useCallback(
    async (likedTracks: import('@/types/domain').MediaTrack[], collectionSelection: CollectionSelection) => {
      collectionNameRef.current = collectionSelection.name ?? '';
      await handlers.playTracksDirectly(likedTracks, collectionSelection);
    },
    [handlers],
  );

  const handleQueueLikedTracks = useCallback(
    (likedTracks: import('@/types/domain').MediaTrack[], collectionName?: string) => {
      const result = handlers.queueTracksDirectly(likedTracks, collectionName);
      if (result && result.added > 0) {
        const title = result.collectionName?.trim();
        const label = title ? `"${title}"` : 'this collection';
        const trackWord = result.added === 1 ? 'track' : 'tracks';
        toast(`Added ${result.added} liked ${trackWord} from ${label} to your queue.`, {
          id: 'qap-queue-liked',
          action: {
            label: 'View',
            onClick: () => {
              handlers.handleCloseLibrary();
              setShowQueue(true);
            },
          },
        });
      }
    },
    [handlers, setShowQueue],
  );

  const playbackHandlers = useMemo(() => {
    const onOpenLibrary = withResumeDismiss(handlers.handleOpenLibrary);
    return {
      onPlay: withResumeDismiss(handlers.handlePlay),
      onPause: withResumeDismiss(handlers.handlePause),
      onNext: withResumeDismiss(handlers.handleNext),
      onPrevious: withResumeDismiss(handlers.handlePrevious),
      onTrackSelect: handlers.playTrack,
      onOpenLibrary,
      onOpenLibraryWithQuery: handleOpenLibraryWithQuery,
      onCloseLibrary: handlers.handleCloseLibrary,
      onOpenQuickAccessPanel: handleOpenQuickAccessPanel,
      onSelectCollection: handleSelectCollection,
      onAddToQueue: handlers.handleAddToQueue,
      onPlayLikedTracks: handlePlayLikedTracks,
      onQueueLikedTracks: handleQueueLikedTracks,
      onAlbumPlay: handleAlbumPlay,
      onBackToLibrary: onOpenLibrary,
      onStartRadio: handlers.handleStartRadio,
      onRemoveFromQueue: handlers.handleRemoveFromQueue,
      onReorderQueue: handlers.handleReorderQueue,
    };
  }, [
    handlers,
    handleAlbumPlay,
    handleOpenLibraryWithQuery,
    handleSelectCollection,
    handleOpenQuickAccessPanel,
    handlePlayLikedTracks,
    handleQueueLikedTracks,
    withResumeDismiss,
  ]);

  const { chosenProviderId, activeDescriptor, connectedProviderIds, fallthroughNotification, dismissFallthroughNotification, disconnectToast, dismissDisconnectToast } = useProviderContext();

  useEffect(() => {
    if (!fallthroughNotification) return;
    toast(fallthroughNotification, {
      id: FALLTHROUGH_TOAST_ID,
      onDismiss: dismissFallthroughNotification,
      onAutoClose: dismissFallthroughNotification,
    });
  }, [fallthroughNotification, dismissFallthroughNotification]);

  useEffect(() => {
    if (!disconnectToast) return;
    toast(disconnectToast, {
      id: DISCONNECT_TOAST_ID,
      onDismiss: dismissDisconnectToast,
      onAutoClose: dismissDisconnectToast,
    });
  }, [disconnectToast, dismissDisconnectToast]);

  // Setup is needed when no provider has been chosen yet and none are connected,
  // or when the active provider isn't authenticated and no other enabled provider is either.
  // connectedProviderIds is the subset of enabledProviderIds with valid auth.
  const needsSetup = chosenProviderId === null
    ? connectedProviderIds.length === 0
    : !activeDescriptor?.auth.isAuthenticated() && connectedProviderIds.length === 0;

  const autoSelectFired = useRef(false);
  useEffect(() => {
    if (needsSetup || autoSelectFired.current || selection !== null) return;
    const params = new URLSearchParams(window.location.search);
    const playlistParam = params.get('playlist');
    if (!playlistParam) return;
    autoSelectFired.current = true;
    window.history.replaceState({}, '', '/');

    // Structured `provider:kind:id` keys let the mock catalog resolve by snapshot id
    // instead of falling through to the Spotify SDK; raw legacy ids
    // ('liked-songs', 'album:X', bare id) go through the shared legacy decoder.
    const ref = keyToCollectionRef(playlistParam);
    if (ref) {
      if (ref.kind === 'liked') {
        handlers.loadCollection({ type: 'liked', provider: ref.provider, name: LIKED_SONGS_NAME });
      } else {
        handlers.loadCollection({ type: 'collection', ref });
      }
    } else {
      const legacy = decodeLegacySelection(playlistParam, activeDescriptor?.id, playlistParam);
      if (legacy.type !== 'radio') {
        handlers.loadCollection(legacy);
      }
    }
  }, [needsSetup, selection, handlers, activeDescriptor]);

  const isMainPlayerActive = !state.isLoading && !state.error && selection !== null && tracks.length > 0;

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, [setIsSettingsOpen]);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, [setIsSettingsOpen]);

  const handleResume = useCallback(async () => {
    if (!lastSession?.queueTracks?.length) return;
    const { queueTracks, trackId, trackIndex, selection: savedSelection, playbackPosition: savedPositionMs } = lastSession;
    const targetIdx = trackId
      ? queueTracks.findIndex(t => t.id === trackId)
      : Math.min(trackIndex, queueTracks.length - 1);
    const resolvedIdx = targetIdx >= 0 ? targetIdx : Math.min(trackIndex, queueTracks.length - 1);
    // The store update is synchronous, so playTrack resolves the right track
    // inside the same user-gesture call stack. Required for iOS Safari, which
    // blocks audio.play() called outside it.
    queueStore.replaceQueue(queueTracks, { currentIndex: resolvedIdx });
    setSelection(savedSelection);
    // Guard the playback subscription against index-sync racing during load:
    // without this, usePlaybackSubscription may overwrite resolvedIdx with a
    // stale provider track index before the new track's ID is confirmed.
    expectedTrackIdRef.current = queueTracks[resolvedIdx]?.id ?? null;

    const positionMs = savedPositionMs && savedPositionMs > 0 ? savedPositionMs : undefined;
    await handlers.playTrack(resolvedIdx, false, positionMs ? { positionMs } : undefined);
  }, [lastSession, setSelection, expectedTrackIdRef, handlers]);

  const renderContent = () => {
    if (needsSetup) {
      return (
        <ProviderSetupScreen
          onOpenSettings={handleOpenSettings}
          onOpenLibrary={handlers.handleOpenLibrary}
        />
      );
    }

    if (state.isLoading || state.error || selection === null || tracks.length === 0) {
      return (
        <>
          <ProfiledComponent id="PlayerStateRenderer">
            <PlayerStateRenderer
              isLoading={state.isLoading}
              error={state.error}
              selection={selection}
              tracks={tracks}
              onSelectCollection={handleSelectCollection}
              onAddToQueue={handleAddToQueueFromPanel}
              onPlayLikedTracks={handlePlayLikedTracks}
              onQueueLikedTracks={handleQueueLikedTracks}
              lastSession={lastSession}
              onResume={handleResume}
              onOpenSettings={handleOpenSettings}
              onHydrate={handlers.handleHydrate}
              onHydrateFired={handleHydrateFired}
              onHydrateFailed={handleHydrateFailed}
            />
          </ProfiledComponent>
        </>
      );
    }

    if (state.currentView === 'library') {
      const initialSearchQuery = pendingLibraryQueryRef.current;
      pendingLibraryQueryRef.current = undefined;
      return (
        <Suspense fallback={null}>
          <LibraryRoute
            onSelectCollection={(collectionSelection) => {
              handlers.handleCloseLibrary();
              handleSelectCollection(collectionSelection);
            }}
            onAddToQueue={handleAddToQueueFromPanel}
            onPlayLikedTracks={handlePlayLikedTracks}
            onQueueLikedTracks={handleQueueLikedTracks}
            onResume={handleResume}
            lastSession={null}
            initialSearchQuery={initialSearchQuery}
            isPlaying={state.isPlaying}
            isRadioAvailable={radio.isRadioAvailable}
            isRadioGenerating={radio.radioState?.isGenerating}
            onMiniPlay={playbackHandlers.onPlay}
            onMiniPause={playbackHandlers.onPause}
            onMiniNext={playbackHandlers.onNext}
            onMiniPrevious={playbackHandlers.onPrevious}
            onMiniExpand={handlers.handleCloseLibrary}
            onMiniStartRadio={radio.isRadioAvailable ? handlers.handleStartRadio : undefined}
            onPlayNext={handleLibraryPlayNext}
            onStartRadioForCollection={undefined}
            onClose={handlers.handleCloseLibrary}
          />
        </Suspense>
      );
    }

    return (
      <ProfiledComponent id="PlayerContent">
        <PlayerContent
          isPlaying={state.isPlaying}
          showLibrary={false}
          handlers={playbackHandlers}
          radioState={radio.radioState}
          isRadioAvailable={radio.isRadioAvailable}
          radioActive={radio.isActive}
          currentTrackProvider={displayProviderId}
          radioProgress={radio.radioProgress}
          onDismissRadioProgress={radio.dismissRadioProgress}
        />
      </ProfiledComponent>
    );
  };

  return (
    <PlayerSizingProvider>
    <ProfilingProvider>
      <Container>
        <ScreenReaderAnnouncement aria-live="polite" aria-atomic="true">
          {currentTrack ? `Now playing: ${currentTrack.name} by ${currentTrack.artists}` : ''}
        </ScreenReaderAnnouncement>
        <DebugOverlay active={debugActive} />
        <ProfilingOverlay />
        {/* 5 rapid taps in top-left corner toggles debug overlay */}
        <div
          onClick={handleActivatorTap}
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 0px)',
            left: 0,
            width: 44,
            height: 44,
            zIndex: theme.zIndex.debugOverlayAbove,
          }}
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
            speed={backgroundVisualizerSpeed}
            accentColor={accentColor}
            isPlaying={state.isPlaying}
            dimmed={state.currentView === 'library'}
          />
        </ProfiledComponent>
        {renderContent()}
        {showQuickAccessPanel && isMainPlayerActive && (
          <QuickAccessOverlay onClick={handleCloseQuickAccessPanel}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: '92%', maxWidth: 900, height: '80%', maxHeight: 'calc(100dvh - 120px)', margin: 'auto', position: 'relative' }}
            >
              <QuickAccessPanel
                onSelectCollection={(collectionSelection) => {
                  handleCloseQuickAccessPanel();
                  handleSelectCollection(collectionSelection);
                }}
                onAddToQueue={(collectionSelection) => {
                  handleCloseQuickAccessPanel();
                  void handleAddToQueueFromPanel(collectionSelection);
                }}
                onBrowseLibrary={() => {
                  handleCloseQuickAccessPanel();
                  handlers.handleOpenLibrary();
                }}
                lastSession={null}
                onResume={() => {}}
              />
            </div>
          </QuickAccessOverlay>
        )}
        <CmdKPalette
          onSelectTrack={handleCmdKSelectTrack}
          onSelectAlbum={handleCmdKSelectAlbum}
          onSelectPlaylist={handleCmdKSelectPlaylist}
          onSelectArtist={handleCmdKSelectArtist}
        />
        {!isMainPlayerActive && (
          <Suspense fallback={null}>
            <Settings isOpen={isSettingsOpen} onClose={handleCloseSettings} />
          </Suspense>
        )}
        {needsSetup && state.currentView === 'library' && (
          <Suspense fallback={null}>
            <LibraryRoute
              onSelectCollection={(collectionSelection) => {
                handlers.handleCloseLibrary();
                handleSelectCollection(collectionSelection);
              }}
              onAddToQueue={handleAddToQueueFromPanel}
              onPlayLikedTracks={handlePlayLikedTracks}
              onQueueLikedTracks={handleQueueLikedTracks}
              onResume={handleResume}
              lastSession={lastSession}
              isPlaying={state.isPlaying}
              isRadioAvailable={radio.isRadioAvailable}
              isRadioGenerating={radio.radioState?.isGenerating}
              onMiniPlay={playbackHandlers.onPlay}
              onMiniPause={playbackHandlers.onPause}
              onMiniNext={playbackHandlers.onNext}
              onMiniPrevious={playbackHandlers.onPrevious}
              onMiniExpand={handlers.handleCloseLibrary}
              onMiniStartRadio={radio.isRadioAvailable ? handlers.handleStartRadio : undefined}
              onPlayNext={handleLibraryPlayNext}
              onStartRadioForCollection={undefined}
              onClose={handlers.handleCloseLibrary}
            />
          </Suspense>
        )}
      </Container>
    </ProfilingProvider>
    </PlayerSizingProvider>
  );
};

export default AudioPlayerComponent;
