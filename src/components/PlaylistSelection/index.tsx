import * as React from 'react';
import { CardContent } from '../styled';
import { theme } from '@/styles/theme';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import {
  PageContainer,
  PageSelectionCard,
  DrawerContentWrapper,
} from './styled';
import { LibraryStatusContent } from './LibraryStatusContent';
import { LibraryMainContent } from './LibraryMainContent';
import { LibraryProviders } from './LibraryContext';
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
    <LibraryProviders values={{ browsing: browsingValue, pin: pinValue, actions: actionsValue, data: dataValue }}>
      <PageContainer $overlay>
        <PageSelectionCard $maxWidth={maxWidth} $overlay>
          <CardContent
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: `0 ${theme.spacing.md}`,
            }}
          >
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
    </LibraryProviders>
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
    <LibraryProviders values={{ browsing: browsingValue, pin: pinValue, actions: actionsValue, data: dataValue }}>
      <DrawerContentWrapper>
        <LibraryStatusContent {...statusContentProps} />
        {showMainContent && <LibraryMainContent />}
        {albumPopoverPortal}
        {playlistPopoverPortal}
        {confirmDeletePortal}
      </DrawerContentWrapper>
    </LibraryProviders>
  );
});

export default LibraryPage;
