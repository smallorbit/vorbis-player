import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { useRef } from 'react';
import { TrackProvider, useTrackListContext, useCurrentTrackContext } from '../TrackContext';
import { useQueueManagement } from '@/hooks/useQueueManagement';
import { makeTrack } from '@/test/fixtures';
import type { MediaTrack } from '@/types/domain';

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
    // #given
    const { result } = renderHook(() => useTrackContext(), { wrapper });
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' }), makeTrack({ id: 't3' })];

    // #when
    act(() => {
      result.current.setTracks(tracks);
      result.current.setCurrentTrackIndex(1);
    });

    // #then
    expect(result.current.currentTrack?.id).toBe('t2');
  });

  it('currentTrack returns null when tracks is empty', () => {
    const { result } = renderHook(() => useTrackContext(), { wrapper });

    expect(result.current.currentTrack).toBeNull();
  });

  it('handleShuffleToggle puts current track first in shuffled order', () => {
    // #given
    const { result } = renderHook(() => useTrackContext(), { wrapper });
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' }), makeTrack({ id: 't3' })];

    act(() => {
      result.current.setTracks(tracks);
      result.current.setOriginalTracks(tracks);
      result.current.setCurrentTrackIndex(1);
    });

    // #when
    act(() => {
      result.current.handleShuffleToggle();
    });

    // #then
    expect(result.current.tracks[0].id).toBe('t2');
    expect(result.current.currentTrackIndex).toBe(0);
    expect(result.current.shuffleEnabled).toBe(true);
  });

  it('handleShuffleToggle (disable) restores original order and finds correct index', () => {
    // #given
    const { result } = renderHook(() => useTrackContext(), { wrapper });
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' }), makeTrack({ id: 't3' })];

    act(() => {
      result.current.setTracks(tracks);
      result.current.setOriginalTracks(tracks);
      result.current.setCurrentTrackIndex(1);
    });

    // #when - enable shuffle
    act(() => {
      result.current.handleShuffleToggle();
    });

    // #when - disable shuffle
    act(() => {
      result.current.handleShuffleToggle();
    });

    // #then
    expect(result.current.tracks.map(t => t.id)).toEqual(['t1', 't2', 't3']);
    expect(result.current.shuffleEnabled).toBe(false);
    expect(result.current.currentTrackIndex).toBe(1);
  });

  it('handleShuffleToggle is no-op when originalTracks is empty', () => {
    // #given
    const { result } = renderHook(() => useTrackContext(), { wrapper });
    const initialTracks = result.current.tracks;

    // #when
    act(() => {
      result.current.handleShuffleToggle();
    });

    // #then
    expect(result.current.tracks).toBe(initialTracks);
    expect(result.current.shuffleEnabled).toBe(false);
  });

  it('shuffleEnabled persists to localStorage', () => {
    // #given
    const { result } = renderHook(() => useTrackContext(), { wrapper });
    const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })];

    act(() => {
      result.current.setTracks(tracks);
      result.current.setOriginalTracks(tracks);
      result.current.setCurrentTrackIndex(0);
    });

    // #when
    act(() => {
      result.current.handleShuffleToggle();
    });

    // #then
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'vorbis-player-shuffle-enabled',
      'true'
    );
  });

  it('add-while-shuffled then un-shuffle restores original order with added tracks appended', () => {
    // Composes the full OpenSpec scenario:
    // WHEN the user adds tracks while shuffle is enabled and then disables shuffle,
    // THEN the queue restores the original unshuffled order with the added tracks
    // appended after it, AND the restored order is not the shuffled arrangement.

    function useComposed() {
      const ctx = useTrackContext();
      // mediaTracksRef mirrors what usePlayerLogic provides to useQueueManagement;
      // its contents are kept in sync below but are not the subject of this test.
      const mediaTracksRef = useRef<MediaTrack[]>([]);
      const queueOps = useQueueManagement({
        trackOps: {
          setTracks: ctx.setTracks,
          setOriginalTracks: ctx.setOriginalTracks,
          setCurrentTrackIndex: ctx.setCurrentTrackIndex,
          mediaTracksRef,
        },
        tracks: ctx.tracks,
        currentTrackIndex: ctx.currentTrackIndex,
        shuffleEnabled: ctx.shuffleEnabled,
        loadCollection: vi.fn<() => Promise<number>>().mockResolvedValue(0),
        handleBackToLibrary: vi.fn(),
        activeDescriptor: undefined,
        getDescriptor: vi.fn().mockReturnValue(undefined),
        getDrivingProviderDescriptor: vi.fn().mockReturnValue(undefined),
      });
      return { ...ctx, ...queueOps, mediaTracksRef };
    }

    // #given — ordered queue [t1, t2, t3], shuffle is OFF
    const { result } = renderHook(() => useComposed(), { wrapper });
    const originalTracks = [
      makeTrack({ id: 't1' }),
      makeTrack({ id: 't2' }),
      makeTrack({ id: 't3' }),
    ];

    act(() => {
      result.current.setTracks(originalTracks);
      result.current.setOriginalTracks(originalTracks);
      result.current.mediaTracksRef.current = [...originalTracks];
      result.current.setCurrentTrackIndex(0);
    });

    // #when — enable shuffle (t1 moves to front; rest is shuffled).
    // Math.random pinned to 0 forces the Fisher-Yates swap so the shuffled
    // order is deterministically [t1, t3, t2] — never the identity permutation,
    // which a 2-element shuffle would otherwise produce 50% of the time.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    act(() => {
      result.current.handleShuffleToggle();
    });
    randomSpy.mockRestore();

    expect(result.current.shuffleEnabled).toBe(true);
    const shuffledIds = result.current.tracks.map((t) => t.id);
    expect(shuffledIds).toEqual(['t1', 't3', 't2']);

    // #when — add new tracks via queueTracksDirectly while shuffle is ON
    const newTracks = [makeTrack({ id: 'n1' }), makeTrack({ id: 'n2' })];

    act(() => {
      result.current.queueTracksDirectly(newTracks);
    });

    // #when — disable shuffle (restore original order + appended tracks)
    act(() => {
      result.current.handleShuffleToggle();
    });

    // #then — shuffle is off
    expect(result.current.shuffleEnabled).toBe(false);

    // #then — final queue is the original unshuffled order with added tracks appended
    const finalIds = result.current.tracks.map((t) => t.id);
    expect(finalIds).toEqual(['t1', 't2', 't3', 'n1', 'n2']);

    // #then — final order is not the shuffled arrangement with new tracks appended
    const shuffledPlusNew = [...shuffledIds, 'n1', 'n2'];
    expect(finalIds).not.toEqual(shuffledPlusNew);
  });
});
