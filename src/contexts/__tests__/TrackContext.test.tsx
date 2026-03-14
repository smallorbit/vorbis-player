import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { TrackProvider, useTrackListContext, useCurrentTrackContext } from '../TrackContext';
import { makeTrack } from '@/test/fixtures';

vi.mock('@/contexts/ProfilingContext', () => ({
  isProfilingEnabled: () => false,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <TrackProvider>{children}</TrackProvider>;
}

function useTrackContext() {
  return { ...useTrackListContext(), ...useCurrentTrackContext() };
}

describe('TrackContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it('currentTrack returns correct track at currentTrackIndex', () => {
    const { result } = renderHook(() => useTrackContext(), { wrapper });

    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' }), makeTrack({ id: 't3' })];

    act(() => {
      result.current.setTracks(tracks);
      result.current.setCurrentTrackIndex(1);
    });

    expect(result.current.currentTrack?.id).toBe('t2');
  });

  it('currentTrack returns null when tracks is empty', () => {
    const { result } = renderHook(() => useTrackContext(), { wrapper });

    expect(result.current.currentTrack).toBeNull();
  });

  it('handleShuffleToggle puts current track first in shuffled order', () => {
    const { result } = renderHook(() => useTrackContext(), { wrapper });

    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' }), makeTrack({ id: 't3' })];

    act(() => {
      result.current.setTracks(tracks);
      result.current.setOriginalTracks(tracks);
      result.current.setCurrentTrackIndex(1); // current = t2
    });

    act(() => {
      result.current.handleShuffleToggle();
    });

    // Current track should be first
    expect(result.current.tracks[0].id).toBe('t2');
    expect(result.current.currentTrackIndex).toBe(0);
    expect(result.current.shuffleEnabled).toBe(true);
  });

  it('handleShuffleToggle (disable) restores original order and finds correct index', () => {
    const { result } = renderHook(() => useTrackContext(), { wrapper });

    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' }), makeTrack({ id: 't3' })];

    act(() => {
      result.current.setTracks(tracks);
      result.current.setOriginalTracks(tracks);
      result.current.setCurrentTrackIndex(1);
    });

    // Enable shuffle
    act(() => {
      result.current.handleShuffleToggle();
    });

    // Disable shuffle
    act(() => {
      result.current.handleShuffleToggle();
    });

    // Should restore original order
    expect(result.current.tracks.map(t => t.id)).toEqual(['t1', 't2', 't3']);
    expect(result.current.shuffleEnabled).toBe(false);
    // Current track (t2) should be at index 1 in the original order
    expect(result.current.currentTrackIndex).toBe(1);
  });

  it('handleShuffleToggle is no-op when originalTracks is empty', () => {
    const { result } = renderHook(() => useTrackContext(), { wrapper });

    const initialTracks = result.current.tracks;

    act(() => {
      result.current.handleShuffleToggle();
    });

    expect(result.current.tracks).toBe(initialTracks);
    expect(result.current.shuffleEnabled).toBe(false);
  });

  it('shuffleEnabled persists to localStorage', () => {
    const { result } = renderHook(() => useTrackContext(), { wrapper });

    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })];

    act(() => {
      result.current.setTracks(tracks);
      result.current.setOriginalTracks(tracks);
      result.current.setCurrentTrackIndex(0);
    });

    act(() => {
      result.current.handleShuffleToggle();
    });

    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'vorbis-player-shuffle-enabled',
      'true'
    );
  });
});
