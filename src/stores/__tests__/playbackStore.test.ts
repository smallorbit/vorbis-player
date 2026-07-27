import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PlaybackState, ProviderId } from '@/types/domain';

// Controllable fake registry: tests register fake providers, capture their
// subscribe listeners, and emit provider events straight into the store's
// fan-out pipeline.
type Listener = (state: PlaybackState | null) => void;

interface FakeProvider {
  id: ProviderId;
  listeners: Listener[];
  emit: (state: PlaybackState | null) => void;
  playback: {
    subscribe: (cb: Listener) => () => void;
    getState: ReturnType<typeof vi.fn>;
    seek: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  };
}

const fakeProviders = new Map<string, FakeProvider>();

function makeFakeProvider(id: ProviderId): FakeProvider {
  const listeners: Listener[] = [];
  const provider: FakeProvider = {
    id,
    listeners,
    emit: (state) => listeners.forEach((cb) => cb(state)),
    playback: {
      subscribe: vi.fn((cb: Listener) => {
        listeners.push(cb);
        return () => {
          const i = listeners.indexOf(cb);
          if (i !== -1) listeners.splice(i, 1);
        };
      }),
      getState: vi.fn().mockResolvedValue(null),
      seek: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
    },
  };
  fakeProviders.set(id, provider);
  return provider;
}

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    getAll: () => [...fakeProviders.values()],
    get: (id: string) => fakeProviders.get(id),
  },
}));

import { playbackStore } from '@/stores/playbackStore';
import { queueStore } from '@/stores/queueStore';
import type { MediaTrack } from '@/types/domain';

function makeTrack(id: string, provider: ProviderId = 'spotify'): MediaTrack {
  return {
    id,
    provider,
    playbackRef: { provider, ref: `ref-${id}` },
    name: `Track ${id}`,
    artists: 'Artist',
    album: 'Album',
    durationMs: 200_000,
    genres: [],
  };
}

function playing(trackId: string, positionMs = 1000, overrides?: Partial<PlaybackState>): PlaybackState {
  return {
    isPlaying: true,
    positionMs,
    durationMs: 200_000,
    currentTrackId: trackId,
    currentPlaybackRef: { provider: 'spotify', ref: `ref-${trackId}` },
    ...overrides,
  };
}

describe('playbackStore', () => {
  let spotify: FakeProvider;
  let dropbox: FakeProvider;
  let detach: () => void;

  beforeEach(() => {
    fakeProviders.clear();
    queueStore.__resetForTests();
    playbackStore.__resetForTests();
    spotify = makeFakeProvider('spotify');
    dropbox = makeFakeProvider('dropbox');
    detach = playbackStore.attach();
  });

  afterEach(() => {
    detach();
    vi.restoreAllMocks();
  });

  describe('driving-provider resolver (#1694)', () => {
    it('resolves track provider → driving provider → active fallback, in that order', () => {
      // #given — nothing set
      expect(playbackStore.resolveDrivingProviderId()).toBeNull();

      // #when — only the active fallback is known
      playbackStore.setActiveProviderFallback('spotify');
      // #then
      expect(playbackStore.resolveDrivingProviderId()).toBe('spotify');

      // #when — a driving provider takes over
      playbackStore.setDrivingProvider('dropbox');
      // #then — driving wins over active
      expect(playbackStore.resolveDrivingProviderId()).toBe('dropbox');

      // #then — an explicit track provider wins over everything
      expect(playbackStore.resolveDrivingProviderId('spotify')).toBe('spotify');
    });

    it('getDrivingDescriptor resolves through the registry', () => {
      // #given
      playbackStore.setDrivingProvider('dropbox');

      // #then
      expect(playbackStore.getDrivingDescriptor()).toBe(fakeProviders.get('dropbox'));
      expect(playbackStore.getDrivingDescriptor('spotify')).toBe(fakeProviders.get('spotify'));
    });
  });

  describe('single fan-out pipeline', () => {
    it('accepts events only from the resolved driving provider', () => {
      // #given — spotify drives
      playbackStore.setDrivingProvider('spotify');

      // #when — the non-driving provider emits
      dropbox.emit(playing('d1', 5000));

      // #then — ignored
      expect(playbackStore.getSnapshot().isPlaying).toBe(false);
      expect(playbackStore.getSnapshot().positionMs).toBe(0);

      // #when — the driving provider emits
      spotify.emit(playing('s1', 5000));

      // #then — committed
      const snap = playbackStore.getSnapshot();
      expect(snap.isPlaying).toBe(true);
      expect(snap.positionMs).toBe(5000);
      expect(snap.durationMs).toBe(200_000);
      expect(snap.currentTrackId).toBe('s1');
    });

    it('a null state resets isPlaying and position', () => {
      // #given
      playbackStore.setDrivingProvider('spotify');
      spotify.emit(playing('s1', 5000));

      // #when
      spotify.emit(null);

      // #then
      expect(playbackStore.getSnapshot().isPlaying).toBe(false);
      expect(playbackStore.getSnapshot().positionMs).toBe(0);
    });

    it('falls back to the active provider for event filtering before anything drives', () => {
      // #given — no driving provider yet, dropbox is the active provider
      playbackStore.setActiveProviderFallback('dropbox');

      // #when
      dropbox.emit(playing('d1', 700));

      // #then
      expect(playbackStore.getSnapshot().isPlaying).toBe(true);
      expect(playbackStore.getSnapshot().positionMs).toBe(700);
    });
  });

  describe('transition guard', () => {
    beforeEach(() => {
      playbackStore.setDrivingProvider('spotify');
      queueStore.replaceQueue([makeTrack('a'), makeTrack('b'), makeTrack('c')], { currentIndex: 0 });
    });

    it('while a transition is pending, events for other tracks cannot flip the queue index', () => {
      // #given — transitioning to track c
      playbackStore.beginTransition('c');

      // #when — a stale event for track b arrives
      spotify.emit(playing('b'));

      // #then — the index holds
      expect(queueStore.getCurrentIndex()).toBe(0);

      // #when — the expected track's event arrives (guard consumed) and then a
      // later event for b arrives after the transition completed
      spotify.emit(playing('c'));
      expect(queueStore.getCurrentIndex()).toBe(0);
      spotify.emit(playing('b'));

      // #then — with no guard pending, index syncs to the reported track
      expect(queueStore.getCurrentIndex()).toBe(1);
    });

    it('with no transition pending, the index syncs to the reported track', () => {
      // #when
      spotify.emit(playing('c'));

      // #then
      expect(queueStore.getCurrentIndex()).toBe(2);
    });

    it('clearTransition drops the guard', () => {
      // #given
      playbackStore.beginTransition('c');
      playbackStore.clearTransition();

      // #when
      spotify.emit(playing('b'));

      // #then — no guard, index follows the event
      expect(queueStore.getCurrentIndex()).toBe(1);
    });

    it('applies provider metadata overlays to the queue track', () => {
      // #when
      spotify.emit(playing('b', 1000, {
        trackMetadata: { name: 'Real Name', artists: 'Real Artist' },
      }));

      // #then
      const track = queueStore.getTracks()[1];
      expect(track?.name).toBe('Real Name');
      expect(track?.artists).toBe('Real Artist');
    });
  });

  describe('seek guard', () => {
    beforeEach(() => {
      playbackStore.setDrivingProvider('spotify');
      queueStore.replaceQueue([makeTrack('a')], { currentIndex: 0 });
    });

    it('seek commits the target optimistically and calls the provider', async () => {
      // #when
      await playbackStore.seek(60_000);

      // #then
      expect(playbackStore.getSnapshot().positionMs).toBe(60_000);
      expect(spotify.playback.seek).toHaveBeenCalledWith(60_000);
    });

    it('rejects a stale pre-seek position emit but accepts a post-seek one', async () => {
      // #given — a seek to 60s is in flight
      spotify.emit(playing('a', 5000));
      await playbackStore.seek(60_000);

      // #when — the SDK still emits the stale pre-seek position
      spotify.emit(playing('a', 6000));

      // #then — the cursor is NOT yanked back
      expect(playbackStore.getSnapshot().positionMs).toBe(60_000);
      // ...but non-position state still flows
      expect(playbackStore.getSnapshot().isPlaying).toBe(true);

      // #when — a position near the seek target lands
      spotify.emit(playing('a', 60_400));

      // #then — accepted, guard consumed; later positions flow normally
      expect(playbackStore.getSnapshot().positionMs).toBe(60_400);
      spotify.emit(playing('a', 61_000));
      expect(playbackStore.getSnapshot().positionMs).toBe(61_000);
    });

    it('accepts positions again once the guard window lapses', async () => {
      // #given — a seek far from any emitted position
      const nowSpy = vi.spyOn(performance, 'now');
      nowSpy.mockReturnValue(1_000);
      await playbackStore.seek(120_000);

      // #when — the window lapses and a (stale-looking) position arrives
      nowSpy.mockReturnValue(1_000 + 6_000);
      spotify.emit(playing('a', 9_000));

      // #then — the safety valve accepts it so the cursor can never get stuck
      expect(playbackStore.getSnapshot().positionMs).toBe(9_000);
    });
  });

  describe('track-ended detection', () => {
    beforeEach(() => {
      playbackStore.setDrivingProvider('spotify');
      queueStore.replaceQueue([makeTrack('a'), makeTrack('b')], { currentIndex: 0 });
    });

    it('emits trackEnded once when a playing track reaches the near-end threshold', () => {
      // #given
      const onEnded = vi.fn();
      playbackStore.subscribeTrackEnded(onEnded);

      // #when — position crosses into the near-end threshold, twice
      spotify.emit(playing('a', 198_500));
      spotify.emit(playing('a', 199_200));

      // #then — one event per track
      expect(onEnded).toHaveBeenCalledTimes(1);
    });

    it('re-arms for the next track after a track change', () => {
      // #given
      const onEnded = vi.fn();
      playbackStore.subscribeTrackEnded(onEnded);
      spotify.emit(playing('a', 198_500));
      expect(onEnded).toHaveBeenCalledTimes(1);

      // #when — the next track starts, then also nears its end
      spotify.emit(playing('b', 1000));
      spotify.emit(playing('b', 199_000));

      // #then
      expect(onEnded).toHaveBeenCalledTimes(2);
    });

    it('treats was-playing → paused-at-zero as a natural end outside the cooldown', () => {
      // #given — track was playing mid-way; no play was recently initiated
      const onEnded = vi.fn();
      playbackStore.subscribeTrackEnded(onEnded);
      spotify.emit(playing('a', 100_000));

      // #when — provider reports paused at 0 with a real duration
      spotify.emit(playing('a', 0, { isPlaying: false }));

      // #then
      expect(onEnded).toHaveBeenCalledTimes(1);
    });

    it('suppresses paused-at-zero right after a play was initiated (buffering cooldown)', () => {
      // #given — a transition just began (play initiated now)
      const onEnded = vi.fn();
      playbackStore.subscribeTrackEnded(onEnded);
      spotify.emit(playing('a', 100_000));
      playbackStore.beginTransition('a');
      spotify.emit(playing('a', 100_000));

      // #when — buffering blip: paused at 0 within the cooldown
      spotify.emit(playing('a', 0, { isPlaying: false }));

      // #then — not a track end
      expect(onEnded).not.toHaveBeenCalled();
    });

    it('does not emit for an empty queue', () => {
      // #given
      queueStore.clear();
      const onEnded = vi.fn();
      playbackStore.subscribeTrackEnded(onEnded);

      // #when
      spotify.emit(playing('a', 199_500));

      // #then
      expect(onEnded).not.toHaveBeenCalled();
    });
  });

  describe('attach lifecycle races', () => {
    it('a getState that resolves after detach cannot write playback state', async () => {
      // #given — attach() primes from the driving provider's getState, which
      // is slow and only resolves after the attachment is torn down
      let resolveState!: (s: PlaybackState | null) => void;
      spotify.playback.getState.mockReturnValue(new Promise((res) => { resolveState = res; }));
      playbackStore.setDrivingProvider('spotify');

      const lateDetach = playbackStore.attach();

      // #when — detached (e.g. active provider switched), then the stale
      // getState resolves with playing state
      lateDetach();
      resolveState(playing('ghost', 42_000));
      await Promise.resolve();

      // #then — the stale resolution must not write into the store
      expect(playbackStore.getSnapshot().isPlaying).toBe(false);
      expect(playbackStore.getSnapshot().positionMs).toBe(0);
      expect(playbackStore.getSnapshot().currentTrackId).toBeNull();
    });

    it('re-attaching replaces the previous attachment (no double event delivery)', () => {
      // #given — snapshot commits are observable through subscribe
      playbackStore.setDrivingProvider('spotify');
      const commits = vi.fn();
      playbackStore.subscribe(commits);

      // #when — attach twice (the second supersedes the first), then emit once
      playbackStore.attach();
      playbackStore.attach();
      commits.mockClear();
      spotify.emit(playing('a', 1000));

      // #then — the event is committed exactly once
      expect(commits).toHaveBeenCalledTimes(1);
    });
  });
});
