import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRadio } from '../useRadio';
import { makeMediaTrack } from '@/test/fixtures';
import { createDeferredFn } from '@/test/asyncRace';
import type { MediaTrack } from '@/types/domain';
import type { RadioResult, RadioSeed } from '@/types/radio';

vi.mock('@/services/radioService', () => ({
  generateRadioQueue: vi.fn(),
}));
vi.mock('@/services/lastfm', () => ({
  isLastFmConfigured: vi.fn(() => true),
}));
vi.mock('@/lib/debugLog', () => ({
  logRadio: vi.fn(),
}));

import { generateRadioQueue } from '@/services/radioService';

const seed: RadioSeed = { type: 'track', artist: 'Radiohead', track: 'Creep' };

function track(id: string, name: string): MediaTrack {
  return makeMediaTrack({ id, name, provider: 'spotify' });
}

function result(queue: MediaTrack[], seedDescription: string): RadioResult {
  return {
    queue,
    seedDescription,
    matchStats: { requested: queue.length, matched: queue.length, unmatched: 0 },
    unmatchedSuggestions: [],
  };
}

describe('useRadio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('activates radio state with the seed description on success', async () => {
    // #given
    vi.mocked(generateRadioQueue).mockResolvedValue(
      result([track('g1', 'Karma Police')], 'Songs like Creep'),
    );
    const { result: hook } = renderHook(() => useRadio());

    // #when
    await act(async () => {
      await hook.current.startRadio(seed, [track('c1', 'Catalog')]);
    });

    // #then
    expect(hook.current.radioState.isActive).toBe(true);
    expect(hook.current.radioState.seedDescription).toBe('Songs like Creep');
    expect(hook.current.radioState.isGenerating).toBe(false);
  });

  it('reports an error when no similar tracks are found', async () => {
    // #given
    vi.mocked(generateRadioQueue).mockResolvedValue(result([], 'Songs like Creep'));
    const { result: hook } = renderHook(() => useRadio());

    // #when
    await act(async () => {
      await hook.current.startRadio(seed, []);
    });

    // #then
    expect(hook.current.radioState.isActive).toBe(false);
    expect(hook.current.radioState.error).toBe('No similar tracks found in your library.');
  });

  it('keeps the newer generation state when an older startRadio resolves later', async () => {
    // #given a controllable generateRadioQueue settled out of order
    const gen = createDeferredFn<[RadioSeed, MediaTrack[]], RadioResult>();
    vi.mocked(generateRadioQueue).mockImplementation(gen.fn);
    const { result: hook } = renderHook(() => useRadio());

    // #when two generations overlap — sequence them so index 0 = older, 1 = newer
    let older!: Promise<RadioResult | null>;
    let newer!: Promise<RadioResult | null>;
    await act(async () => {
      older = hook.current.startRadio(seed, []);
      await waitFor(() => expect(gen.callCount).toBe(1));
      newer = hook.current.startRadio(seed, []);
      await waitFor(() => expect(gen.callCount).toBe(2));
    });

    // ...the newer (index 1) resolves first, then the stale older (index 0)
    await act(async () => {
      gen.resolve(1, result([track('new', 'Fresh')], 'Newer seed'));
      gen.resolve(0, result([track('old', 'Stale')], 'Older seed'));
      await Promise.all([older, newer]);
    });

    // #then the guard keeps the newer generation's state; the stale resolution
    // returns null and does not overwrite it.
    expect(hook.current.radioState.seedDescription).toBe('Newer seed');
    await expect(older).resolves.toBeNull();
  });

  it('stopRadio invalidates an in-flight generation so its result is dropped', async () => {
    // #given a generation in flight
    const gen = createDeferredFn<[RadioSeed, MediaTrack[]], RadioResult>();
    vi.mocked(generateRadioQueue).mockImplementation(gen.fn);
    const { result: hook } = renderHook(() => useRadio());

    let pending!: Promise<RadioResult | null>;
    await act(async () => {
      pending = hook.current.startRadio(seed, []);
      await waitFor(() => expect(gen.callCount).toBe(1));
    });

    // #when the user stops radio before it finishes, then it finishes
    await act(async () => {
      hook.current.stopRadio();
      gen.resolve(0, result([track('late', 'Late')], 'Late seed'));
      await pending;
    });

    // #then the stale result is dropped and state stays inactive
    expect(hook.current.radioState.isActive).toBe(false);
    expect(hook.current.radioState.seedDescription).toBeUndefined();
    await expect(pending).resolves.toBeNull();
  });
});
