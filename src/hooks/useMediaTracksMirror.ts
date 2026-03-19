import { useLayoutEffect, useRef, type MutableRefObject } from 'react';
import type { MediaTrack } from '@/types/domain';
import { logQueue } from '@/lib/debugLog';
import { reorderMediaTracksToMatchTracks, type TrackOrderItem } from '@/utils/queueTrackMirror';

/**
 * Ref holding `MediaTrack[]` in lockstep with UI `tracks` order for index-based playback.
 * After shuffle/reorder, a layout effect reorders the ref by track id without a full reload.
 */
export function useMediaTracksMirror<T extends TrackOrderItem>(tracks: readonly T[]): MutableRefObject<MediaTrack[]> {
  const mediaTracksRef = useRef<MediaTrack[]>([]);

  useLayoutEffect(() => {
    const reordered = reorderMediaTracksToMatchTracks(tracks, mediaTracksRef.current);
    if (reordered) {
      mediaTracksRef.current = reordered;
      logQueue('useMediaTracksMirror — reordered mediaTracksRef to match tracks (%d items)', tracks.length);
    }
  }, [tracks]);

  return mediaTracksRef;
}
