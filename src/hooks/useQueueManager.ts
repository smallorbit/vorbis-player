import { useState, useCallback } from 'react';
import type { Track } from '../services/spotify';

/**
 * Queue management hook - the single source of truth for all tracks.
 * 
 * The queue contains all tracks that will be played, including:
 * - Tracks from the current playlist/album
 * - Tracks added via "queue album" feature
 * 
 * The player always plays from this queue.
 */
export function useQueueManager() {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  /**
   * Set the entire queue (used when loading a playlist/album).
   * Replaces the current queue with new tracks.
   */
  const setQueueTracks = useCallback((tracks: Track[], startIndex: number = 0) => {
    console.log(`🎵 [QUEUE] setQueueTracks called: ${tracks.length} tracks, startIndex=${startIndex}`);
    setQueue(tracks);
    setCurrentIndex(startIndex);
    console.log(`🎵 [QUEUE] Queue set complete`);
  }, []);

  /**
   * Add tracks to the end of the queue.
   * Used when queueing albums while playback continues.
   */
  const addToQueue = useCallback((tracksToAdd: Track[]) => {
    if (tracksToAdd.length === 0) return;
    
    setQueue(prev => {
      const newQueue = [...prev, ...tracksToAdd];
      console.log(`🎵 Added ${tracksToAdd.length} track(s) to queue. Queue size: ${newQueue.length}`);
      return newQueue;
    });
  }, []);

  /**
   * Move to the next track in the queue.
   * Returns true if successful, false if at end of queue.
   */
  const nextTrack = useCallback((): boolean => {
    console.log(`🎵 [QUEUE] nextTrack() called`);
    setCurrentIndex(prev => {
      const nextIndex = prev + 1;
      if (nextIndex >= queue.length) {
        // Loop back to start
        console.log(`🎵 [QUEUE] End of queue (${prev} + 1 >= ${queue.length}), looping to start (index 0)`);
        return 0;
      }
      console.log(`🎵 [QUEUE] nextTrack: ${prev} -> ${nextIndex} (${nextIndex + 1}/${queue.length})`);
      return nextIndex;
    });
    return true;
  }, [queue.length]);

  /**
   * Move to the previous track in the queue.
   * Returns true if successful, false if at beginning of queue.
   */
  const previousTrack = useCallback((): boolean => {
    console.log(`🎵 [QUEUE] previousTrack() called`);
    setCurrentIndex(prev => {
      const prevIndex = prev - 1;
      if (prevIndex < 0) {
        // Loop to end
        console.log(`🎵 [QUEUE] At start of queue (${prev} - 1 < 0), looping to end (index ${queue.length - 1})`);
        return queue.length - 1;
      }
      console.log(`🎵 [QUEUE] previousTrack: ${prev} -> ${prevIndex} (${prevIndex + 1}/${queue.length})`);
      return prevIndex;
    });
    return true;
  }, [queue.length]);

  /**
   * Jump to a specific track index in the queue.
   */
  const jumpToTrack = useCallback((index: number) => {
    if (index < 0 || index >= queue.length) {
      console.error(`🎵 [QUEUE] Invalid track index: ${index} (queue length: ${queue.length})`);
      return false;
    }
    console.log(`🎵 [QUEUE] jumpToTrack(${index}) - ${queue[index]?.name}`);
    setCurrentIndex(index);
    console.log(`🎵 [QUEUE] Jumped to track ${index + 1}/${queue.length}`);
    return true;
  }, [queue, queue.length]);

  /**
   * Clear all tracks from the queue.
   */
  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentIndex(0);
    console.log('🎵 Queue cleared');
  }, []);

  /**
   * Get the current track.
   */
  const getCurrentTrack = useCallback((): Track | null => {
    return queue[currentIndex] || null;
  }, [queue, currentIndex]);

  return {
    // State
    queue,
    currentIndex,
    currentTrack: getCurrentTrack(),
    
    // Actions
    setQueueTracks,
    addToQueue,
    nextTrack,
    previousTrack,
    jumpToTrack,
    clearQueue
  };
}
