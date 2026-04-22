import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import type { MediaTrack, PlaybackState, ProviderId } from '@/types/domain';
import type { PlaybackProvider, ProviderDescriptor } from '@/types/providers';

vi.mock('@/providers/registry', () => {
  const descriptors = new Map<string, ProviderDescriptor>();
  return {
    providerRegistry: {
      get: (id: string) => descriptors.get(id),
      getAll: () => Array.from(descriptors.values()),
      has: (id: string) => descriptors.has(id),
      register: (d: ProviderDescriptor) => descriptors.set(d.id, d),
      __clear: () => descriptors.clear(),
    },
  };
});

import { useProviderPlayback } from '../useProviderPlayback';
import { usePlaybackSubscription } from '../usePlaybackSubscription';
import { providerRegistry } from '@/providers/registry';

function makeTrack(id: string, image: string): MediaTrack {
  return {
    id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: `spotify:track:${id}` },
    name: `Track ${id}`,
    artists: 'Test Artist',
    album: 'Test Album',
    durationMs: 200_000,
    image,
  };
}

type RaceDescriptor = {
  descriptor: ProviderDescriptor;
  emit: (state: PlaybackState | null) => void;
};

function makeRaceDescriptor(): RaceDescriptor {
  const subscribers: Array<(state: PlaybackState | null) => void> = [];
  const emit = (state: PlaybackState | null) => {
    for (const cb of subscribers) cb(state);
  };

  const playback: PlaybackProvider = {
    providerId: 'spotify',
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    seek: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
    previous: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockImplementation((cb: (state: PlaybackState | null) => void) => {
      subscribers.push(cb);
      return () => {
        const i = subscribers.indexOf(cb);
        if (i !== -1) subscribers.splice(i, 1);
      };
    }),
    prepareTrack: vi.fn().mockImplementation((track: MediaTrack) => {
      emit({
        isPlaying: true,
        positionMs: 0,
        durationMs: track.durationMs,
        currentTrackId: track.id,
        currentPlaybackRef: track.playbackRef,
      });
    }),
    getLastPlayTime: vi.fn().mockReturnValue(0),
  };

  const descriptor: ProviderDescriptor = {
    id: 'spotify',
    name: 'Spotify',
    capabilities: {
      hasLikedCollection: true,
      hasSaveTrack: true,
      hasExternalLink: true,
    },
    auth: {
      providerId: 'spotify',
      isAuthenticated: vi.fn().mockReturnValue(true),
      getAccessToken: vi.fn().mockResolvedValue('token'),
      beginLogin: vi.fn().mockResolvedValue(undefined),
      handleCallback: vi.fn().mockResolvedValue(true),
      logout: vi.fn(),
    },
    catalog: {
      providerId: 'spotify',
      listCollections: vi.fn().mockResolvedValue([]),
      listTracks: vi.fn().mockResolvedValue([]),
    },
    playback,
  };

  return { descriptor, emit };
}

function useHarness(tracks: MediaTrack[], descriptor: ProviderDescriptor) {
  const [currentTrackIndex, setCurrentTrackIndexState] = useState(0);
  const tracksRef = useRef(tracks);
  const currentTrackIndexRef = useRef(0);
  const mediaTracksRef = useRef(tracks);
  const drivingProviderRef = useRef<ProviderId | null>('spotify');
  const expectedTrackIdRef = useRef<string | null>(null);
  const indexHistoryRef = useRef<number[]>([]);

  const setCurrentTrackIndex = useRef((v: number | ((prev: number) => number)) => {
    setCurrentTrackIndexState(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      currentTrackIndexRef.current = next;
      indexHistoryRef.current.push(next);
      return next;
    });
  }).current;

  const setTracks = useRef((_v: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => {}).current;

  const { playTrack } = useProviderPlayback({
    setCurrentTrackIndex,
    activeDescriptor: descriptor,
    mediaTracksRef,
    expectedTrackIdRef,
  });

  usePlaybackSubscription({
    activeDescriptor: descriptor,
    drivingProviderRef,
    tracksRef,
    currentTrackIndexRef,
    expectedTrackIdRef,
    setIsPlaying: () => {},
    setPlaybackPosition: () => {},
    setCurrentTrackIndex,
    setTracks,
  });

  return {
    playTrack,
    currentTrackIndex,
    indexHistory: indexHistoryRef.current,
    expectedTrackIdRef,
    tracks,
  };
}

describe('fresh-load album-art race', () => {
  let descriptor: ProviderDescriptor;

  beforeEach(() => {
    const race = makeRaceDescriptor();
    descriptor = race.descriptor;
    (providerRegistry as unknown as { __clear: () => void }).__clear();
    providerRegistry.register!(descriptor);
  });

  it('keeps currentTrackIndex at 0 when the next-track pre-warm emits a PlaybackState during a fresh playTrack(0)', async () => {
    // #given — a newly loaded two-track queue; the pre-warm of track 1 fires
    // a PlaybackState with currentTrackId = track-1.id, exactly reproducing
    // the fresh-load race introduced by commit f5689a4.
    const tracks = [makeTrack('track-0', 'art-0'), makeTrack('track-1', 'art-1')];
    const { result } = renderHook(() => useHarness(tracks, descriptor));

    // #when — drive the fresh-load path: playTrack(0) sets the guard,
    // awaits the adapter's playTrack for track 0, then pre-warms track 1
    // via prepareTrack — which synchronously emits the racing state.
    await act(async () => {
      await result.current.playTrack(0);
    });

    // #then — the guard set by the centralised expectedTrackIdRef owner must
    // have rejected the mismatched state. Every observed value of
    // currentTrackIndex during the transition is 0 — this rules out a
    // 0 → 1 → 0 flicker that a final-state-only assertion would miss.
    expect(result.current.indexHistory.every(v => v === 0)).toBe(true);
    expect(result.current.currentTrackIndex).toBe(0);

    // Derived album art must stay on track 0's image — the user-visible
    // symptom of the race is a brief (or persistent) flash of the wrong art.
    const imageShown = tracks[result.current.currentTrackIndex].image;
    expect(imageShown).toBe('art-0');
  });

  it('records at least one explicit setCurrentTrackIndex(0) call so the assertion is not vacuously true', async () => {
    // #given — same two-track fresh-load setup.
    const tracks = [makeTrack('track-0', 'art-0'), makeTrack('track-1', 'art-1')];
    const { result } = renderHook(() => useHarness(tracks, descriptor));

    // #when
    await act(async () => {
      await result.current.playTrack(0);
    });

    // #then — useProviderPlayback.playTrack always calls setCurrentTrackIndex
    // with the target index after the adapter resolves. Asserting this
    // guarantees the every-value-is-0 check above is meaningful — if the
    // history were empty, that assertion would pass trivially.
    expect(result.current.indexHistory.length).toBeGreaterThan(0);
    expect(result.current.indexHistory.includes(0)).toBe(true);
    expect(result.current.indexHistory.includes(1)).toBe(false);
  });
});
