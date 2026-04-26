import React, { Suspense, lazy, useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from 'styled-components';
import { toast } from 'sonner';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { RadioProgressContent } from '@/components/RadioProgressToast';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { LIKED_SONGS_ID } from '@/constants/playlist';
import { LIBRARY_REFRESH_EVENT } from '@/hooks/useLibrarySync';
import { providerRegistry } from '@/providers/registry';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { RadioState, RadioProgress } from '@/types/radio';
import QueueSkeleton from '@/components/QueueSkeleton';

const SaveQueueDialog = lazy(() => import('@/components/SaveQueueDialog'));
const QueueDrawer = lazy(() => import('@/components/QueueDrawer'));
const QueueBottomSheet = lazy(() => import('@/components/QueueBottomSheet'));

function QueueLoadingFallback({ isMobile }: { isMobile: boolean }): React.ReactElement {
  const theme = useTheme();
  const sharedStyle: React.CSSProperties = {
    position: 'fixed',
    background: theme.colors.overlay.panel,
    padding: theme.spacing.md,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    zIndex: theme.zIndex.modal,
  };
  if (isMobile) {
    return (
      <div style={{
        ...sharedStyle,
        left: 0,
        right: 0,
        bottom: 0,
        height: '66dvh',
        maxHeight: '66dvh',
        borderTopLeftRadius: theme.borderRadius['2xl'],
        borderTopRightRadius: theme.borderRadius['2xl'],
      }}>
        <QueueSkeleton />
      </div>
    );
  }
  return (
    <div style={{
      ...sharedStyle,
      top: 0,
      right: 0,
      bottom: 0,
      width: theme.drawer.widths.tablet,
    }}>
      <QueueSkeleton />
    </div>
  );
}

interface DrawerOrchestratorProps {
  showQueue: boolean;
  onCloseQueue: () => void;
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
}

export const DrawerOrchestrator: React.FC<DrawerOrchestratorProps> = React.memo(({
  showQueue,
  onCloseQueue,
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
}) => {
  const { tracks, selectedPlaylistId } = useTrackListContext();
  const { currentTrackIndex } = useCurrentTrackContext();
  const { isUnifiedLikedActive } = useUnifiedLikedTracks();
  const { connectedProviderIds } = useProviderContext();

  const showProviderIcons = (isUnifiedLikedActive && selectedPlaylistId === LIKED_SONGS_ID) || !!radioActive;

  const [showSaveQueueDialog, setShowSaveQueueDialog] = useState(false);

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

  const handleSaveQueue = useCallback(async (name: string, provider: ProviderId): Promise<boolean> => {
    try {
      const descriptor = providerRegistry.get(provider);
      if (!descriptor?.savePlaylist || !descriptor.auth.isAuthenticated()) return false;

      const mediaTracks = mediaTracksRef?.current;
      if (!mediaTracks || mediaTracks.length === 0) return false;

      const result = await descriptor.savePlaylist(name, mediaTracks);
      if (!result) return false;

      setShowSaveQueueDialog(false);
      toast(`Saved "${name}" to ${descriptor.name}`, { id: 'save-queue-success' });
      window.dispatchEvent(new CustomEvent(LIBRARY_REFRESH_EVENT, { detail: { providerId: provider } }));
      return true;
    } catch (err) {
      console.error('[SaveQueue] Failed to save:', err);
      return false;
    }
  }, [mediaTracksRef]);

  useEffect(() => {
    if (!radioProgress || !onDismissRadioProgress) {
      toast.dismiss('radio-progress');
      return;
    }
    const isDone = radioProgress.phase === 'done';
    toast.custom(
      (toastId: string | number) => (
        <RadioProgressContent
          phase={radioProgress.phase}
          trackCount={radioProgress.trackCount}
          onDismiss={() => {
            toast.dismiss(toastId);
            onDismissRadioProgress();
          }}
          onViewQueue={() => {
            toast.dismiss(toastId);
            onOpenQueueFromToast();
            onDismissRadioProgress();
          }}
        />
      ),
      {
        id: 'radio-progress',
        duration: isDone ? 6000 : Infinity,
        onAutoClose: isDone ? onDismissRadioProgress : undefined,
      },
    );
  }, [radioProgress, onDismissRadioProgress, onOpenQueueFromToast]);

  return (
    <>
      <Suspense fallback={showQueue ? <QueueLoadingFallback isMobile={isMobile} /> : null}>
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
    </>
  );
});

DrawerOrchestrator.displayName = 'DrawerOrchestrator';
