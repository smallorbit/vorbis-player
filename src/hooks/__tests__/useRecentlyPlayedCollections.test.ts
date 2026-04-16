import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecentlyPlayedCollections } from '../useRecentlyPlayedCollections';
import type { CollectionRef } from '@/types/domain';

const STORAGE_KEY = 'vorbis-player-recently-played';

function makeRef(overrides: Partial<CollectionRef> = {}): CollectionRef {
  return { provider: 'spotify', kind: 'playlist', id: 'playlist-1', ...overrides } as CollectionRef;
}

describe('useRecentlyPlayedCollections', () => {
  beforeEach(() => {
    window.localStorage.getItem = vi.fn().mockReturnValue(null);
    window.localStorage.setItem = vi.fn();
  });

  it('starts with an empty history', () => {
    // #when
    const { result } = renderHook(() => useRecentlyPlayedCollections());

    // #then
    expect(result.current.history).toEqual([]);
  });

  it('records a new entry at the front of history', () => {
    // #given
    const ref = makeRef();
    const { result } = renderHook(() => useRecentlyPlayedCollections());

    // #when
    act(() => {
      result.current.record(ref, 'My Playlist');
    });

    // #then
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toEqual({ ref, name: 'My Playlist' });
  });

  it('places the newest entry first when multiple are recorded', () => {
    // #given
    const ref1 = makeRef({ id: 'playlist-1' });
    const ref2 = makeRef({ id: 'playlist-2' });
    const { result } = renderHook(() => useRecentlyPlayedCollections());

    // #when
    act(() => {
      result.current.record(ref1, 'First');
    });
    act(() => {
      result.current.record(ref2, 'Second');
    });

    // #then
    expect(result.current.history[0]).toEqual({ ref: ref2, name: 'Second' });
    expect(result.current.history[1]).toEqual({ ref: ref1, name: 'First' });
  });

  it('moves a duplicate entry to the top without adding a second copy', () => {
    // #given
    const ref = makeRef({ id: 'playlist-1' });
    const otherRef = makeRef({ id: 'playlist-2' });
    const { result } = renderHook(() => useRecentlyPlayedCollections());

    act(() => {
      result.current.record(ref, 'First');
    });
    act(() => {
      result.current.record(otherRef, 'Other');
    });

    // #when
    act(() => {
      result.current.record(ref, 'First (revisited)');
    });

    // #then
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0]).toEqual({ ref, name: 'First (revisited)' });
    expect(result.current.history[1]).toEqual({ ref: otherRef, name: 'Other' });
  });

  it('caps history at 5 entries, dropping the oldest', () => {
    // #given
    const { result } = renderHook(() => useRecentlyPlayedCollections());

    // #when
    act(() => {
      for (let i = 1; i <= 6; i++) {
        result.current.record(makeRef({ id: `playlist-${i}` }), `Playlist ${i}`);
      }
    });

    // #then
    expect(result.current.history).toHaveLength(5);
    expect(result.current.history[0].ref).toMatchObject({ id: 'playlist-6' });
    expect(result.current.history[4].ref).toMatchObject({ id: 'playlist-2' });
  });

  it('persists history under the correct localStorage key', () => {
    // #given
    const ref = makeRef();
    const { result } = renderHook(() => useRecentlyPlayedCollections());

    // #when
    act(() => {
      result.current.record(ref, 'My Playlist');
    });

    // #then
    const lastCall = vi.mocked(window.localStorage.setItem).mock.lastCall;
    expect(lastCall?.[0]).toBe(STORAGE_KEY);
    expect(JSON.parse(lastCall![1] as string)[0]).toEqual({ ref, name: 'My Playlist' });
  });

  it('records and persists the imageUrl when provided', () => {
    // #given
    const ref = makeRef();
    const { result } = renderHook(() => useRecentlyPlayedCollections());

    // #when
    act(() => {
      result.current.record(ref, 'My Playlist', 'https://example.com/cover.jpg');
    });

    // #then
    expect(result.current.history[0]).toEqual({
      ref,
      name: 'My Playlist',
      imageUrl: 'https://example.com/cover.jpg',
    });
  });

  it('omits imageUrl when not provided', () => {
    // #given
    const ref = makeRef();
    const { result } = renderHook(() => useRecentlyPlayedCollections());

    // #when
    act(() => {
      result.current.record(ref, 'My Playlist');
    });

    // #then
    expect(result.current.history[0]).not.toHaveProperty('imageUrl');
  });

  it('omits imageUrl when null is passed', () => {
    // #given
    const ref = makeRef();
    const { result } = renderHook(() => useRecentlyPlayedCollections());

    // #when
    act(() => {
      result.current.record(ref, 'My Playlist', null);
    });

    // #then
    expect(result.current.history[0]).not.toHaveProperty('imageUrl');
  });

  it('loads persisted history from localStorage on init', () => {
    // #given
    const ref = makeRef();
    const stored = JSON.stringify([{ ref, name: 'Persisted Playlist' }]);
    window.localStorage.getItem = vi.fn((key: string) => {
      if (key === STORAGE_KEY) return stored;
      return null;
    });

    // #when
    const { result } = renderHook(() => useRecentlyPlayedCollections());

    // #then
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toEqual({ ref, name: 'Persisted Playlist' });
  });
});
