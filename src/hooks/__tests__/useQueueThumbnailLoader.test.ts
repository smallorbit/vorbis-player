import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQueueThumbnailLoader } from '../useQueueThumbnailLoader';
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

describe('useQueueThumbnailLoader', () => {
  let setTracks: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setTracks = vi.fn();
    vi.mocked(providerRegistry.get).mockReset();
  });

  it('resolves missing artwork via provider catalog', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', image: undefined, albumId: 'album-1' });
    const tracks: MediaTrack[] = [track];

    const mockResolveArtwork = vi.fn().mockResolvedValue('https://example.com/art.jpg');
    vi.mocked(providerRegistry.get).mockReturnValue({
      catalog: { resolveArtwork: mockResolveArtwork },
    } as never);

    // #when
    renderHook(() => useQueueThumbnailLoader(tracks, setTracks));

    // #then
    await waitFor(() => {
      expect(mockResolveArtwork).toHaveBeenCalledWith('album-1', expect.any(AbortSignal));
    });
    await waitFor(() => {
      expect(setTracks).toHaveBeenCalled();
    });

    const updaterFn = setTracks.mock.calls[0][0];
    const updatedTracks = updaterFn([track]);
    expect(updatedTracks[0].image).toBe('https://example.com/art.jpg');
  });

  it('skips tracks that already have images', async () => {
    // #given
    const track = makeMediaTrack({
      id: 'track-1',
      image: 'https://existing.com/art.jpg',
      albumId: 'album-1',
    });

    const mockResolveArtwork = vi.fn();
    vi.mocked(providerRegistry.get).mockReturnValue({
      catalog: { resolveArtwork: mockResolveArtwork },
    } as never);

    // #when
    renderHook(() => useQueueThumbnailLoader([track], setTracks));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // #then
    expect(mockResolveArtwork).not.toHaveBeenCalled();
    expect(setTracks).not.toHaveBeenCalled();
  });

  it('de-duplicates by albumId — only resolves each album once', async () => {
    // #given
    const track1 = makeMediaTrack({ id: 'track-1', image: undefined, albumId: 'album-42' });
    const track2 = makeMediaTrack({ id: 'track-2', image: undefined, albumId: 'album-42' });
    const tracks: MediaTrack[] = [track1, track2];

    const mockResolveArtwork = vi.fn().mockResolvedValue('https://example.com/art.jpg');
    vi.mocked(providerRegistry.get).mockReturnValue({
      catalog: { resolveArtwork: mockResolveArtwork },
    } as never);

    // #when
    renderHook(() => useQueueThumbnailLoader(tracks, setTracks));

    // #then — only one call per unique albumId
    await waitFor(() => {
      expect(mockResolveArtwork).toHaveBeenCalledTimes(1);
      expect(mockResolveArtwork).toHaveBeenCalledWith('album-42', expect.any(AbortSignal));
    });
  });

  it('handles provider returning undefined gracefully', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', image: undefined, albumId: 'album-1' });
    const mockResolveArtwork = vi.fn().mockResolvedValue(undefined);
    vi.mocked(providerRegistry.get).mockReturnValue({
      catalog: { resolveArtwork: mockResolveArtwork },
    } as never);

    // #when
    renderHook(() => useQueueThumbnailLoader([track], setTracks));

    await waitFor(() => {
      expect(mockResolveArtwork).toHaveBeenCalledWith('album-1', expect.any(AbortSignal));
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // #then — no update call when artwork not found
    expect(setTracks).not.toHaveBeenCalled();
  });

  it('handles provider not registered gracefully', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', image: undefined, albumId: 'album-1' });
    vi.mocked(providerRegistry.get).mockReturnValue(undefined);

    // #when
    renderHook(() => useQueueThumbnailLoader([track], setTracks));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // #then — should not throw, setTracks not called
    expect(setTracks).not.toHaveBeenCalled();
  });

  it('clears attempted set when tracks become empty', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', image: undefined, albumId: 'album-99' });
    const mockResolveArtwork = vi.fn().mockResolvedValue(undefined);
    vi.mocked(providerRegistry.get).mockReturnValue({
      catalog: { resolveArtwork: mockResolveArtwork },
    } as never);

    const { rerender } = renderHook(
      ({ t }: { t: MediaTrack[] }) => useQueueThumbnailLoader(t, setTracks),
      { initialProps: { t: [track] } },
    );

    await waitFor(() => {
      expect(mockResolveArtwork).toHaveBeenCalledTimes(1);
    });

    mockResolveArtwork.mockClear();
    mockResolveArtwork.mockResolvedValue('https://example.com/new-art.jpg');

    // #when — clear queue then re-add the same album
    rerender({ t: [] });
    rerender({ t: [track] });

    // #then — should attempt resolution again after the set was cleared
    await waitFor(() => {
      expect(mockResolveArtwork).toHaveBeenCalledWith('album-99', expect.any(AbortSignal));
    });
  });

  it('skips tracks with no albumId even if image is missing', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', image: undefined, albumId: undefined });
    const mockResolveArtwork = vi.fn();
    vi.mocked(providerRegistry.get).mockReturnValue({
      catalog: { resolveArtwork: mockResolveArtwork },
    } as never);

    // #when
    renderHook(() => useQueueThumbnailLoader([track], setTracks));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // #then — no albumId means nothing to resolve
    expect(mockResolveArtwork).not.toHaveBeenCalled();
    expect(setTracks).not.toHaveBeenCalled();
  });
});
