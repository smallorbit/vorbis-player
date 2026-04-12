import { useState, useEffect, useRef, useCallback } from 'react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { saveSession, loadSession } from '@/services/sessionPersistence';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { logSession } from '@/lib/debugLog';

const DEBOUNCE_MS = 1000;
const PERIODIC_SAVE_INTERVAL_MS = 20_000;

export function useSessionPersistence(
  collectionId: string | null,
  collectionName: string,
  collectionProvider: ProviderId | undefined,
  tracks: MediaTrack[],
  currentTrackIndex: number,
  trackId: string | undefined,
  trackTitle: string | undefined,
  trackArtist: string | undefined,
  trackImage: string | undefined,
  playbackPosition: number,
): { lastSession: SessionSnapshot | null } {
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
      ? { collectionId: loaded.collectionId, collectionName: loaded.collectionName, trackIndex: loaded.trackIndex, provider: loaded.collectionProvider, queueLength: loaded.queueTracks?.length }
      : null
    );
    setLastSession(loaded);
  }, []);

  const buildSnapshot = useCallback((): SessionSnapshot | null => {
    if (!collectionId || tracks.length === 0) return null;
    return {
      collectionId,
      collectionName,
      collectionProvider,
      trackIndex: currentTrackIndex,
      trackId,
      queueTracks: tracks,
      trackTitle,
      trackArtist,
      trackImage,
      playbackPosition,
    };
  }, [collectionId, collectionName, collectionProvider, tracks, currentTrackIndex, trackId, trackTitle, trackArtist, trackImage, playbackPosition]);

  // Keep snapshotRef in sync so event-driven saves (beforeunload, interval) are always fresh.
  useEffect(() => {
    snapshotRef.current = buildSnapshot();
  }, [buildSnapshot]);

  // Debounced save on any state change.
  useEffect(() => {
    if (!collectionId || tracks.length === 0) {
      logSession('skipping save — no collectionId or empty tracks');
      return;
    }

    logSession('save effect fired — collectionId=%s, provider=%s, trackIndex=%d, position=%dms, queueLength=%d',
      collectionId, collectionProvider, currentTrackIndex, Math.floor(playbackPosition), tracks.length
    );

    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      const snapshot = snapshotRef.current;
      if (!snapshot) return;
      logSession('saving session — collectionId=%s, provider=%s, trackIndex=%d, position=%dms, queueLength=%d',
        snapshot.collectionId, snapshot.collectionProvider, snapshot.trackIndex, Math.floor(snapshot.playbackPosition ?? 0), snapshot.queueTracks?.length
      );
      saveSession(snapshot);
      logSession('save complete');
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    };
  }, [collectionId, collectionName, collectionProvider, tracks, currentTrackIndex, trackId, trackTitle, trackArtist, trackImage, playbackPosition]);

  // Periodic save every 20 seconds during active playback.
  useEffect(() => {
    if (periodicTimerRef.current !== null) clearInterval(periodicTimerRef.current);

    periodicTimerRef.current = setInterval(() => {
      const snapshot = snapshotRef.current;
      if (!snapshot) return;
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

  return { lastSession };
}
