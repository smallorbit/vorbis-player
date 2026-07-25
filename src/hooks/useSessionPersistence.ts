import { useState, useEffect, useRef, useCallback } from 'react';
import type { MediaTrack, PlaybackSelection } from '@/types/domain';
import { saveSession, loadSession, clearSession } from '@/services/sessionPersistence';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { logSession } from '@/lib/debugLog';

const DEBOUNCE_MS = 1000;
const PERIODIC_SAVE_INTERVAL_MS = 10_000;

export function useSessionPersistence(
  selection: PlaybackSelection | null,
  collectionName: string,
  tracks: MediaTrack[],
  currentTrackIndex: number,
  trackId: string | undefined,
  trackTitle: string | undefined,
  trackArtist: string | undefined,
  trackImage: string | undefined,
  playbackPosition: number,
  getLivePosition?: () => Promise<number | null>,
): { lastSession: SessionSnapshot | null; resetLastSession: () => void } {
  const [lastSession, setLastSession] = useState<SessionSnapshot | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const periodicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoadedRef = useRef(false);

  // Keep a ref to the latest snapshot data so beforeunload and interval can
  // access current values without capturing stale closure state.
  const snapshotRef = useRef<SessionSnapshot | null>(null);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    const loaded = loadSession();
    logSession('loaded session from storage: %o', loaded
      ? { selection: loaded.selection, collectionName: loaded.collectionName, trackIndex: loaded.trackIndex, queueLength: loaded.queueTracks?.length }
      : null
    );
    setLastSession(loaded);
  }, []);

  const buildSnapshot = useCallback((): SessionSnapshot | null => {
    if (!selection || tracks.length === 0) return null;
    return {
      selection,
      collectionName,
      trackIndex: currentTrackIndex,
      queueTracks: tracks,
      playbackPosition,
      ...(trackId !== undefined && { trackId }),
      ...(trackTitle !== undefined && { trackTitle }),
      ...(trackArtist !== undefined && { trackArtist }),
      ...(trackImage !== undefined && { trackImage }),
    };
  }, [selection, collectionName, tracks, currentTrackIndex, trackId, trackTitle, trackArtist, trackImage, playbackPosition]);

  // Keep snapshotRef in sync so event-driven saves (beforeunload, interval) are always fresh.
  useEffect(() => {
    snapshotRef.current = buildSnapshot();
  }, [buildSnapshot]);

  // Debounced save on any state change.
  useEffect(() => {
    if (!selection || tracks.length === 0) {
      logSession('skipping save — no selection or empty tracks');
      return;
    }

    logSession('save effect fired — selection=%o, trackIndex=%d, position=%dms, queueLength=%d',
      selection, currentTrackIndex, Math.floor(playbackPosition), tracks.length
    );

    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      const snapshot = snapshotRef.current;
      if (!snapshot) return;
      logSession('saving session — selection=%o, trackIndex=%d, position=%dms, queueLength=%d',
        snapshot.selection, snapshot.trackIndex, Math.floor(snapshot.playbackPosition ?? 0), snapshot.queueTracks?.length
      );
      saveSession(snapshot);
      logSession('save complete');
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    };
  }, [selection, collectionName, tracks, currentTrackIndex, trackId, trackTitle, trackArtist, trackImage, playbackPosition]);

  const getLivePositionRef = useRef(getLivePosition);
  getLivePositionRef.current = getLivePosition;

  useEffect(() => {
    if (periodicTimerRef.current !== null) clearInterval(periodicTimerRef.current);

    periodicTimerRef.current = setInterval(async () => {
      const snapshot = snapshotRef.current;
      if (!snapshot) return;

      const livePos = await getLivePositionRef.current?.();
      if (livePos != null) snapshot.playbackPosition = livePos;

      logSession('periodic save — position=%dms', Math.floor(snapshot.playbackPosition ?? 0));
      saveSession(snapshot);
    }, PERIODIC_SAVE_INTERVAL_MS);

    return () => {
      if (periodicTimerRef.current !== null) clearInterval(periodicTimerRef.current);
    };
  }, []);

  // Save on tab close / page unload.
  useEffect(() => {
    const handleBeforeUnload = () => {
      const snapshot = snapshotRef.current;
      if (!snapshot) return;
      logSession('beforeunload save — position=%dms', Math.floor(snapshot.playbackPosition ?? 0));
      saveSession(snapshot);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const resetLastSession = useCallback(() => {
    clearSession();
    snapshotRef.current = null;
    setLastSession(null);
  }, []);

  return { lastSession, resetLastSession };
}
