import { useCallback } from 'react';
import { toast } from 'sonner';
import type { AddToQueueResult, CollectionRef, CollectionSelection, LoadCollectionResult, MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import { isAllMusicRef } from '@/constants/playlist';
import { playbackStore } from '@/stores/playbackStore';
import { queueStore, type AddTracksPosition } from '@/stores/queueStore';
import { logQueue } from '@/lib/debugLog';
import { shuffleArray } from '@/utils/shuffleArray';
import { trkSummary } from './playerLogicUtils';

const ADD_TO_QUEUE_ERROR_ID = 'qap-add-queue-error';
const ADD_TO_QUEUE_DUP_ID = 'qap-add-queue-dup';
const ADD_TO_QUEUE_EMPTY_ID = 'qap-add-queue-empty';
const ADD_TO_QUEUE_ERROR_MSG = "Couldn't add to queue. Try again.";
const ADD_TO_QUEUE_DUP_MSG = 'Already in your queue.';
const ADD_TO_QUEUE_EMPTY_MSG = 'This collection is empty.';

interface UseQueueManagementProps {
  loadCollection: (selection: CollectionSelection) => Promise<LoadCollectionResult>;
  handleBackToLibrary: () => void;
  activeDescriptor: ProviderDescriptor | undefined;
  getDescriptor: (providerId: ProviderId) => ProviderDescriptor | undefined;
}

interface UseQueueManagementReturn {
  handleAddToQueue: (selection: CollectionSelection) => Promise<AddToQueueResult | null>;
  queueTracksDirectly: (tracks: MediaTrack[], collectionName?: string) => AddToQueueResult | null;
  insertTracksNext: (tracks: MediaTrack[], collectionName?: string) => AddToQueueResult | null;
  insertCollectionNext: (selection: CollectionSelection) => Promise<AddToQueueResult | null>;
  handleRemoveFromQueue: (index: number) => void;
  handleReorderQueue: (fromIndex: number, toIndex: number) => void;
}

/**
 * Queue mutation handlers, rebuilt on two primitives:
 * `fetchCollectionTracks` (resolve + fetch a collection's tracks) and
 * `queueStore.addTracks({position})` (the single owner of the
 * append/dedupe/shuffle invariant). Everything here is policy — which toast
 * to show, when to delegate to a full load, when to leave the player.
 */
export function useQueueManagement({
  loadCollection,
  handleBackToLibrary,
  activeDescriptor,
  getDescriptor,
}: UseQueueManagementProps): UseQueueManagementReturn {
  // Native-queue-sync notifications target the **driving** provider — the one
  // producing audio, which may differ from `activeDescriptor` for
  // cross-provider queues — so the SDK whose queue we mirror gets the update.
  const notifyQueueChanged = useCallback((): void => {
    const driving = playbackStore.getDrivingDescriptor();
    if (!driving) return;
    if (!driving.capabilities?.hasNativeQueueSync) return;
    driving.playback.onQueueChanged?.(queueStore.getTracks(), queueStore.getCurrentIndex());
  }, []);

  /**
   * Shared append/insert path: adds pre-fetched tracks via the store (which
   * owns dedupe + the shuffle-aware originalTracks invariant) and reports the
   * outcome. Returns null (with the dup toast) when every track was already
   * queued.
   */
  const addTracksToQueue = useCallback(
    (newTracks: MediaTrack[], position: AddTracksPosition, collectionName?: string): AddToQueueResult | null => {
      if (newTracks.length === 0) return null;

      const { added } = queueStore.addTracks(newTracks, { position });
      if (added === 0) {
        toast(ADD_TO_QUEUE_DUP_MSG, { id: ADD_TO_QUEUE_DUP_ID });
        return null;
      }

      notifyQueueChanged();
      logQueue(
        'addTracksToQueue — added %d tracks (%s), queueLen=%d: %s',
        added,
        position,
        queueStore.getTracks().length,
        newTracks.slice(0, 5).map((t: MediaTrack) => trkSummary(t)).join(', '),
      );
      return { added, ...(collectionName !== undefined && { collectionName }) };
    },
    [notifyQueueChanged],
  );

  /**
   * Fetch a collection's tracks from its resolved provider catalog. The All
   * Music pseudo-collection is pre-shuffled to match its load behavior.
   * Throws on catalog errors.
   */
  const fetchCollectionTracks = useCallback(
    async (
      selection: CollectionSelection,
      targetDescriptor: ProviderDescriptor,
      targetProviderId: ProviderId,
    ): Promise<MediaTrack[]> => {
      const collectionRef: CollectionRef = selection.type === 'collection'
        ? selection.ref
        : { provider: targetProviderId, kind: 'liked' };
      const fetched = await targetDescriptor.catalog.listTracks(collectionRef);
      return isAllMusicRef(collectionRef) ? shuffleArray(fetched) : fetched;
    },
    [],
  );

  /**
   * Fetch a collection and add it to the queue without interrupting playback.
   * An empty queue delegates to `loadCollection` (full load + autoplay).
   */
  const addCollection = useCallback(
    async (selection: CollectionSelection, position: AddTracksPosition): Promise<AddToQueueResult | null> => {
      const collectionName = selection.name;
      logQueue(
        'addCollection(%s) — selection=%o, currentQueueLen=%d',
        position,
        selection,
        queueStore.getTracks().length,
      );

      const provider = selection.type === 'collection' ? selection.ref.provider : selection.provider;
      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;
      if (!targetDescriptor || !targetProviderId) {
        toast(ADD_TO_QUEUE_ERROR_MSG, { id: ADD_TO_QUEUE_ERROR_ID });
        return null;
      }

      if (queueStore.getTracks().length === 0) {
        logQueue('addCollection — queue empty, delegating to loadCollection');
        const result = await loadCollection(selection);
        if (result.status === 'loaded') {
          return { added: result.count, ...(collectionName !== undefined && { collectionName }) };
        }
        // A superseded load means a newer user action owns the queue now — no
        // confirmation and no error belongs to this one.
        if (result.status === 'superseded') return null;
        toast(ADD_TO_QUEUE_EMPTY_MSG, { id: ADD_TO_QUEUE_EMPTY_ID });
        return null;
      }

      try {
        const fetched = await fetchCollectionTracks(selection, targetDescriptor, targetProviderId);
        return addTracksToQueue(fetched, position, collectionName);
      } catch (err) {
        console.error('[Queue] Failed to add to queue:', err);
        toast(ADD_TO_QUEUE_ERROR_MSG, { id: ADD_TO_QUEUE_ERROR_ID });
        return null;
      }
    },
    [activeDescriptor, getDescriptor, loadCollection, fetchCollectionTracks, addTracksToQueue],
  );

  const handleAddToQueue = useCallback(
    (selection: CollectionSelection) => addCollection(selection, 'end'),
    [addCollection],
  );

  const insertCollectionNext = useCallback(
    (selection: CollectionSelection) => addCollection(selection, 'next'),
    [addCollection],
  );

  const queueTracksDirectly = useCallback(
    (newTracks: MediaTrack[], collectionName?: string) => addTracksToQueue(newTracks, 'end', collectionName),
    [addTracksToQueue],
  );

  const insertTracksNext = useCallback(
    (newTracks: MediaTrack[], collectionName?: string) => addTracksToQueue(newTracks, 'next', collectionName),
    [addTracksToQueue],
  );

  const handleRemoveFromQueue = useCallback(
    (index: number) => {
      const { tracks, currentIndex } = queueStore.getSnapshot();
      if (index < 0 || index >= tracks.length) return;
      if (index === currentIndex) return;

      const target = tracks[index];
      if (!target) return;
      logQueue('handleRemoveFromQueue — removing index=%d, track=%s, queueLen=%d', index, trkSummary(target), tracks.length);

      if (tracks.length <= 1) {
        handleBackToLibrary();
        return;
      }

      queueStore.removeTrackAt(index);
      notifyQueueChanged();

      logQueue('handleRemoveFromQueue — done, new queueLen=%d', queueStore.getTracks().length);
    },
    [handleBackToLibrary, notifyQueueChanged]
  );

  const handleReorderQueue = useCallback(
    (fromIndex: number, toIndex: number) => {
      const { tracks } = queueStore.getSnapshot();
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || fromIndex >= tracks.length) return;
      if (toIndex < 0 || toIndex >= tracks.length) return;

      logQueue('handleReorderQueue — from=%d to=%d, queueLen=%d', fromIndex, toIndex, tracks.length);

      queueStore.reorderTrack(fromIndex, toIndex);
      notifyQueueChanged();

      logQueue('handleReorderQueue — done, currentIndex=%d', queueStore.getCurrentIndex());
    },
    [notifyQueueChanged]
  );

  return {
    handleAddToQueue,
    queueTracksDirectly,
    insertTracksNext,
    insertCollectionNext,
    handleRemoveFromQueue,
    handleReorderQueue,
  };
}
