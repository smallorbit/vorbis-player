import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useMediaTracksMirror } from '../useMediaTracksMirror';
import type { MediaTrack } from '@/types/domain';

function makeMediaTrack(id: string): MediaTrack {
  return {
    id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: `spotify:track:${id}` },
    name: id,
    artists: 'artist',
    album: 'album',
    durationMs: 0,
  };
}

describe('useMediaTracksMirror', () => {
  it('ref starts empty and is not updated when ref is empty', () => {
    const tracks = [{ id: 'a' }, { id: 'b' }];
    const { result } = renderHook(() => useMediaTracksMirror(tracks));
    // mediaTracksRef is empty — reorderMediaTracksToMatchTracks returns null, no update
    expect(result.current.current).toEqual([]);
  });

  it('ref is reordered when tracks change order and IDs match', () => {
    const initial = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const { result, rerender } = renderHook(({ tracks }) => useMediaTracksMirror(tracks), {
      initialProps: { tracks: initial },
    });

    // Manually populate the ref (simulating what callers do on load)
    act(() => {
      result.current.current = [makeMediaTrack('a'), makeMediaTrack('b'), makeMediaTrack('c')];
    });

    // Reorder: move 'a' to end
    const reordered = [{ id: 'b' }, { id: 'c' }, { id: 'a' }];
    act(() => {
      rerender({ tracks: reordered });
    });

    expect(result.current.current.map((m) => m.id)).toEqual(['b', 'c', 'a']);
  });

  it('ref is not updated when tracks length differs from ref length', () => {
    const initial = [{ id: 'a' }];
    const { result, rerender } = renderHook(({ tracks }) => useMediaTracksMirror(tracks), {
      initialProps: { tracks: initial },
    });

    act(() => {
      result.current.current = [makeMediaTrack('a'), makeMediaTrack('b')];
    });

    // tracks has 1 item, ref has 2 — lengths differ, no reorder
    act(() => {
      rerender({ tracks: [{ id: 'a' }] });
    });

    expect(result.current.current.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('ref is unchanged when same tracks reference is passed', () => {
    const tracks = [{ id: 'x' }, { id: 'y' }];
    const { result, rerender } = renderHook(({ tracks }) => useMediaTracksMirror(tracks), {
      initialProps: { tracks },
    });

    act(() => {
      result.current.current = [makeMediaTrack('x'), makeMediaTrack('y')];
    });

    const before = result.current.current;
    act(() => {
      rerender({ tracks });
    });

    // Same reference — useLayoutEffect skips (dependency unchanged), ref is left as-is
    expect(result.current.current.map((m) => m.id)).toEqual(['x', 'y']);
    expect(result.current.current[0].id).toBe(before[0].id);
  });
});
