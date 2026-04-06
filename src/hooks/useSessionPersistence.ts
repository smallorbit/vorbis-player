import { useState, useEffect, useRef } from 'react';
import type { ProviderId } from '@/types/domain';
import { saveSession, loadSession } from '@/services/sessionPersistence';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { logSession } from '@/lib/debugLog';

const DEBOUNCE_MS = 1000;

export function useSessionPersistence(
  collectionId: string | null,
  collectionName: string,
  collectionProvider: ProviderId | undefined,
  trackIndex: number,
  trackId: string | undefined,
  trackOrder: string[],
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
      ? { collectionId: loaded.collectionId, collectionName: loaded.collectionName, trackIndex: loaded.trackIndex, provider: loaded.collectionProvider }
      : null
    );
    setLastSession(loaded);
  }, []);

  useEffect(() => {
    logSession('save effect fired — collectionId=%s, collectionName=%s, provider=%s, trackIndex=%d, trackTitle=%s',
      collectionId, collectionName, collectionProvider, trackIndex, trackTitle
    );

    if (!collectionId) {
      logSession('skipping save — no collectionId');
      return;
    }

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      logSession('saving session — collectionId=%s, provider=%s, trackIndex=%d',
        collectionId, collectionProvider, trackIndex
      );
      saveSession({ collectionId, collectionName, collectionProvider, trackIndex, trackId, trackOrder, trackTitle, trackArtist, trackImage });
      logSession('save complete');
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [collectionId, collectionName, collectionProvider, trackIndex, trackId, trackOrder, trackTitle, trackArtist, trackImage]);

  return { lastSession };
}
