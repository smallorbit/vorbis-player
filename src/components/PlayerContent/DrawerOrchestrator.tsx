import React, { Suspense, lazy, useState, useCallback, useMemo } from 'react';
import { useTheme } from 'styled-components';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import Toast from '@/components/Toast';
import RadioProgressToast from '@/components/RadioProgressToast';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { LIKED_SONGS_ID } from '@/constants/playlist';
import { LIBRARY_REFRESH_EVENT } from '@/hooks/useLibrarySync';
import { providerRegistry } from '@/providers/registry';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import type { RadioState, RadioProgress } from '@/types/radio';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { MobileLibraryOverlay } from './MobileLibraryOverlay';

const LibraryDrawer = lazy(() => import('@/components/LibraryDrawer'));
const SaveQueueDialog = lazy(() => import('@/components/SaveQueueDialog'));
const QueueDrawer = lazy(() => import('@/components/QueueDrawer'));
const QueueBottomSheet = lazy(() => import('@/components/QueueBottomSheet'));

function QueueLoadingFallback(): React.ReactElement {
  const theme = useTheme();
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: theme.drawer.widths.tablet,
      background: theme.colors.overlay.panel,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.muted.foreground
    }}>
      Loading queue...
    </div>
  );
}

interface DrawerOrchestratorProps {
  showQueue: boolean;
  onCloseQueue: () => void;
  showLibrary: boolean;
  onCloseLibrary: () => void;
  isPlaying?: boolean;
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (playlistId: string, playlistName?: string, provider?: ProviderId) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  onTrackSelect: (index: number) => void;
  onRemoveFromQueue?: (index: number) => void;
  onReorderQueue?: (fromIndex: number, toIndex: number) => void;
  isMobile: boolean;
  radioActive?: boolean;
  radioState?: RadioState;
  mediaTracksRef?: React.RefObject<MediaTrack[]>;
  radioProgress?: RadioProgress | null;
  onDismissRadioProgress?: () => void;
  onOpenQueueFromToast: () => void;
  lastSession?: SessionSnapshot | null;
  onResume?: () => void;
}

export const DrawerOrchestrator: React.FC<DrawerOrchestratorProps> = React.memo(({
  showQueue,
  onCloseQueue,
  showLibrary,
  onCloseLibrary,
  isPlaying,
  onPlaylistSelect,
  onAddToQueue,
  onPlayLikedTracks,
  onQueueLikedTracks,
  onTrackSelect,
  onRemoveFromQueue,
  onReorderQueue,
  isMobile,
  radioActive,
  radioState,
  mediaTracksRef,
  radioProgress,
  onDismissRadioProgress,
  onOpenQueueFromToast,
  lastSession,
  onResume,
}) => {
  const { tracks, selectedPlaylistId } = useTrackListContext();
  const { currentTrackIndex } = useCurrentTrackContext();
  const { isUnifiedLikedActive } = useUnifiedLikedTracks();
  const { connectedProviderIds } = useProviderContext();

  const showProviderIcons = (isUnifiedLikedActive && selectedPlaylistId === LIKED_SONGS_ID) || !!radioActive;

  const [showSaveQueueDialog, setShowSaveQueueDialog] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  const saveProviders = useMemo(
    () => connectedProviderIds.filter(id => {
      const desc = providerRegistry.get(id);
      return desc?.savePlaylist != null;
    }),
    [connectedProviderIds],
  );
  const canSaveQueue = saveProviders.length > 0 && tracks.length > 0;
  const trackProviders = useMemo(() => new Set(tracks.map(t => t.provider).filter(Boolean)), [tracks]);

  const handleOpenSaveQueue = useCallback(() => setShowSaveQueueDialog(true), []);
  const handleCloseSaveQueue = useCallback(() => setShowSaveQueueDialog(false), []);
  const handleDismissToast = useCallback(() => setToast(null), []);

  const handleSaveQueue = useCallback(async (name: string, provider: ProviderId): Promise<boolean> => {
    try {
      const descriptor = providerRegistry.get(provider);
      if (!descriptor?.savePlaylist || !descriptor.auth.isAuthenticated()) return false;

      const mediaTracks = mediaTracksRef?.current;
      if (!mediaTracks || mediaTracks.length === 0) return false;

      const result = await descriptor.savePlaylist(name, mediaTracks);
      if (!result) return false;

      setShowSaveQueueDialog(false);
      setToast({ message: `Saved "${name}" to ${descriptor.name}` });
      window.dispatchEvent(new CustomEvent(LIBRARY_REFRESH_EVENT, { detail: { providerId: provider } }));
      return true;
    } catch (err) {
      console.error('[SaveQueue] Failed to save:', err);
      return false;
    }
  }, [mediaTracksRef]);

  const handleCloseLibrary = useCallback(() => {
    onCloseLibrary();
  }, [onCloseLibrary]);

  const handleLibraryPlaylistSelect = useCallback(
    (playlistId: string, playlistName: string, provider?: ProviderId) => {
      handleCloseLibrary();
      onPlaylistSelect(playlistId, playlistName, provider);
    },
    [handleCloseLibrary, onPlaylistSelect],
  );

  return (
    <>
      <Suspense fallback={showQueue ? <QueueLoadingFallback /> : null}>
        {isMobile ? (
          <ProfiledComponent id="QueueBottomSheet">
            <QueueBottomSheet
              isOpen={showQueue}
              onClose={onCloseQueue}
              tracks={tracks}
              currentTrackIndex={currentTrackIndex}
              onTrackSelect={onTrackSelect}
              onRemoveTrack={onRemoveFromQueue}
              onReorderTracks={onReorderQueue}
              showProviderIcons={showProviderIcons}
              radioActive={radioActive}
              radioSeedDescription={radioState?.seedDescription}
              onSaveQueue={handleOpenSaveQueue}
              canSaveQueue={canSaveQueue}
            />
          </ProfiledComponent>
        ) : (
          <ProfiledComponent id="QueueDrawer">
            <QueueDrawer
              isOpen={showQueue}
              onClose={onCloseQueue}
              tracks={tracks}
              currentTrackIndex={currentTrackIndex}
              onTrackSelect={onTrackSelect}
              onRemoveTrack={onRemoveFromQueue}
              onReorderTracks={onReorderQueue}
              showProviderIcons={showProviderIcons}
              radioActive={radioActive}
              radioSeedDescription={radioState?.seedDescription}
              onSaveQueue={handleOpenSaveQueue}
              canSaveQueue={canSaveQueue}
            />
          </ProfiledComponent>
        )}
      </Suspense>
      {isMobile && (
        <MobileLibraryOverlay
          isOpen={showLibrary}
          isPlaying={isPlaying}
          onPlaylistSelect={handleLibraryPlaylistSelect}
          onAddToQueue={onAddToQueue}
          onPlayLikedTracks={onPlayLikedTracks}
          onQueueLikedTracks={onQueueLikedTracks}
          onCloseLibrary={onCloseLibrary}
        />
      )}
      {!isMobile && (
        <Suspense fallback={null}>
          <LibraryDrawer
            isOpen={showLibrary}
            onClose={onCloseLibrary}
            onPlaylistSelect={handleLibraryPlaylistSelect}
            onAddToQueue={onAddToQueue}
            onPlayLikedTracks={onPlayLikedTracks}
            onQueueLikedTracks={onQueueLikedTracks}
            lastSession={tracks.length === 0 ? lastSession : undefined}
            onResume={tracks.length === 0 ? onResume : undefined}
          />
        </Suspense>
      )}
      {showSaveQueueDialog && (
        <Suspense fallback={null}>
          <SaveQueueDialog
            onSave={handleSaveQueue}
            onClose={handleCloseSaveQueue}
            availableProviders={saveProviders}
            trackProviders={trackProviders}
            defaultName={radioState?.isActive && radioState.seedDescription ? radioState.seedDescription.replace(/^Radio based on /i, '').replace(/\s+by\s+.+$/i, '') + ' Radio' : undefined}
          />
        </Suspense>
      )}
      {toast && (
        <Toast
          message={toast.message}
          onDismiss={handleDismissToast}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
        />
      )}
      {radioProgress && onDismissRadioProgress && (
        <RadioProgressToast
          phase={radioProgress.phase}
          trackCount={radioProgress.trackCount}
          onDismiss={onDismissRadioProgress}
          onViewQueue={() => {
            onOpenQueueFromToast();
            onDismissRadioProgress();
          }}
        />
      )}
    </>
  );
});

DrawerOrchestrator.displayName = 'DrawerOrchestrator';
