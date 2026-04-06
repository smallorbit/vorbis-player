import { useState, useEffect, useRef } from 'react';
import type { MediaTrack } from '@/types/domain';
import { saveSession, loadSession } from '@/services/sessionPersistence';
import type { SessionSnapshot } from '@/services/sessionPersistence';

const DEBOUNCE_MS = 1000;

export function useSessionPersistence(
  tracks: MediaTrack[],
  currentTrackIndex: number,
  collectionName: string,
): { lastSession: SessionSnapshot | null } {
  const [lastSession, setLastSession] = useState<SessionSnapshot | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    setLastSession(loadSession());
  }, []);

  useEffect(() => {
    if (tracks.length === 0) return;

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      saveSession({ tracks, currentTrackIndex, collectionName });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [tracks, currentTrackIndex, collectionName]);

  return { lastSession };
}
