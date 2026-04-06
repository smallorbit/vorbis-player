import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { MediaTrack } from '@/types/domain';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { isProfilingEnabled } from '@/contexts/ProfilingContext';
import { shuffleArray } from '@/utils/shuffleArray';
import { logQueue } from '@/lib/debugLog';
import { STORAGE_KEYS } from '@/constants/storage';

// --- TrackListContext ---

interface TrackListContextValue {
  tracks: MediaTrack[];
  originalTracks: MediaTrack[];
  isLoading: boolean;
  error: string | null;
  shuffleEnabled: boolean;
  selectedPlaylistId: string | null;
  setTracks: (tracks: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => void;
  setOriginalTracks: (tracks: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => void;
  setIsLoading: (loading: boolean | ((prev: boolean) => boolean)) => void;
  setError: (error: string | null | ((prev: string | null) => string | null)) => void;
  setShuffleEnabled: (enabled: boolean) => void;
  setSelectedPlaylistId: (id: string | null | ((prev: string | null) => string | null)) => void;
  handleShuffleToggle: () => void;
}

// --- CurrentTrackContext ---

interface CurrentTrackContextValue {
  currentTrack: MediaTrack | null;
  currentTrackIndex: number;
  setCurrentTrackIndex: (index: number | ((prev: number) => number)) => void;
  showQueue: boolean;
  setShowQueue: (visible: boolean | ((prev: boolean) => boolean)) => void;
}

const TrackListContext = createContext<TrackListContextValue | null>(null);
const CurrentTrackContext = createContext<CurrentTrackContextValue | null>(null);

export function TrackProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<MediaTrack[]>([]);
  const [originalTracks, setOriginalTracks] = useState<MediaTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shuffleEnabled, setShuffleEnabled] = useLocalStorage(STORAGE_KEYS.SHUFFLE_ENABLED, false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showQueue, setShowQueue] = useState(false);

  const currentTrack = useMemo(
    () => tracks[currentTrackIndex] || null,
    [tracks, currentTrackIndex]
  );

  const handleShuffleToggle = useCallback(() => {
    if (originalTracks.length === 0) return;

    const current = tracks[currentTrackIndex];
    logQueue(
      'shuffleToggle — %s, currentIndex=%d, current="%s", tracksLen=%d, originalLen=%d',
      shuffleEnabled ? 'OFF' : 'ON',
      currentTrackIndex,
      current?.name ?? '',
      tracks.length,
      originalTracks.length,
    );

    if (!shuffleEnabled) {
      // Shuffle using current track data (not originalTracks objects, which may be stale)
      const rest = tracks.filter(t => t.id !== current?.id);
      const shuffled = shuffleArray(rest);
      const newTracks = current ? [current, ...shuffled] : shuffled;
      setTracks(newTracks);
      setCurrentTrackIndex(0);
      logQueue('shuffleToggle — shuffled: newIndex=0, newLen=%d', newTracks.length);
    } else {
      // Restore original order by reordering current tracks (preserves up-to-date track data)
      const currentTrackId = current?.id;
      const originalOrderIds = originalTracks.map(t => t.id);
      const byId = new Map(tracks.map(t => [t.id, t]));
      const reordered = [
        ...originalOrderIds.flatMap(id => { const t = byId.get(id); return t ? [t] : []; }),
        ...tracks.filter(t => !originalOrderIds.includes(t.id)),
      ];
      const restoredIndex = currentTrackId
        ? reordered.findIndex(t => t.id === currentTrackId)
        : 0;
      setTracks(reordered);
      setCurrentTrackIndex(restoredIndex >= 0 ? restoredIndex : 0);
      logQueue('shuffleToggle — restored original order: newIndex=%d, len=%d', restoredIndex >= 0 ? restoredIndex : 0, reordered.length);
    }

    setShuffleEnabled(!shuffleEnabled);
  }, [originalTracks, tracks, currentTrackIndex, shuffleEnabled, setShuffleEnabled]);

  const trackListValue = useMemo<TrackListContextValue>(() => ({
    tracks,
    originalTracks,
    isLoading,
    error,
    shuffleEnabled,
    selectedPlaylistId,
    setTracks,
    setOriginalTracks,
    setIsLoading,
    setError,
    setShuffleEnabled,
    setSelectedPlaylistId,
    handleShuffleToggle,
  }), [
    tracks,
    originalTracks,
    isLoading,
    error,
    shuffleEnabled,
    selectedPlaylistId,
    setShuffleEnabled,
    handleShuffleToggle,
  ]);

  const currentTrackValue = useMemo<CurrentTrackContextValue>(() => ({
    currentTrack,
    currentTrackIndex,
    setCurrentTrackIndex,
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
