import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Track } from '@/services/spotify';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { isProfilingEnabled } from '@/contexts/ProfilingContext';
import { shuffleArray } from '@/utils/shuffleArray';

// --- TrackListContext ---

interface TrackListContextValue {
  tracks: Track[];
  originalTracks: Track[];
  isLoading: boolean;
  error: string | null;
  shuffleEnabled: boolean;
  selectedPlaylistId: string | null;
  setTracks: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
  setOriginalTracks: (tracks: Track[]) => void;
  setIsLoading: (loading: boolean | ((prev: boolean) => boolean)) => void;
  setError: (error: string | null | ((prev: string | null) => string | null)) => void;
  setShuffleEnabled: (enabled: boolean) => void;
  setSelectedPlaylistId: (id: string | null | ((prev: string | null) => string | null)) => void;
  handleShuffleToggle: () => void;
}

// --- CurrentTrackContext ---

interface CurrentTrackContextValue {
  currentTrack: Track | null;
  currentTrackIndex: number;
  setCurrentTrackIndex: (index: number | ((prev: number) => number)) => void;
  showPlaylist: boolean;
  setShowPlaylist: (visible: boolean | ((prev: boolean) => boolean)) => void;
}

const TrackListContext = createContext<TrackListContextValue | null>(null);
const CurrentTrackContext = createContext<CurrentTrackContextValue | null>(null);

export function TrackProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [originalTracks, setOriginalTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shuffleEnabled, setShuffleEnabled] = useLocalStorage('vorbis-player-shuffle-enabled', false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const currentTrack = useMemo(
    () => tracks[currentTrackIndex] || null,
    [tracks, currentTrackIndex]
  );

  const handleShuffleToggle = useCallback(() => {
    if (originalTracks.length === 0) return;

    const current = tracks[currentTrackIndex];
    console.log(`[Queue] shuffleToggle — ${shuffleEnabled ? 'OFF' : 'ON'}, currentIndex=${currentTrackIndex}, current="${current?.name}", tracksLen=${tracks.length}, originalLen=${originalTracks.length}`);

    if (!shuffleEnabled) {
      const rest = originalTracks.filter(t => t.id !== current?.id);
      const shuffled = shuffleArray(rest);
      const newTracks = current ? [current, ...shuffled] : shuffled;
      setTracks(newTracks);
      setCurrentTrackIndex(0);
      console.log(`[Queue] shuffleToggle — shuffled: newIndex=0, newLen=${newTracks.length}`);
    } else {
      const currentTrackId = current?.id;
      const restoredIndex = currentTrackId
        ? originalTracks.findIndex(t => t.id === currentTrackId)
        : 0;
      setTracks(originalTracks);
      setCurrentTrackIndex(restoredIndex >= 0 ? restoredIndex : 0);
      console.log(`[Queue] shuffleToggle — restored original order: newIndex=${restoredIndex >= 0 ? restoredIndex : 0}, len=${originalTracks.length}`);
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
    showPlaylist,
    setShowPlaylist,
  }), [currentTrack, currentTrackIndex, showPlaylist]);

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

/** @deprecated Use useTrackListContext or useCurrentTrackContext instead */
export function useTrackContext() {
  const list = useTrackListContext();
  const current = useCurrentTrackContext();
  return { ...list, ...current };
}
