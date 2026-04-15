import * as React from 'react';
import { CardContent } from '../styled';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import {
  PageContainer,
  PageSelectionCard,
  DrawerContentWrapper,
} from './styled';
import { LibraryStatusContent } from './LibraryStatusContent';
import { LibraryMainContent } from './LibraryMainContent';
import {
  LibraryBrowsingProvider,
  LibraryPinProvider,
  LibraryActionsProvider,
  LibraryDataProvider,
} from './LibraryContext';
import { useLibraryRoot } from './useLibraryRoot';
import { LibraryMiniPlayer } from './LibraryMiniPlayer';

interface LibraryPageProps {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (
    playlistId: string,
    playlistName?: string,
    provider?: ProviderId,
  ) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  onNavigateToPlayer?: () => void;
  isPlaying?: boolean;
  footer?: React.ReactNode;
}

export const LibraryPage = React.memo(function LibraryPage({
  onPlaylistSelect,
  onAddToQueue,
  onPlayLikedTracks,
  onQueueLikedTracks,
  onNavigateToPlayer,
  isPlaying,
  footer,
}: LibraryPageProps): JSX.Element {
  const {
    browsingValue,
    pinValue,
    actionsValue,
    dataValue,
    statusContentProps,
    showMainContent,
    maxWidth,
    albumPopoverPortal,
    playlistPopoverPortal,
    confirmDeletePortal,
  } = useLibraryRoot({
    onPlaylistSelect,
    onAddToQueue,
    onPlayLikedTracks,
    onQueueLikedTracks,
    inDrawer: false,
  });

  return (
    <LibraryDataProvider value={dataValue}>
    <LibraryBrowsingProvider value={browsingValue}>
    <LibraryPinProvider value={pinValue}>
    <LibraryActionsProvider value={actionsValue}>
      <PageContainer $overlay={!!onNavigateToPlayer}>
        <PageSelectionCard $maxWidth={maxWidth} $overlay={!!onNavigateToPlayer}>
          <CardContent style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <LibraryStatusContent {...statusContentProps} />
            {showMainContent && <LibraryMainContent />}
            {albumPopoverPortal}
            {playlistPopoverPortal}
            {confirmDeletePortal}
          </CardContent>
          {footer}
          {onNavigateToPlayer && (
            <LibraryMiniPlayer isPlaying={isPlaying ?? false} onNavigateToPlayer={onNavigateToPlayer} />
          )}
        </PageSelectionCard>
      </PageContainer>
    </LibraryActionsProvider>
    </LibraryPinProvider>
    </LibraryBrowsingProvider>
    </LibraryDataProvider>
  );
});

interface DrawerLibraryProps {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (
    playlistId: string,
    playlistName?: string,
    provider?: ProviderId,
  ) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  swipeZoneRef?: React.RefObject<HTMLDivElement>;
  initialSearchQuery?: string;
  initialViewMode?: 'playlists' | 'albums';
  onLibraryRefresh?: () => void;
  isLibraryRefreshing?: boolean;
}

export const DrawerLibrary = React.memo(function DrawerLibrary({
  onPlaylistSelect,
  onAddToQueue,
  onPlayLikedTracks,
  onQueueLikedTracks,
  swipeZoneRef,
  initialSearchQuery,
  initialViewMode,
  onLibraryRefresh,
  isLibraryRefreshing,
}: DrawerLibraryProps): JSX.Element {
  const {
    browsingValue,
    pinValue,
    actionsValue,
    dataValue,
    statusContentProps,
    showMainContent,
    albumPopoverPortal,
    playlistPopoverPortal,
    confirmDeletePortal,
  } = useLibraryRoot({
    onPlaylistSelect,
    onAddToQueue,
    onPlayLikedTracks,
    onQueueLikedTracks,
    inDrawer: true,
    swipeZoneRef,
    initialSearchQuery,
    initialViewMode,
    onLibraryRefresh,
    isLibraryRefreshing,
  });

  return (
    <LibraryDataProvider value={dataValue}>
    <LibraryBrowsingProvider value={browsingValue}>
    <LibraryPinProvider value={pinValue}>
    <LibraryActionsProvider value={actionsValue}>
      <DrawerContentWrapper>
        <LibraryStatusContent {...statusContentProps} />
        {showMainContent && <LibraryMainContent />}
        {albumPopoverPortal}
        {playlistPopoverPortal}
        {confirmDeletePortal}
      </DrawerContentWrapper>
    </LibraryActionsProvider>
    </LibraryPinProvider>
    </LibraryBrowsingProvider>
    </LibraryDataProvider>
  );
});

export default LibraryPage;
