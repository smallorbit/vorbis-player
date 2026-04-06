import { useState, useEffect, useRef } from 'react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { saveSession, loadSession } from '@/services/sessionPersistence';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { logSession } from '@/lib/debugLog';

const DEBOUNCE_MS = 1000;

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
): { lastSession: SessionSnapshot | null } {
  const [lastSession, setLastSession] = useState<SessionSnapshot | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);

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

  useEffect(() => {
    if (!collectionId || tracks.length === 0) {
      logSession('skipping save — no collectionId or empty tracks');
      return;
    }

    logSession('save effect fired — collectionId=%s, provider=%s, trackIndex=%d, queueLength=%d',
      collectionId, collectionProvider, currentTrackIndex, tracks.length
    );

    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      logSession('saving session — collectionId=%s, provider=%s, trackIndex=%d, queueLength=%d',
        collectionId, collectionProvider, currentTrackIndex, tracks.length
      );
      saveSession({
        collectionId,
        collectionName,
        collectionProvider,
        trackIndex: currentTrackIndex,
        trackId,
        queueTracks: tracks,
        trackTitle,
        trackArtist,
        trackImage,
      });
      logSession('save complete');
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    };
  }, [collectionId, collectionName, collectionProvider, tracks, currentTrackIndex, trackId, trackTitle, trackArtist, trackImage]);

  return { lastSession };
}
