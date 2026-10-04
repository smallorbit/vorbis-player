import { useEffect, useRef } from 'react';
import { logQueue } from '@/lib/debugLog';
import { playbackStore } from '@/stores/playbackStore';
import { queueStore } from '@/stores/queueStore';
import { AUTO_ADVANCE_DELAY_MS } from '@/constants/timing';

interface UseAutoAdvanceProps {
  playTrack: (index: number, skipOnError?: boolean) => void;
  enabled?: boolean | undefined;
}

/**
 * Advance-to-next policy on top of the playback store's track-ended events.
 * Detection (near-end thresholds, paused-at-zero with buffering cooldown)
 * lives in the store; this hook only decides what to do about it: wait a
 * beat, re-read the queue, stop at the end, otherwise play the next track.
 */
export const useAutoAdvance = ({
  playTrack,
  enabled = true,
}: UseAutoAdvanceProps) => {
  const playTrackRef = useRef(playTrack);
  /** ID for cancelling pending advance timeouts (e.g. when the user skips during the delay). */
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { playTrackRef.current = playTrack; }, [playTrack]);

  // Cancel a pending advance only when the track that ended is no longer the
  // current one (manual skip, provider index sync, queue replaced). Other
  // queue changes — enrichment, appends, reorder, shuffle toggle — keep it:
  // the timeout reads the live queue at fire time, and the ended event will
  // not fire again for the same track, so dropping it would stall playback.
  useEffect(() => {
    let prevTrackId = queueStore.getCurrentTrack()?.id;
    return queueStore.subscribe(() => {
      const trackId = queueStore.getCurrentTrack()?.id;
      if (trackId === prevTrackId) return;
      prevTrackId = trackId;
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = playbackStore.subscribeTrackEnded(() => {
      logQueue('autoAdvance — track ended, scheduling advance from index=%d', queueStore.getCurrentIndex());
      // Compute nextIndex inside the timeout callback (not here) so that if
      // shuffle is toggled during the delay, we use the latest queue state.
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        const currentIdx = queueStore.getCurrentIndex();
        const tracks = queueStore.getTracks();
        // Stop at the end of the queue instead of wrapping around
        if (currentIdx >= tracks.length - 1) {
          logQueue('autoAdvance — at end of queue (%d/%d), stopping', currentIdx, tracks.length);
          return;
        }
        const nextIndex = currentIdx + 1;
        const nextTrack = tracks[nextIndex];
        if (nextTrack) {
          logQueue('autoAdvance — advancing %d → %d, track="%s"', currentIdx, nextIndex, nextTrack.name);
          playTrackRef.current(nextIndex, true);
        }
      }, AUTO_ADVANCE_DELAY_MS);
    });

    return () => {
      unsubscribe();
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, [enabled]);
};
