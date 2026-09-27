import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MediaTrack, ProviderId } from '@/types/domain';

const { spotifyPause, dropboxPause, registryGet } = vi.hoisted(() => {
  const spotifyPause = vi.fn().mockResolvedValue(undefined);
  const dropboxPause = vi.fn().mockResolvedValue(undefined);
  const spotifyPlayTrack = vi.fn().mockResolvedValue(undefined);
  const dropboxPlayTrack = vi.fn().mockResolvedValue(undefined);

  const makePlayback = (
    providerId: ProviderId,
    playTrack: ReturnType<typeof vi.fn>,
    pause: ReturnType<typeof vi.fn>,
  ) => ({
    providerId,
    playTrack,
    pause,
    resume: vi.fn().mockResolvedValue(undefined),
    prepareTrack: vi.fn(),
    seek: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    setVolume: vi.fn(),
    getState: vi.fn(),
    subscribe: vi.fn(),
    onQueueChanged: vi.fn(),
  });

  const registryGet = vi.fn((id: ProviderId) => {
    if (id === 'spotify') {
      return {
        id: 'spotify' as const,
        capabilities: { hasNativeQueueSync: true, hasExternalLink: true },
        playback: makePlayback('spotify', spotifyPlayTrack, spotifyPause),
      };
    }
    if (id === 'dropbox') {
      return {
        id: 'dropbox' as const,
        capabilities: { hasNativeQueueSync: false, hasExternalLink: false },
        playback: makePlayback('dropbox', dropboxPlayTrack, dropboxPause),
      };
    }
    return undefined;
  });

  return { spotifyPause, dropboxPause, registryGet };
});

vi.mock('@/providers/registry', () => ({ providerRegistry: { get: registryGet } }));
vi.mock('@/services/providerRegistry', () => ({ providerRegistry: { get: registryGet } }));
vi.mock('@/services/sessionPersistence', () => ({ loadSession: () => null }));

import { useProviderPlayback } from '../useProviderPlayback';
import { queueStore } from '@/stores/queueStore';
import { playbackStore } from '@/stores/playbackStore';
import { makeMediaTrack as makeFixtureTrack } from '@/test/fixtures';

function track(id: string, provider: ProviderId): MediaTrack {
  return makeFixtureTrack({
    id,
    name: id,
    provider,
    playbackRef: { provider, ref: `${provider}:${id}` },
  });
}

describe('useProviderPlayback — provider transition matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueStore.__resetForTests();
    playbackStore.__resetForTests();
  });

  it.each([
    {
      label: 'cold start → spotify',
      queue: [track('s1', 'spotify')],
      plays: [0],
      expectPause: { spotify: 0, dropbox: 0 },
      expectDriving: 'spotify' as ProviderId,
    },
    {
      label: 'spotify → spotify (same provider)',
      queue: [track('s1', 'spotify'), track('s2', 'spotify')],
      plays: [0, 1],
      expectPause: { spotify: 0, dropbox: 0 },
      expectDriving: 'spotify' as ProviderId,
    },
    {
      label: 'spotify → dropbox (handoff out)',
      queue: [track('s1', 'spotify'), track('d1', 'dropbox')],
      plays: [0, 1],
      expectPause: { spotify: 1, dropbox: 0 },
      expectDriving: 'dropbox' as ProviderId,
    },
    {
      label: 'dropbox → spotify (handoff back)',
      queue: [track('d1', 'dropbox'), track('s1', 'spotify')],
      plays: [0, 1],
      expectPause: { spotify: 0, dropbox: 1 },
      expectDriving: 'spotify' as ProviderId,
    },
    {
      label: 'dropbox → dropbox (same provider)',
      queue: [track('d1', 'dropbox'), track('d2', 'dropbox')],
      plays: [0, 1],
      expectPause: { spotify: 0, dropbox: 0 },
      expectDriving: 'dropbox' as ProviderId,
    },
  ])('$label', async ({ queue, plays, expectPause, expectDriving }) => {
    // #given
    queueStore.replaceQueue(queue);
    const { result } = renderHook(() => useProviderPlayback({}));

    // #when — play through the transition sequence
    for (const index of plays) {
      await act(async () => {
        await result.current.playTrack(index);
      });
    }

    // #then — outgoing provider paused only on cross-provider boundaries
    expect(spotifyPause).toHaveBeenCalledTimes(expectPause.spotify);
    expect(dropboxPause).toHaveBeenCalledTimes(expectPause.dropbox);
    expect(playbackStore.getSnapshot().drivingProviderId).toBe(expectDriving);
  });
});
