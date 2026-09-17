import { useSyncExternalStore } from 'react';
import { playbackStore, type PlaybackSnapshot } from '@/stores/playbackStore';

/** React read bridge for the playback store (isPlaying, position, duration, driving provider). */
export function usePlaybackState(): PlaybackSnapshot {
  return useSyncExternalStore(playbackStore.subscribe, playbackStore.getSnapshot);
}
