import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import type { TrackOperations } from '@/types/trackOperations';
import { isAllMusicRef, resolvePlaylistRef } from '@/constants/playlist';
import { logQueue } from '@/lib/debugLog';
import { shuffleArray } from '@/utils/shuffleArray';
import {
  appendMediaTracks,
  moveItemInArray,
  removeMediaTrackById,
  reorderMediaTracksToMatchTracks,
} from '@/utils/queueTrackMirror';
import { trkSummary } from './playerLogicUtils';

const ADD_TO_QUEUE_ERROR_ID = 'qap-add-queue-error';
const ADD_TO_QUEUE_DUP_ID = 'qap-add-queue-dup';
const ADD_TO_QUEUE_EMPTY_ID = 'qap-add-queue-empty';
const ADD_TO_QUEUE_ERROR_MSG = "Couldn't add to queue. Try again.";
const ADD_TO_QUEUE_DUP_MSG = 'Already in your queue.';
const ADD_TO_QUEUE_EMPTY_MSG = 'This collection is empty.';

interface UseQueueManagementProps {
  trackOps: Pick<TrackOperations, 'setTracks' | 'setOriginalTracks' | 'setCurrentTrackIndex' | 'mediaTracksRef'>;
  tracks: MediaTrack[];
  currentTrackIndex: number;
  shuffleEnabled: boolean;
  loadCollection: (playlistId: string, provider?: ProviderId, name?: string) => Promise<number>;
  handleBackToLibrary: () => void;
  activeDescriptor: ProviderDescriptor | undefined;
  getDescriptor: (providerId: ProviderId) => ProviderDescriptor | undefined;
}

interface UseQueueManagementReturn {
  handleAddToQueue: (playlistId: string, collectionName?: string, provider?: ProviderId) => Promise<AddToQueueResult | null>;
  queueTracksDirectly: (tracks: MediaTrack[], collectionName?: string) => AddToQueueResult | null;
  handleRemoveFromQueue: (index: number) => void;
  handleReorderQueue: (fromIndex: number, toIndex: number) => void;
}

export function useQueueManagement({
  trackOps,
  tracks,
  currentTrackIndex,
  shuffleEnabled,
  loadCollection,
  handleBackToLibrary,
  activeDescriptor,
  getDescriptor,
}: UseQueueManagementProps): UseQueueManagementReturn {
  const { setTracks, setOriginalTracks, setCurrentTrackIndex, mediaTracksRef } = trackOps;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  /**
   * Fetch tracks from a collection (album/playlist) and append them to the
   * current queue without interrupting playback. If nothing is playing yet,
   * starts playback of the first added track.
   */
  const handleAddToQueue = useCallback(
    async (playlistId: string, collectionName?: string, provider?: ProviderId): Promise<AddToQueueResult | null> => {
      const isQueueEmpty = tracks.length === 0;
      logQueue(
        'handleAddToQueue — playlistId=%s, provider=%s, currentQueueLen=%d, mediaLen=%d',
        playlistId,
        provider ?? 'active',
        tracks.length,
        mediaTracksRef.current.length,
      );

      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      if (!targetDescriptor || !targetProviderId) {
        toast(ADD_TO_QUEUE_ERROR_MSG, { id: ADD_TO_QUEUE_ERROR_ID });
        return null;
      }

      if (isQueueEmpty) {
        logQueue('handleAddToQueue — queue empty, delegating to loadCollection');
        const loaded = await loadCollection(playlistId, provider, collectionName);
        if (loaded > 0) {
          return { added: loaded, collectionName };
        }
        toast(ADD_TO_QUEUE_EMPTY_MSG, { id: ADD_TO_QUEUE_EMPTY_ID });
        return null;
      }

      try {
        const catalog = targetDescriptor.catalog;
        const { id: collectionId, kind: collectionKind } = resolvePlaylistRef(playlistId, targetProviderId);
        const collectionRef = { provider: targetProviderId, kind: collectionKind, id: collectionId } as const;
        const fetchedTracks = await catalog.listTracks(collectionRef);
        const newMediaTracks = isAllMusicRef(collectionRef) ? shuffleArray(fetchedTracks) : fetchedTracks;

        const existingIds = new Set(tracksRef.current.map((t) => t.id));
        const uniqueNewTracks = newMediaTracks.filter((t) => !existingIds.has(t.id));
        if (uniqueNewTracks.length < newMediaTracks.length) {
          logQueue('handleAddToQueue — deduped: %d → %d tracks', newMediaTracks.length, uniqueNewTracks.length);
        }

        if (uniqueNewTracks.length === 0) {
          toast(ADD_TO_QUEUE_DUP_MSG, { id: ADD_TO_QUEUE_DUP_ID });
          return null;
        }

        // Append to existing queue
        logQueue(
          'handleAddToQueue — appending %d tracks. Before: tracks=%d, mediaRef=%d',
          uniqueNewTracks.length,
          tracksRef.current.length,
          mediaTracksRef.current.length,
        );
        mediaTracksRef.current = appendMediaTracks(mediaTracksRef.current, uniqueNewTracks);
        setOriginalTracks([...tracksRef.current, ...uniqueNewTracks]);
        setTracks((prev: MediaTrack[]) => [...prev, ...uniqueNewTracks]);
        logQueue(
          'handleAddToQueue — after append: mediaRef=%d, newTracks added: %s',
          mediaTracksRef.current.length,
          uniqueNewTracks.map((t: MediaTrack) => trkSummary(t)).join(', '),
        );
        return { added: uniqueNewTracks.length, collectionName };
      } catch (err) {
        console.error('[Queue] Failed to add to queue:', err);
        toast(ADD_TO_QUEUE_ERROR_MSG, { id: ADD_TO_QUEUE_ERROR_ID });
        return null;
      }
    },
    [tracks.length, loadCollection, activeDescriptor, getDescriptor, setTracks, setOriginalTracks]
  );

  const handleRemoveFromQueue = useCallback(
    (index: number) => {
      if (index < 0 || index >= tracks.length) return;
      if (index === currentTrackIndex) return;

      const removedTrack = tracks[index];
      logQueue('handleRemoveFromQueue — removing index=%d, track=%s, queueLen=%d', index, trkSummary(removedTrack), tracks.length);

      if (tracks.length <= 1) {
        handleBackToLibrary();
        return;
      }

      mediaTracksRef.current = removeMediaTrackById(mediaTracksRef.current, removedTrack.id);

      // Remove from originalTracks by ID (order-independent for shuffle)
      setOriginalTracks((prev) => prev.filter((t) => t.id !== removedTrack.id));

      // Adjust currentTrackIndex if removing before current
      if (index < currentTrackIndex) {
        setCurrentTrackIndex(prev => prev - 1);
      }

      // Remove from tracks by index
      setTracks(prev => prev.filter((_, i) => i !== index));

      logQueue('handleRemoveFromQueue — done, new queueLen=%d', tracks.length - 1);
    },
    [tracks, currentTrackIndex, handleBackToLibrary, setTracks, setOriginalTracks, setCurrentTrackIndex]
  );

  const handleReorderQueue = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || fromIndex >= tracks.length) return;
      if (toIndex < 0 || toIndex >= tracks.length) return;

      logQueue('handleReorderQueue — from=%d to=%d, queueLen=%d', fromIndex, toIndex, tracks.length);

      const currentTrackId = tracks[currentTrackIndex]?.id;

      const newTracks = moveItemInArray(tracks, fromIndex, toIndex);

      // Update currentTrackIndex to follow the currently playing track
      const newCurrentIndex = currentTrackId
        ? newTracks.findIndex(t => t.id === currentTrackId)
        : currentTrackIndex;

      // Explicitly sync mediaTracksRef before setTracks triggers a re-render, so
      // index-based playback reads the correct track even during the render cycle.
      // useMediaTracksMirror will also re-sync afterward, but this ensures the ref
      // is correct synchronously.
      const reorderedMedia = reorderMediaTracksToMatchTracks(newTracks, mediaTracksRef.current);
      if (reorderedMedia) {
        mediaTracksRef.current = reorderedMedia;
      } else {
        logQueue('handleReorderQueue — mediaTracksRef out of sync (len %d vs tracks len %d); layout effect will recover', mediaTracksRef.current.length, newTracks.length);
      }

      // Only update originalTracks if shuffle is off
      if (!shuffleEnabled) {
        setOriginalTracks(newTracks);
      }

      setCurrentTrackIndex(newCurrentIndex >= 0 ? newCurrentIndex : 0);
      setTracks(newTracks);

      logQueue('handleReorderQueue — done, currentIndex=%d', newCurrentIndex);
    },
    [tracks, currentTrackIndex, shuffleEnabled, setTracks, setOriginalTracks, setCurrentTrackIndex]
  );

  const queueTracksDirectly = useCallback(
    (newTracks: MediaTrack[], collectionName?: string): AddToQueueResult | null => {
      if (newTracks.length === 0) return null;

      const existingIds = new Set(tracksRef.current.map((t) => t.id));
      const uniqueNewTracks = newTracks.filter((t) => !existingIds.has(t.id));

      if (uniqueNewTracks.length === 0) {
        toast(ADD_TO_QUEUE_DUP_MSG, { id: ADD_TO_QUEUE_DUP_ID });
        return null;
      }

      logQueue(
        'queueTracksDirectly — appending %d tracks. Before: tracks=%d, mediaRef=%d',
        uniqueNewTracks.length,
        tracksRef.current.length,
        mediaTracksRef.current.length,
      );
      mediaTracksRef.current = appendMediaTracks(mediaTracksRef.current, uniqueNewTracks);
      setOriginalTracks([...tracksRef.current, ...uniqueNewTracks]);
      setTracks((prev: MediaTrack[]) => [...prev, ...uniqueNewTracks]);
      return { added: uniqueNewTracks.length, collectionName };
    },
    [mediaTracksRef, setOriginalTracks, setTracks]
  );

  return {
    handleAddToQueue,
    queueTracksDirectly,
    handleRemoveFromQueue,
    handleReorderQueue,
  };
}
