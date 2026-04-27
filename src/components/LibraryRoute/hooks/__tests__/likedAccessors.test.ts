import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLikedForProvider } from '../likedAccessors';
import type { ProviderId, MediaTrack } from '@/types/domain';

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn(),
    getAll: vi.fn(() => []),
    register: vi.fn(),
  },
}));

import { providerRegistry } from '@/providers/registry';

const mockRegistry = vi.mocked(providerRegistry);

const makeTrack = (id: string): MediaTrack => ({
  id,
  provider: 'spotify',
  playbackRef: { provider: 'spotify', ref: `spotify:track:${id}` },
  name: `Track ${id}`,
  artists: 'Test Artist',
  album: 'Test Album',
  durationMs: 180000,
});

describe('fetchLikedForProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when provider not in registry', () => {
    it('returns empty array when providerRegistry has no entry for provider', async () => {
      // #given
      mockRegistry.get.mockReturnValue(undefined);

      // #when
      const result = await fetchLikedForProvider('spotify');

      // #then
      expect(result).toEqual([]);
    });

    it('returns empty array when catalog is absent from descriptor', async () => {
      // #given
      mockRegistry.get.mockReturnValue({ id: 'spotify', catalog: undefined } as unknown as ReturnType<typeof providerRegistry.get>);

      // #when
      const result = await fetchLikedForProvider('spotify');

      // #then
      expect(result).toEqual([]);
    });
  });

  describe('when provider exists in registry', () => {
    it('delegates to catalog.listTracks', async () => {
      // #given
      const tracks = [makeTrack('t1'), makeTrack('t2')];
      const listTracks = vi.fn().mockResolvedValue(tracks);
      mockRegistry.get.mockReturnValue({
        id: 'spotify',
        catalog: { listTracks, providerId: 'spotify', listCollections: vi.fn() },
      } as unknown as ReturnType<typeof providerRegistry.get>);

      // #when
      const result = await fetchLikedForProvider('spotify');

      // #then
      expect(listTracks).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'liked', provider: 'spotify' }),
        undefined
      );
      expect(result).toEqual(tracks);
    });

    it('passes provider to listTracks', async () => {
      // #given
      const listTracks = vi.fn().mockResolvedValue([]);
      mockRegistry.get.mockReturnValue({
        id: 'dropbox',
        catalog: { listTracks, providerId: 'dropbox', listCollections: vi.fn() },
      } as unknown as ReturnType<typeof providerRegistry.get>);

      // #when
      await fetchLikedForProvider('dropbox' as ProviderId);

      // #then
      expect(listTracks).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'dropbox' }),
        undefined
      );
    });

    it('passes AbortSignal to listTracks', async () => {
      // #given
      const signal = new AbortController().signal;
      const listTracks = vi.fn().mockResolvedValue([]);
      mockRegistry.get.mockReturnValue({
        id: 'spotify',
        catalog: { listTracks, providerId: 'spotify', listCollections: vi.fn() },
      } as unknown as ReturnType<typeof providerRegistry.get>);

      // #when
      await fetchLikedForProvider('spotify', signal);

      // #then
      expect(listTracks).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'liked' }),
        signal
      );
    });

    it('propagates rejection from listTracks', async () => {
      // #given
      const listTracks = vi.fn().mockRejectedValue(new Error('network error'));
      mockRegistry.get.mockReturnValue({
        id: 'spotify',
        catalog: { listTracks, providerId: 'spotify', listCollections: vi.fn() },
      } as unknown as ReturnType<typeof providerRegistry.get>);

      // #when / #then
      await expect(fetchLikedForProvider('spotify')).rejects.toThrow('network error');
    });
  });

  describe('AbortSignal handling', () => {
    it('handles already-aborted signal gracefully (does not hang)', async () => {
      // #given — signal is already aborted
      const controller = new AbortController();
      controller.abort();
      const signal = controller.signal;
      const listTracks = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
      mockRegistry.get.mockReturnValue({
        id: 'spotify',
        catalog: { listTracks, providerId: 'spotify', listCollections: vi.fn() },
      } as unknown as ReturnType<typeof providerRegistry.get>);

      // #when / #then — either rejects with AbortError or returns [] per adapter contract
      const resultPromise = fetchLikedForProvider('spotify', signal);
      await expect(resultPromise).rejects.toThrow();
    });
  });
});
