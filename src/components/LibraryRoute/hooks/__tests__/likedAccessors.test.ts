import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MediaTrack } from '@/types/domain';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

import { fetchLikedForProvider } from '../likedAccessors';

describe('fetchLikedForProvider', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('returns [] when no descriptor is registered for the provider', async () => {
    // #given
    mockGet.mockReturnValue(undefined);

    // #when
    const tracks = await fetchLikedForProvider('spotify');

    // #then
    expect(tracks).toEqual([]);
  });

  it('returns [] when descriptor lacks a catalog', async () => {
    // #given
    mockGet.mockReturnValue({});

    // #when
    const tracks = await fetchLikedForProvider('spotify');

    // #then
    expect(tracks).toEqual([]);
  });

  it('delegates to catalog.listTracks with a liked CollectionRef', async () => {
    // #given
    const fakeTracks: MediaTrack[] = [{ id: 't1' } as MediaTrack];
    const listTracks = vi.fn().mockResolvedValue(fakeTracks);
    mockGet.mockReturnValue({ catalog: { listTracks } });

    // #when
    const tracks = await fetchLikedForProvider('spotify');

    // #then
    expect(listTracks).toHaveBeenCalledWith(
      { provider: 'spotify', kind: 'liked' },
      undefined,
    );
    expect(tracks).toBe(fakeTracks);
  });

  it('propagates the AbortSignal to listTracks', async () => {
    // #given
    const listTracks = vi.fn().mockResolvedValue([]);
    mockGet.mockReturnValue({ catalog: { listTracks } });
    const ac = new AbortController();

    // #when
    await fetchLikedForProvider('dropbox', ac.signal);

    // #then
    expect(listTracks).toHaveBeenCalledWith(
      { provider: 'dropbox', kind: 'liked' },
      ac.signal,
    );
  });
});
