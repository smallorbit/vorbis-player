import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    setVolume: vi.fn().mockResolvedValue(undefined),
    onPlayerStateChanged: vi.fn(() => vi.fn()),
    getCurrentState: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    getDeviceId: vi.fn().mockReturnValue(null),
    getIsReady: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@/services/spotify', () => ({
  checkTrackSaved: vi.fn(),
  saveTrack: vi.fn(),
  unsaveTrack: vi.fn(),
  spotifyAuth: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    getAccessToken: vi.fn().mockReturnValue('test-token'),
    ensureValidToken: vi.fn().mockResolvedValue('test-token'),
    handleRedirect: vi.fn().mockResolvedValue(undefined),
    redirectToAuth: vi.fn(),
    logout: vi.fn(),
  },
  getUserLibraryInterleaved: vi.fn(),
  getPlaylistTracks: vi.fn(),
  getAlbumTracks: vi.fn(),
  getLikedSongs: vi.fn(),
  getLikedSongsCount: vi.fn(),
}));

import { useLikeTrack } from '../useLikeTrack';
import { checkTrackSaved, saveTrack, unsaveTrack } from '@/services/spotify';
import { ProviderWrapper } from '@/test/providerTestUtils';

const opts = { wrapper: ProviderWrapper };

describe('useLikeTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkTrackSaved).mockResolvedValue(false);
    vi.mocked(saveTrack).mockResolvedValue(undefined);
    vi.mocked(unsaveTrack).mockResolvedValue(undefined);
  });

  it('isLiked is false when trackId is undefined', () => {
    const { result } = renderHook(() => useLikeTrack(undefined), opts);

    expect(result.current.isLiked).toBe(false);
    expect(checkTrackSaved).not.toHaveBeenCalled();
  });

  it('calls checkTrackSaved when trackId changes', async () => {
    vi.mocked(checkTrackSaved).mockResolvedValue(true);

    const { result } = renderHook(() => useLikeTrack('track-1'), opts);

    await waitFor(() => {
      expect(result.current.isLiked).toBe(true);
    });
    expect(checkTrackSaved).toHaveBeenCalledWith('track-1');
  });

  it('re-checks when trackId changes', async () => {
    vi.mocked(checkTrackSaved).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const { result, rerender } = renderHook(
      ({ id }) => useLikeTrack(id),
      { ...opts, initialProps: { id: 'track-1' } }
    );

    await waitFor(() => {
      expect(result.current.isLiked).toBe(true);
    });

    rerender({ id: 'track-2' });

    await waitFor(() => {
      expect(result.current.isLiked).toBe(false);
    });
    expect(checkTrackSaved).toHaveBeenCalledWith('track-2');
  });

  it('optimistic update before API resolves', async () => {
    vi.mocked(checkTrackSaved).mockResolvedValue(false);
    let resolveSave: () => void;
    vi.mocked(saveTrack).mockImplementation(
      () => new Promise<void>(resolve => { resolveSave = resolve; })
    );

    const { result } = renderHook(() => useLikeTrack('track-1'), opts);

    await waitFor(() => {
      expect(result.current.isLikePending).toBe(false);
    });

    // #when - toggle like
    act(() => {
      result.current.handleLikeToggle();
    });

    // #then - optimistically updated before API resolves
    expect(result.current.isLiked).toBe(true);
    expect(result.current.isLikePending).toBe(true);

    // Resolve the save
    await act(async () => {
      resolveSave!();
    });

    expect(result.current.isLikePending).toBe(false);
  });

  it('reverts optimistic update on API error', async () => {
    vi.mocked(checkTrackSaved).mockResolvedValue(false);
    vi.mocked(saveTrack).mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useLikeTrack('track-1'), opts);

    await waitFor(() => {
      expect(result.current.isLikePending).toBe(false);
    });

    // #when - toggle like (will fail)
    await act(async () => {
      result.current.handleLikeToggle();
    });

    // #then - reverted back to false
    expect(result.current.isLiked).toBe(false);
    expect(result.current.isLikePending).toBe(false);
  });

  it('no-op when isLikePending is true (prevents double-click)', async () => {
    vi.mocked(checkTrackSaved).mockResolvedValue(false);
    let resolveSave: () => void;
    vi.mocked(saveTrack).mockImplementation(
      () => new Promise<void>(resolve => { resolveSave = resolve; })
    );

    const { result } = renderHook(() => useLikeTrack('track-1'), opts);

    await waitFor(() => {
      expect(result.current.isLikePending).toBe(false);
    });

    // First toggle
    act(() => {
      result.current.handleLikeToggle();
    });

    expect(result.current.isLikePending).toBe(true);

    // Second toggle while pending - should be no-op
    act(() => {
      result.current.handleLikeToggle();
    });

    expect(saveTrack).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave!();
    });
  });

  it('calls unsaveTrack when unliking', async () => {
    vi.mocked(checkTrackSaved).mockResolvedValue(true);

    const { result } = renderHook(() => useLikeTrack('track-1'), opts);

    await waitFor(() => {
      expect(result.current.isLiked).toBe(true);
    });

    await act(async () => {
      result.current.handleLikeToggle();
    });

    expect(unsaveTrack).toHaveBeenCalledWith('track-1');
  });

  it('sets isLiked to false on checkTrackSaved error', async () => {
    vi.mocked(checkTrackSaved).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLikeTrack('track-1'), opts);

    await waitFor(() => {
      expect(result.current.isLikePending).toBe(false);
    });

    expect(result.current.isLiked).toBe(false);
  });
});
