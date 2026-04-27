import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MediaTrack, ProviderId } from '@/types/domain';

const { mockListTracks, mockIsTrackSaved } = vi.hoisted(() => ({
  mockListTracks: vi.fn(),
  mockIsTrackSaved: vi.fn(),
}));

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn().mockReturnValue({
      catalog: {
        listTracks: (...args: unknown[]) => mockListTracks(...args),
        isTrackSaved: (...args: unknown[]) => mockIsTrackSaved(...args),
      },
    }),
  },
}));

import { useQueueLikedFromCollection } from '../useQueueLikedFromCollection';

const TRACK_A: MediaTrack = { id: 'a' } as MediaTrack;
const TRACK_B: MediaTrack = { id: 'b' } as MediaTrack;

describe('useQueueLikedFromCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes kind:album and raw id directly to listTracks (engine-path fix)', async () => {
    // #given — raw album id as the engine provides (no "album:" prefix)
    mockListTracks.mockResolvedValue([TRACK_A]);
    mockIsTrackSaved.mockResolvedValue(true);
    const onQueue = vi.fn();
    const { result } = renderHook(() => useQueueLikedFromCollection(onQueue));

    // #when
    await act(async () => {
      await result.current.queueLikedFromCollection(
        '1KNUCVXgIxKUGiuEB8eG0i',
        'Jazz Album',
        'spotify' as ProviderId,
        'album',
      );
    });

    // #then — listTracks called with album kind, raw id (not 'playlist' kind)
    expect(mockListTracks).toHaveBeenCalledWith({
      provider: 'spotify',
      kind: 'album',
      id: '1KNUCVXgIxKUGiuEB8eG0i',
    });
    expect(onQueue).toHaveBeenCalledWith([TRACK_A], 'Jazz Album');
  });

  it('passes kind:playlist and id directly to listTracks', async () => {
    // #given
    mockListTracks.mockResolvedValue([TRACK_A]);
    mockIsTrackSaved.mockResolvedValue(true);
    const onQueue = vi.fn();
    const { result } = renderHook(() => useQueueLikedFromCollection(onQueue));

    // #when
    await act(async () => {
      await result.current.queueLikedFromCollection(
        'pl-xyz',
        'My Playlist',
        'spotify' as ProviderId,
        'playlist',
      );
    });

    // #then
    expect(mockListTracks).toHaveBeenCalledWith({
      provider: 'spotify',
      kind: 'playlist',
      id: 'pl-xyz',
    });
    expect(onQueue).toHaveBeenCalledWith([TRACK_A], 'My Playlist');
  });

  it('filters to only saved tracks before queuing', async () => {
    // #given
    mockListTracks.mockResolvedValue([TRACK_A, TRACK_B]);
    mockIsTrackSaved.mockImplementation((id: string) =>
      Promise.resolve(id === 'a'),
    );
    const onQueue = vi.fn();
    const { result } = renderHook(() => useQueueLikedFromCollection(onQueue));

    // #when
    await act(async () => {
      await result.current.queueLikedFromCollection('pl-xyz', 'Pl', 'spotify' as ProviderId, 'playlist');
    });

    // #then — only TRACK_A (saved) passes through
    expect(onQueue).toHaveBeenCalledWith([TRACK_A], 'Pl');
  });

  it('does not call onQueue when no liked tracks exist in the collection', async () => {
    // #given
    mockListTracks.mockResolvedValue([TRACK_A]);
    mockIsTrackSaved.mockResolvedValue(false);
    const onQueue = vi.fn();
    const { result } = renderHook(() => useQueueLikedFromCollection(onQueue));

    // #when
    await act(async () => {
      await result.current.queueLikedFromCollection('pl-xyz', 'Pl', 'spotify' as ProviderId, 'playlist');
    });

    // #then
    expect(onQueue).not.toHaveBeenCalled();
  });

  it('propagates listTracks rejection so callers can catch it', async () => {
    // #given
    const error = new Error('API error');
    mockListTracks.mockRejectedValue(error);
    const { result } = renderHook(() => useQueueLikedFromCollection(vi.fn()));

    // #when / #then
    await expect(
      act(async () => {
        await result.current.queueLikedFromCollection(
          'album-id',
          'Album',
          'spotify' as ProviderId,
          'album',
        );
      }),
    ).rejects.toThrow('API error');
  });

  it('resolves immediately when onQueueLikedTracks is not provided', async () => {
    // #given
    const { result } = renderHook(() => useQueueLikedFromCollection(undefined));

    // #when / #then — should not throw
    await act(async () => {
      await result.current.queueLikedFromCollection('id', 'Name', 'spotify' as ProviderId, 'playlist');
    });
    expect(mockListTracks).not.toHaveBeenCalled();
  });
});
