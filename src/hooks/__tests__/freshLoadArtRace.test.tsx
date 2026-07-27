import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
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
import { queueStore } from '@/stores/queueStore';

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

function useHarness(descriptor: ProviderDescriptor) {
  const drivingProviderRef = useRef<ProviderId | null>('spotify');
  const expectedTrackIdRef = useRef<string | null>(null);

  const { playTrack } = useProviderPlayback({
    activeDescriptor: descriptor,
    expectedTrackIdRef,
  });

  usePlaybackSubscription({
    activeDescriptor: descriptor,
    drivingProviderRef,
    expectedTrackIdRef,
    setIsPlaying: () => {},
    setPlaybackPosition: () => {},
  });

  return { playTrack, expectedTrackIdRef };
}

describe('fresh-load album-art race', () => {
  let descriptor: ProviderDescriptor;
  // Every index committed through the store during the transition, in call
  // order. queueStore.setCurrentIndex is the single write path for the current
  // index — both playTrack's post-adapter commit and the subscription layer's
  // fallback index sync go through it — so spying on it observes even calls
  // the store would treat as no-ops (e.g. setCurrentIndex(0) while already 0).
  let indexHistory: number[];

  beforeEach(() => {
    const race = makeRaceDescriptor();
    descriptor = race.descriptor;
    (providerRegistry as unknown as { __clear: () => void }).__clear();
    providerRegistry.register!(descriptor);

    indexHistory = [];
    const realSetCurrentIndex = queueStore.setCurrentIndex;
    vi.spyOn(queueStore, 'setCurrentIndex').mockImplementation((index: number) => {
      indexHistory.push(index);
      realSetCurrentIndex(index);
    });
  });

  afterEach(() => {
    // Un-spy queueStore.setCurrentIndex so the next test's beforeEach captures
    // the real implementation instead of wrapping the previous spy.
    vi.restoreAllMocks();
  });

  it('keeps currentTrackIndex at 0 when the next-track pre-warm emits a PlaybackState during a fresh playTrack(0)', async () => {
    // #given — a newly loaded two-track queue; the pre-warm of track 1 fires
    // a PlaybackState with currentTrackId = track-1.id, exactly reproducing
    // the fresh-load race introduced by commit f5689a4.
    const tracks = [makeTrack('track-0', 'art-0'), makeTrack('track-1', 'art-1')];
    queueStore.replaceQueue(tracks);
    const { result } = renderHook(() => useHarness(descriptor));

    // #when — drive the fresh-load path: playTrack(0) sets the guard,
    // awaits the adapter's playTrack for track 0, then pre-warms track 1
    // via prepareTrack — which synchronously emits the racing state.
    await act(async () => {
      await result.current.playTrack(0);
    });

    // #then — the guard set by the centralised expectedTrackIdRef owner must
    // have rejected the mismatched state. Every index committed through
    // queueStore.setCurrentIndex during the transition is 0 — this rules out
    // a 0 → 1 → 0 flicker that a final-state-only assertion would miss.
    expect(indexHistory.every(v => v === 0)).toBe(true);
    expect(queueStore.getCurrentIndex()).toBe(0);

    // Derived album art must stay on track 0's image — the user-visible
    // symptom of the race is a brief (or persistent) flash of the wrong art.
    const imageShown = queueStore.getCurrentTrack()?.image;
    expect(imageShown).toBe('art-0');
  });

  it('records at least one explicit setCurrentIndex(0) commit so the assertion is not vacuously true', async () => {
    // #given — same two-track fresh-load setup.
    const tracks = [makeTrack('track-0', 'art-0'), makeTrack('track-1', 'art-1')];
    queueStore.replaceQueue(tracks);
    const { result } = renderHook(() => useHarness(descriptor));

    // #when
    await act(async () => {
      await result.current.playTrack(0);
    });

    // #then — useProviderPlayback.playTrack always commits the target index
    // via queueStore.setCurrentIndex after the adapter resolves. Asserting
    // this guarantees the every-value-is-0 check above is meaningful — if the
    // history were empty, that assertion would pass trivially.
    expect(indexHistory.length).toBeGreaterThan(0);
    expect(indexHistory.includes(0)).toBe(true);
    expect(indexHistory.includes(1)).toBe(false);
  });
});
