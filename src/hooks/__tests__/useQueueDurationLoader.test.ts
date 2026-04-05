import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQueueDurationLoader } from '../useQueueDurationLoader';
import { makeMediaTrack } from '@/test/fixtures';
import type { MediaTrack } from '@/types/domain';

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn(),
  },
}));

vi.mock('@/lib/debugLog', () => ({
  logQueue: vi.fn(),
}));

import { providerRegistry } from '@/providers/registry';

describe('useQueueDurationLoader', () => {
  let setTracks: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setTracks = vi.fn();
    vi.mocked(providerRegistry.get).mockReset();
  });

  it('resolves missing durations via provider catalog', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', durationMs: undefined });
    const tracks: MediaTrack[] = [track];

    const mockResolveDuration = vi.fn().mockResolvedValue(180000);
    vi.mocked(providerRegistry.get).mockReturnValue({
      catalog: { resolveDuration: mockResolveDuration },
    } as never);

    // #when
    renderHook(() => useQueueDurationLoader(tracks, setTracks));

    // #then
    await waitFor(() => {
      expect(mockResolveDuration).toHaveBeenCalledWith(track);
    });
    await waitFor(() => {
      expect(setTracks).toHaveBeenCalled();
    });

    const updaterFn = setTracks.mock.calls[0][0];
    const updatedTracks = updaterFn([track]);
    expect(updatedTracks[0].durationMs).toBe(180000);
  });

  it('skips tracks that already have durations', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', durationMs: 210000 });

    const mockResolveDuration = vi.fn().mockResolvedValue(999999);
    vi.mocked(providerRegistry.get).mockReturnValue({
      catalog: { resolveDuration: mockResolveDuration },
    } as never);

    // #when
    renderHook(() => useQueueDurationLoader([track], setTracks));

    // allow microtasks to flush
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // #then
    expect(mockResolveDuration).not.toHaveBeenCalled();
    expect(setTracks).not.toHaveBeenCalled();
  });

  it('does not re-attempt previously failed tracks', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', durationMs: undefined });
    const mockResolveDuration = vi.fn().mockRejectedValue(new Error('network error'));
    vi.mocked(providerRegistry.get).mockReturnValue({
      catalog: { resolveDuration: mockResolveDuration },
    } as never);

    const { rerender } = renderHook(
      ({ t }: { t: MediaTrack[] }) => useQueueDurationLoader(t, setTracks),
      { initialProps: { t: [track] } },
    );

    await waitFor(() => {
      expect(mockResolveDuration).toHaveBeenCalledTimes(1);
    });

    mockResolveDuration.mockClear();

    // #when — rerender with same tracks (still missing duration)
    rerender({ t: [{ ...track }] });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // #then — should not retry after failure
    expect(mockResolveDuration).not.toHaveBeenCalled();
  });

  it('handles provider returning undefined gracefully', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', durationMs: undefined });
    const mockResolveDuration = vi.fn().mockResolvedValue(undefined);
    vi.mocked(providerRegistry.get).mockReturnValue({
      catalog: { resolveDuration: mockResolveDuration },
    } as never);

    // #when
    renderHook(() => useQueueDurationLoader([track], setTracks));

    await waitFor(() => {
      expect(mockResolveDuration).toHaveBeenCalledWith(track);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // #then — setTracks should not be called when no updates
    expect(setTracks).not.toHaveBeenCalled();
  });

  it('handles provider returning null (no resolveDuration method) gracefully', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', durationMs: undefined });
    vi.mocked(providerRegistry.get).mockReturnValue(undefined);

    // #when
    renderHook(() => useQueueDurationLoader([track], setTracks));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // #then — should not throw, setTracks not called
    expect(setTracks).not.toHaveBeenCalled();
  });

  it('clears attempted set when tracks become empty', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', durationMs: undefined });
    const mockResolveDuration = vi.fn().mockRejectedValue(new Error('fail'));
    vi.mocked(providerRegistry.get).mockReturnValue({
      catalog: { resolveDuration: mockResolveDuration },
    } as never);

    const { rerender } = renderHook(
      ({ t }: { t: MediaTrack[] }) => useQueueDurationLoader(t, setTracks),
      { initialProps: { t: [track] } },
    );

    await waitFor(() => {
      expect(mockResolveDuration).toHaveBeenCalledTimes(1);
    });

    mockResolveDuration.mockClear();
    mockResolveDuration.mockResolvedValue(120000);

    // #when — clear queue then re-add same track
    rerender({ t: [] });
    rerender({ t: [track] });

    // #then — after clear, should attempt resolution again
    await waitFor(() => {
      expect(mockResolveDuration).toHaveBeenCalledWith(track);
    });
  });
});
