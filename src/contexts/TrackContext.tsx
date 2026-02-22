import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { Track } from '@/services/spotify';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface TrackContextValue {
  // State
  tracks: Track[];
  originalTracks: Track[];
  currentTrackIndex: number;
  isLoading: boolean;
  error: string | null;
  shuffleEnabled: boolean;
  selectedPlaylistId: string | null;
  showPlaylist: boolean;
  currentTrack: Track | null;
  // Setters
  setTracks: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
  setOriginalTracks: (tracks: Track[]) => void;
  setCurrentTrackIndex: (index: number | ((prev: number) => number)) => void;
  setIsLoading: (loading: boolean | ((prev: boolean) => boolean)) => void;
  setError: (error: string | null | ((prev: string | null) => string | null)) => void;
  setShuffleEnabled: (enabled: boolean) => void;
  setSelectedPlaylistId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setShowPlaylist: (visible: boolean | ((prev: boolean) => boolean)) => void;
  // Actions
  handleShuffleToggle: () => void;
}

const TrackContext = createContext<TrackContextValue | null>(null);

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

    if (!shuffleEnabled) {
      const rest = originalTracks.filter(t => t.id !== current?.id);
      const shuffled = [...rest];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const newTracks = current ? [current, ...shuffled] : shuffled;
      setTracks(newTracks);
      setCurrentTrackIndex(0);
    } else {
      const currentTrackId = current?.id;
      const restoredIndex = currentTrackId
        ? originalTracks.findIndex(t => t.id === currentTrackId)
        : 0;
      setTracks(originalTracks);
      setCurrentTrackIndex(restoredIndex >= 0 ? restoredIndex : 0);
    }

    setShuffleEnabled(!shuffleEnabled);
  }, [originalTracks, tracks, currentTrackIndex, shuffleEnabled, setShuffleEnabled]);

  const value = useMemo<TrackContextValue>(() => ({
    tracks,
    originalTracks,
    currentTrackIndex,
    isLoading,
    error,
    shuffleEnabled,
    selectedPlaylistId,
    showPlaylist,
    currentTrack,
    setTracks,
    setOriginalTracks,
    setCurrentTrackIndex,
    setIsLoading,
    setError,
    setShuffleEnabled,
    setSelectedPlaylistId,
    setShowPlaylist,
    handleShuffleToggle,
  }), [
    tracks,
    originalTracks,
    currentTrackIndex,
    isLoading,
    error,
    shuffleEnabled,
    selectedPlaylistId,
    showPlaylist,
    currentTrack,
    setShuffleEnabled,
    handleShuffleToggle,
  ]);

  return <TrackContext.Provider value={value}>{children}</TrackContext.Provider>;
}

export function useTrackContext(): TrackContextValue {
  const ctx = useContext(TrackContext);
  if (!ctx) throw new Error('useTrackContext must be used within TrackProvider');
  return ctx;
}
