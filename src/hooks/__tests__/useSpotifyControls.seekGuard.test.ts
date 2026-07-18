import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MediaTrack, PlaybackState, ProviderId } from '@/types/domain';
import { makeMediaTrack } from '@/test/fixtures';

// The seek guard (#1671) rejects stale pre-seek position emits that would drag
// the timeline cursor back after a seek. Drive the hook's playback subscription
// directly and assert what the cursor (currentPosition) does.

let listeners: Array<(state: PlaybackState | null) => void> = [];
const seek = vi.fn().mockResolvedValue(undefined);

const descriptor = {
  id: 'spotify' as ProviderId,
  playback: {
    subscribe: (fn: (state: PlaybackState | null) => void) => {
      listeners.push(fn);
      return () => {
        listeners = listeners.filter((l) => l !== fn);
      };
    },
    getState: vi.fn().mockResolvedValue(null),
    seek,
  },
};

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: () => ({ activeDescriptor: descriptor }),
}));
vi.mock('@/providers/registry', () => ({
  providerRegistry: { get: vi.fn(() => descriptor) },
}));
vi.mock('@/lib/debugLog', () => ({ logSeek: vi.fn() }));

import { useSpotifyControls } from '../useSpotifyControls';

function state(positionMs: number, isPlaying = true): PlaybackState {
  return {
    isPlaying,
    positionMs,
    durationMs: 300_000,
    currentTrackId: 'track-1',
    currentPlaybackRef: null,
  };
}

function emit(s: PlaybackState) {
  act(() => {
    listeners.forEach((l) => l(s));
  });
}

const track: MediaTrack = makeMediaTrack({ id: 'track-1', provider: 'spotify' });

function render() {
  return renderHook(() =>
    useSpotifyControls({
      currentTrack: track,
      isLiked: false,
      isLikePending: false,
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onNext: vi.fn(),
      onPrevious: vi.fn(),
      onLikeToggle: vi.fn(),
    }),
  );
}

describe('useSpotifyControls seek guard (#1671)', () => {
  beforeEach(() => {
    listeners = [];
    seek.mockClear();
  });

  it('accepts position emits normally when no seek is pending', () => {
    const { result } = render();
    emit(state(10_000));
    expect(result.current.currentPosition).toBe(10_000);
    emit(state(11_000));
    expect(result.current.currentPosition).toBe(11_000);
  });

  it('moves the cursor to the seek target immediately and rejects a stale pre-seek emit', async () => {
    const { result } = render();
    emit(state(10_000));
    expect(result.current.currentPosition).toBe(10_000);

    // #when the user seeks forward to 2:00
    await act(async () => {
      await result.current.handleSeek(120_000);
    });
    // #then the cursor jumps to the target optimistically
    expect(result.current.currentPosition).toBe(120_000);
    expect(seek).toHaveBeenCalledWith(120_000);

    // #when a STALE pre-seek emit arrives (old position, far from target)
    emit(state(10_500));
    // #then it is rejected — the cursor stays at the seek target
    expect(result.current.currentPosition).toBe(120_000);
  });

  it('resumes tracking once a fresh emit lands near the seek target', async () => {
    const { result } = render();
    emit(state(10_000));

    await act(async () => {
      await result.current.handleSeek(120_000);
    });
    // stale emit rejected
    emit(state(10_500));
    expect(result.current.currentPosition).toBe(120_000);

    // #when a fresh emit near the target arrives, the guard clears...
    emit(state(120_400));
    expect(result.current.currentPosition).toBe(120_400);

    // ...and subsequent emits flow normally again
    emit(state(121_400));
    expect(result.current.currentPosition).toBe(121_400);
  });

  it('still syncs isPlaying while rejecting a stale position', async () => {
    const { result } = render();
    emit(state(10_000, true));

    await act(async () => {
      await result.current.handleSeek(120_000);
    });

    // stale position + paused → cursor held, but isPlaying reflects the emit
    emit(state(9_000, false));
    expect(result.current.currentPosition).toBe(120_000);
    expect(result.current.isPlaying).toBe(false);
  });
});
