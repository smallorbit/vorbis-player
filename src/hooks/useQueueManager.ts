import { useState, useCallback, useRef, useEffect } from 'react';
import type { Track } from '../services/spotify';

/**
 * Queue management hook - the single source of truth for all tracks.
 * The queue contains all tracks that will be played, including tracks from
 * the current playlist/album and tracks added via "queue album" feature.
 */
export function useQueueManager() {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const currentIndexRef = useRef<number>(0);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const setQueueTracks = useCallback((tracks: Track[], startIndex: number = 0): void => {
    setQueue(tracks);
    setCurrentIndex(startIndex);
  }, []);

  const addToQueue = useCallback((tracksToAdd: Track[]): void => {
    if (tracksToAdd.length === 0) return;
    setQueue(prev => [...prev, ...tracksToAdd]);
  }, []);

  const nextTrack = useCallback((): void => {
    setCurrentIndex(prev => {
      const nextIndex = prev + 1;
      return nextIndex >= queue.length ? 0 : nextIndex;
    });
  }, [queue.length]);

  const previousTrack = useCallback((): void => {
    setCurrentIndex(prev => {
      const prevIndex = prev - 1;
      return prevIndex < 0 ? queue.length - 1 : prevIndex;
    });
  }, [queue.length]);

  const jumpToTrack = useCallback((index: number): boolean => {
    if (index < 0 || index >= queue.length) {
      return false;
    }
    setCurrentIndex(index);
    return true;
  }, [queue.length]);

  const clearQueue = useCallback((): void => {
    setQueue([]);
    setCurrentIndex(0);
  }, []);

  const getCurrentTrack = useCallback((): Track | null => {
    return queue[currentIndex] || null;
  }, [queue, currentIndex]);

  const getCurrentIndex = useCallback((): number => {
    return currentIndexRef.current;
  }, []);

  return {
    queue,
    currentIndex,
    currentTrack: getCurrentTrack(),
    setQueueTracks,
    addToQueue,
    nextTrack,
    previousTrack,
    jumpToTrack,
    clearQueue,
    getCurrentIndex
  };
}
