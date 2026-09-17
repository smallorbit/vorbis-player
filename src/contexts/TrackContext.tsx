import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useSyncExternalStore } from 'react';
import type { MediaTrack, PlaybackSelection } from '@/types/domain';
import { isProfilingEnabled } from '@/contexts/ProfilingContext';
import { queueStore } from '@/stores/queueStore';
import { shouldUseMockProvider } from '@/providers/mock/shouldUseMockProvider';

// --- TrackListContext ---
//
// Queue state (tracks/originalTracks/currentIndex/shuffle) is owned by
// `queueStore`; this context is the React read bridge plus the remaining
// load-status state (isLoading/error/selection). Mutations go through the
// store's mutators, not through context setters.

interface TrackListContextValue {
  tracks: MediaTrack[];
  originalTracks: MediaTrack[];
  isLoading: boolean;
  error: string | null;
  shuffleEnabled: boolean;
  selection: PlaybackSelection | null;
  setIsLoading: (loading: boolean | ((prev: boolean) => boolean)) => void;
  setError: (error: string | null | ((prev: string | null) => string | null)) => void;
  setSelection: (selection: PlaybackSelection | null | ((prev: PlaybackSelection | null) => PlaybackSelection | null)) => void;
  handleShuffleToggle: () => void;
}

// --- CurrentTrackContext ---

interface CurrentTrackContextValue {
  currentTrack: MediaTrack | null;
  currentTrackIndex: number;
  showQueue: boolean;
  setShowQueue: (visible: boolean | ((prev: boolean) => boolean)) => void;
}

const TrackListContext = createContext<TrackListContextValue | null>(null);
const CurrentTrackContext = createContext<CurrentTrackContextValue | null>(null);

export function TrackProvider({ children }: { children: React.ReactNode }) {
  const queue = useSyncExternalStore(queueStore.subscribe, queueStore.getSnapshot);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<PlaybackSelection | null>(null);
  const [showQueue, setShowQueue] = useState(false);

  const { tracks, originalTracks, currentIndex: currentTrackIndex, shuffle: shuffleEnabled } = queue;

  const currentTrack = useMemo(
    () => tracks[currentTrackIndex] || null,
    [tracks, currentTrackIndex]
  );

  const trackListValue = useMemo<TrackListContextValue>(() => ({
    tracks,
    originalTracks,
    isLoading,
    error,
    shuffleEnabled,
    selection,
    setIsLoading,
    setError,
    setSelection,
    handleShuffleToggle: queueStore.toggleShuffle,
  }), [
    tracks,
    originalTracks,
    isLoading,
    error,
    shuffleEnabled,
    selection,
  ]);

  const currentTrackValue = useMemo<CurrentTrackContextValue>(() => ({
    currentTrack,
    currentTrackIndex,
    showQueue,
    setShowQueue,
  }), [currentTrack, currentTrackIndex, showQueue]);

  const profilingRef = useRef(0);
  useEffect(() => {
    if (!isProfilingEnabled()) return;
    profilingRef.current += 1;
    console.debug(`[Profiling] TrackListContext update #${profilingRef.current}`);
  }, [trackListValue]);

  const currentProfilingRef = useRef(0);
  useEffect(() => {
    if (!isProfilingEnabled()) return;
    currentProfilingRef.current += 1;
    console.debug(`[Profiling] CurrentTrackContext update #${currentProfilingRef.current}`);
  }, [currentTrackValue]);

  useEffect(() => {
    if (!shouldUseMockProvider()) return;

    const handleSetQueue = (e: Event) => {
      const tracks = (e as CustomEvent<MediaTrack[]>).detail;
      queueStore.replaceQueue(tracks);
    };

    const handleReset = () => {
      queueStore.clear();
    };

    window.addEventListener('mock:set-queue', handleSetQueue);
    window.addEventListener('mock:reset', handleReset);
    return () => {
      window.removeEventListener('mock:set-queue', handleSetQueue);
      window.removeEventListener('mock:reset', handleReset);
    };
  }, []);

  return (
    <TrackListContext.Provider value={trackListValue}>
      <CurrentTrackContext.Provider value={currentTrackValue}>
        {children}
      </CurrentTrackContext.Provider>
    </TrackListContext.Provider>
  );
}

export function useTrackListContext(): TrackListContextValue {
  const ctx = useContext(TrackListContext);
  if (!ctx) throw new Error('useTrackListContext must be used within TrackProvider');
  return ctx;
}

export function useCurrentTrackContext(): CurrentTrackContextValue {
  const ctx = useContext(CurrentTrackContext);
  if (!ctx) throw new Error('useCurrentTrackContext must be used within TrackProvider');
  return ctx;
}
