import { useCallback, useRef } from 'react';
import type { Track } from '@/services/spotify';
import type { AddToQueueResult } from '@/types/domain';
import type { MediaTrack } from '@/types/domain';
import type { ProviderId } from '@/types/domain';
import { resolvePlaylistRef } from '@/constants/playlist';
import { logQueue } from '@/lib/debugLog';
import {
  appendMediaTracks,
  moveItemInArray,
  removeMediaTrackById,
  reorderMediaTracksToMatchTracks,
} from '@/utils/queueTrackMirror';
import { mediaTrackToTrack, trkSummary } from './playerLogicUtils';

interface UseQueueManagementProps {
  tracks: Track[];
  currentTrackIndex: number;
  shuffleEnabled: boolean;
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
  handlePlaylistSelect: (playlistId: string, _playlistName?: string, provider?: ProviderId) => Promise<number>;
  handleBackToLibrary: () => void;
  activeDescriptor: any;
  getDescriptor: (providerId: ProviderId) => any;
  setTracks: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
  setOriginalTracks: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
  setCurrentTrackIndex: (index: number | ((prev: number) => number)) => void;
}

interface UseQueueManagementReturn {
  handleAddToQueue: (playlistId: string, _playlistName?: string, provider?: ProviderId) => Promise<AddToQueueResult | null>;
  handleRemoveFromQueue: (index: number) => void;
  handleReorderQueue: (fromIndex: number, toIndex: number) => void;
}

export function useQueueManagement({
  tracks,
  currentTrackIndex,
  shuffleEnabled,
  mediaTracksRef,
  handlePlaylistSelect,
  handleBackToLibrary,
  activeDescriptor,
  getDescriptor,
  setTracks,
  setOriginalTracks,
  setCurrentTrackIndex,
}: UseQueueManagementProps): UseQueueManagementReturn {
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  /**
   * Fetch tracks from a collection (album/playlist) and append them to the
   * current queue without interrupting playback. If nothing is playing yet,
   * starts playback of the first added track.
   */
  const handleAddToQueue = useCallback(
    async (playlistId: string, _playlistName?: string, provider?: ProviderId): Promise<AddToQueueResult | null> => {
      const isQueueEmpty = tracks.length === 0;
      logQueue(
        'handleAddToQueue — playlistId=%s, provider=%s, currentQueueLen=%d, mediaLen=%d',
        playlistId,
        provider ?? 'active',
        tracks.length,
        mediaTracksRef.current.length,
      );

      // If nothing is playing, just load normally
      if (isQueueEmpty) {
        logQueue('handleAddToQueue — queue empty, delegating to handlePlaylistSelect');
        const loaded = await handlePlaylistSelect(playlistId, _playlistName, provider);
        if (loaded > 0) {
          return { added: loaded, collectionName: _playlistName };
        }
        return null;
      }

      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      if (!targetDescriptor || !targetProviderId) return null;

      try {
        const catalog = targetDescriptor.catalog;
        const { id: collectionId, kind: collectionKind } = resolvePlaylistRef(playlistId, targetProviderId);
        const collectionRef = { provider: targetProviderId, kind: collectionKind, id: collectionId } as const;
        const newMediaTracks = await catalog.listTracks(collectionRef);

        if (newMediaTracks.length === 0) return null;

        const newTracks = newMediaTracks.map(mediaTrackToTrack);

        // Append to existing queue
        logQueue(
          'handleAddToQueue — appending %d tracks. Before: tracks=%d, mediaRef=%d',
          newMediaTracks.length,
          tracksRef.current.length,
          mediaTracksRef.current.length,
        );
        mediaTracksRef.current = appendMediaTracks(mediaTracksRef.current, newMediaTracks);
        setOriginalTracks([...tracksRef.current, ...newTracks]);
        setTracks((prev: Track[]) => [...prev, ...newTracks]);
        logQueue(
          'handleAddToQueue — after append: mediaRef=%d, newTracks added: %s',
          mediaTracksRef.current.length,
          newTracks.map(t => trkSummary(t)).join(', '),
        );
        return { added: newMediaTracks.length, collectionName: _playlistName };
      } catch (err) {
        console.error('[Queue] Failed to add to queue:', err);
        return null;
      }
    },
    [tracks.length, handlePlaylistSelect, activeDescriptor, getDescriptor, setTracks, setOriginalTracks]
  );

  const handleRemoveFromQueue = useCallback(
    (index: number) => {
      if (index < 0 || index >= tracks.length) return;
      // Cannot remove the currently playing track
      if (index === currentTrackIndex) return;

      const removedTrack = tracks[index];
      logQueue('handleRemoveFromQueue — removing index=%d, track=%s, queueLen=%d', index, trkSummary(removedTrack), tracks.length);

      // If this would empty the queue, go back to library
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

  return {
    handleAddToQueue,
    handleRemoveFromQueue,
    handleReorderQueue,
  };
}
