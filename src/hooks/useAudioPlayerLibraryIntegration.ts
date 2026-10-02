import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { PlaybackActionsValue } from '@/contexts/PlaybackActionsContext';
import type { LibraryRouteSharedProps } from '@/contexts/libraryRouteHost';
import type { CollectionSelection, MediaTrack } from '@/types/domain';
import type { usePlayerLogic } from '@/hooks/usePlayerLogic';
import { useQueueAddedToast } from '@/hooks/useQueueAddedToast';

type PlayerHandlers = ReturnType<typeof usePlayerLogic>['handlers'];
type PlayerRadio = ReturnType<typeof usePlayerLogic>['radio'];
interface UseAudioPlayerLibraryIntegrationArgs {
  handlers: PlayerHandlers;
  radio: PlayerRadio;
  isPlaying: boolean;
  setShowQueue: Dispatch<SetStateAction<boolean>>;
  withResumeDismiss: <T extends (...args: never[]) => unknown>(fn: T) => T;
  handleSelectCollection: (selection: CollectionSelection) => void;
  handlePlayLikedTracks: (
    tracks: MediaTrack[],
    selection: CollectionSelection,
  ) => Promise<void>;
  handleResume: () => void;
}

export function useAudioPlayerLibraryIntegration({
  handlers,
  radio,
  isPlaying,
  setShowQueue,
  withResumeDismiss,
  handleSelectCollection,
  handlePlayLikedTracks,
  handleResume,
}: UseAudioPlayerLibraryIntegrationArgs) {
  const openQueueFromLibrary = useCallback(() => {
    handlers.handleCloseLibrary();
    setShowQueue(true);
  }, [handlers, setShowQueue]);

  const { notifyAdded, trackWord } = useQueueAddedToast(openQueueFromLibrary);

  const handleCmdKSelectTrack = useCallback(
    (track: MediaTrack) => {
      const result = handlers.insertTracksNext([track], track.name);
      if (result && result.added > 0) {
        notifyAdded(`Added "${track.name}" to play next.`, 'cmdk-add-track');
      }
    },
    [handlers, notifyAdded],
  );

  const handleCmdKInsertCollectionNext = useCallback(
    async (collectionSelection: CollectionSelection) => {
      const name = collectionSelection.name ?? '';
      const result = await handlers.insertCollectionNext(collectionSelection);
      if (result && result.added > 0) {
        notifyAdded(
          `Added ${result.added} ${trackWord(result.added)} from "${name}" to play next.`,
          'cmdk-add-collection',
        );
      }
      return result;
    },
    [handlers, notifyAdded, trackWord],
  );

  const handleLibraryPlayNext = useCallback(
    async (collectionSelection: CollectionSelection) => {
      const name = collectionSelection.name ?? '';
      const result = await handlers.insertCollectionNext(collectionSelection);
      if (result && result.added > 0) {
        notifyAdded(
          `Added ${result.added} ${trackWord(result.added)} from "${name}" to play next.`,
          'lib-play-next',
        );
      }
    },
    [handlers, notifyAdded, trackWord],
  );

  const handleAddToQueueFromPanel = useCallback(
    async (collectionSelection: CollectionSelection) => {
      const result = await handlers.handleAddToQueue(collectionSelection);
      if (result && result.added > 0) {
        const title = result.collectionName?.trim();
        const label = title ? `"${title}"` : 'this collection';
        notifyAdded(
          `Added ${result.added} ${trackWord(result.added)} from ${label} to your queue.`,
          'qap-add-queue',
        );
      }
      return result;
    },
    [handlers, notifyAdded, trackWord],
  );

  const handleQueueLikedTracks = useCallback(
    (likedTracks: MediaTrack[], collectionName?: string) => {
      const result = handlers.queueTracksDirectly(likedTracks, collectionName);
      if (result && result.added > 0) {
        const title = result.collectionName?.trim();
        const label = title ? `"${title}"` : 'this collection';
        notifyAdded(
          `Added ${result.added} liked ${trackWord(result.added)} from ${label} to your queue.`,
          'qap-queue-liked',
        );
      }
    },
    [handlers, notifyAdded, trackWord],
  );

  const libraryPlaybackActions = useMemo((): PlaybackActionsValue => ({
    onPlay: withResumeDismiss(handlers.handlePlay),
    onPause: withResumeDismiss(handlers.handlePause),
    onNext: withResumeDismiss(handlers.handleNext),
    onPrevious: withResumeDismiss(handlers.handlePrevious),
    onExpand: handlers.handleCloseLibrary,
    onStartRadio: radio.isRadioAvailable ? handlers.handleStartRadio : undefined,
  }), [
    withResumeDismiss,
    handlers.handlePlay,
    handlers.handlePause,
    handlers.handleNext,
    handlers.handlePrevious,
    handlers.handleCloseLibrary,
    handlers.handleStartRadio,
    radio.isRadioAvailable,
  ]);

  const libraryRouteCore = useMemo((): Omit<LibraryRouteSharedProps, 'lastSession' | 'initialSearchQuery'> => ({
    onSelectCollection: (collectionSelection) => {
      handlers.handleCloseLibrary();
      handleSelectCollection(collectionSelection);
    },
    onAddToQueue: handleAddToQueueFromPanel,
    onPlayLikedTracks: handlePlayLikedTracks,
    onQueueLikedTracks: handleQueueLikedTracks,
    onResume: handleResume,
    onPlayNext: handleLibraryPlayNext,
    isPlaying,
    isRadioAvailable: radio.isRadioAvailable,
    isRadioGenerating: radio.radioState?.isGenerating,
    onClose: handlers.handleCloseLibrary,
  }), [
    handlers,
    handleSelectCollection,
    handleAddToQueueFromPanel,
    handlePlayLikedTracks,
    handleQueueLikedTracks,
    handleResume,
    handleLibraryPlayNext,
    isPlaying,
    radio.isRadioAvailable,
    radio.radioState?.isGenerating,
  ]);

  return {
    handleCmdKSelectTrack,
    handleCmdKInsertCollectionNext,
    handleAddToQueueFromPanel,
    handleQueueLikedTracks,
    libraryPlaybackActions,
    libraryRouteCore,
  };
}
