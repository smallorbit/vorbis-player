import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    onPlayerStateChanged: vi.fn().mockReturnValue(vi.fn()),
    lastPlayTrackTime: 0,
  },
}));

import { useAutoAdvance } from '../useAutoAdvance';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { makeTrack, makeSpotifyPlaybackState } from '@/test/fixtures';
import { ProviderWrapper } from '@/test/providerTestUtils';

const opts = { wrapper: ProviderWrapper };

describe('useAutoAdvance', () => {
  const playTrack = vi.fn();
  const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' }), makeTrack({ id: 't3' })];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (spotifyPlayer as unknown as { lastPlayTrackTime: number }).lastPlayTrackTime = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not subscribe when enabled=false', () => {
    renderHook(() =>
      useAutoAdvance({ tracks, currentTrackIndex: 0, playTrack, enabled: false }),
      opts
    );

    // The hook should not have called spotifyPlayer.onPlayerStateChanged
    // (it now goes through the provider adapter, but the adapter wraps the same mock)
    expect(spotifyPlayer.onPlayerStateChanged).not.toHaveBeenCalled();
  });

  it('does not subscribe when tracks is empty', () => {
    renderHook(() =>
      useAutoAdvance({ tracks: [], currentTrackIndex: 0, playTrack }),
      opts
    );

    expect(spotifyPlayer.onPlayerStateChanged).not.toHaveBeenCalled();
  });

  it('advances when timeRemaining <= endThreshold', () => {
    renderHook(() =>
      useAutoAdvance({ tracks, currentTrackIndex: 0, playTrack, endThreshold: 2000 }),
      opts
    );

    // The provider adapter subscribe wraps spotifyPlayer.onPlayerStateChanged,
    // so the last call to the mock has our callback
    const subscribeCalls = vi.mocked(spotifyPlayer.onPlayerStateChanged).mock.calls;
    expect(subscribeCalls.length).toBeGreaterThan(0);
    const sdkCallback = subscribeCalls[subscribeCalls.length - 1][0];

    // Simulate near-end: position 208500, duration 210000, timeRemaining = 1500ms
    sdkCallback(makeSpotifyPlaybackState({
      paused: false,
      position: 208500,
      track_window: {
        current_track: {
          id: 't1',
          uri: 'spotify:track:t1',
          name: 'Test',
          duration_ms: 210000,
          artists: [{ name: 'A', uri: 'u' }],
          album: { name: 'Al', uri: 'u', images: [] },
        },
        next_tracks: [],
        previous_tracks: [],
      },
    }));

    vi.advanceTimersByTime(500);
    expect(playTrack).toHaveBeenCalledWith(1, true);
  });

  it('advances on pause-at-position-0 (natural track end)', () => {
    renderHook(() =>
      useAutoAdvance({ tracks, currentTrackIndex: 0, playTrack }),
      opts
    );

    const subscribeCalls = vi.mocked(spotifyPlayer.onPlayerStateChanged).mock.calls;
    const sdkCallback = subscribeCalls[subscribeCalls.length - 1][0];

    // Simulate "was playing" state first
    sdkCallback(makeSpotifyPlaybackState({ paused: false, position: 100000 }));

    // Then simulate natural end: paused at position 0
    sdkCallback(makeSpotifyPlaybackState({ paused: true, position: 0 }));

    vi.advanceTimersByTime(500);
    expect(playTrack).toHaveBeenCalledWith(1, true);
  });

  it('does NOT advance if msSinceLastPlay < PLAY_COOLDOWN_MS', () => {
    // Set lastPlayTrackTime to very recent
    (spotifyPlayer as unknown as { lastPlayTrackTime: number }).lastPlayTrackTime = Date.now();

    renderHook(() =>
      useAutoAdvance({ tracks, currentTrackIndex: 0, playTrack }),
      opts
    );

    const subscribeCalls = vi.mocked(spotifyPlayer.onPlayerStateChanged).mock.calls;
    const sdkCallback = subscribeCalls[subscribeCalls.length - 1][0];

    // Simulate "was playing"
    sdkCallback(makeSpotifyPlaybackState({ paused: false, position: 100000 }));

    // Then simulate pause at 0 (but within cooldown)
    sdkCallback(makeSpotifyPlaybackState({ paused: true, position: 0 }));

    vi.advanceTimersByTime(500);
    expect(playTrack).not.toHaveBeenCalled();
  });

  it('wraps from last track to index 0', () => {
    renderHook(() =>
      useAutoAdvance({ tracks, currentTrackIndex: 2, playTrack, endThreshold: 2000 }),
      opts
    );

    const subscribeCalls = vi.mocked(spotifyPlayer.onPlayerStateChanged).mock.calls;
    const sdkCallback = subscribeCalls[subscribeCalls.length - 1][0];

    sdkCallback(makeSpotifyPlaybackState({
      paused: false,
      position: 209000,
      track_window: {
        current_track: {
          id: 't3',
          uri: 'spotify:track:t3',
          name: 'Test',
          duration_ms: 210000,
          artists: [{ name: 'A', uri: 'u' }],
          album: { name: 'Al', uri: 'u', images: [] },
        },
        next_tracks: [],
        previous_tracks: [],
      },
    }));

    vi.advanceTimersByTime(500);
    expect(playTrack).toHaveBeenCalledWith(0, true);
  });
});
