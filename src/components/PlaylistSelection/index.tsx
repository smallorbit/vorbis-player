import * as React from 'react';
import { CardContent } from '../styled';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import {
  PageContainer,
  PageSelectionCard,
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

interface LibraryPageProps {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (
    playlistId: string,
    playlistName?: string,
    provider?: ProviderId,
  ) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  footer?: React.ReactNode;
}

export const LibraryPage = React.memo(function LibraryPage({
  onPlaylistSelect,
  onAddToQueue,
  onPlayLikedTracks,
  onQueueLikedTracks,
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
      <PageContainer>
        <PageSelectionCard $maxWidth={maxWidth}>
          <CardContent style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <LibraryStatusContent {...statusContentProps} />
            {showMainContent && <LibraryMainContent />}
            {albumPopoverPortal}
            {playlistPopoverPortal}
            {confirmDeletePortal}
          </CardContent>
          {footer}
        </PageSelectionCard>
      </PageContainer>
    </LibraryActionsProvider>
    </LibraryPinProvider>
    </LibraryBrowsingProvider>
    </LibraryDataProvider>
  );
});

export default LibraryPage;
