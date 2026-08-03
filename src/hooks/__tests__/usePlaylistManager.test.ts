import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { CollectionRef } from '@/types/domain';

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    getCurrentState: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/services/spotify', () => ({
  getLargestImage: vi.fn().mockReturnValue(undefined),
  spotifyAuth: {
    redirectToAuth: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

const playCollection = vi.fn().mockResolvedValue(undefined);

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn(() => ({ playback: { playCollection } })),
  },
}));

vi.mock('@/constants/timing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/constants/timing')>()),
  SPOTIFY_RETRY_DELAY_MS: 0,
}));

import { useSpotifyPlaylistManager as usePlaylistManager } from '@/providers/spotify/useSpotifyPlaylistManager';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { spotifyAuth } from '@/services/spotify';
import { providerRegistry } from '@/providers/registry';
import { queueStore } from '@/stores/queueStore';

function playlistRef(id: string): CollectionRef {
  return { provider: 'spotify', kind: 'playlist', id };
}

function makeSdkState(): SpotifyPlaybackState {
  const makeSdkTrack = (id: string, name: string): SpotifyTrack => ({
    id,
    uri: `spotify:track:${id}`,
    name,
    artists: [{ name: 'SDK Artist', uri: 'spotify:artist:a1' }],
    album: { name: 'SDK Album', uri: 'spotify:album:al1', images: [] },
    duration_ms: 1000,
  } as unknown as SpotifyTrack);
  return {
    track_window: {
      previous_tracks: [makeSdkTrack('p1', 'Previous')],
      current_track: makeSdkTrack('c1', 'Current'),
      next_tracks: [makeSdkTrack('n1', 'Next')],
    },
  } as unknown as SpotifyPlaybackState;
}

describe('usePlaylistManager (context-playback fallback)', () => {
  const setError = vi.fn();
  const setIsLoading = vi.fn();
  const setSelection = vi.fn();

  const defaultProps = {
    trackOps: { setError, setIsLoading, setSelection },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    playCollection.mockResolvedValue(undefined);
    vi.mocked(providerRegistry.get).mockReturnValue(
      { playback: { playCollection } } as unknown as ReturnType<typeof providerRegistry.get>,
    );
    vi.mocked(spotifyPlayer.getCurrentState).mockResolvedValue(makeSdkState());
  });

  it('routes playlist refs through descriptor playback.playCollection', async () => {
    // #given
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when
    await act(async () => {
      await result.current.handlePlaylistSelect(playlistRef('playlist-123'));
    });

    // #then
    expect(playCollection).toHaveBeenCalledWith(playlistRef('playlist-123'));
  });

  it('routes album refs through descriptor playback.playCollection', async () => {
    // #given
    const albumRef: CollectionRef = { provider: 'spotify', kind: 'album', id: 'album-456' };
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when
    await act(async () => {
      await result.current.handlePlaylistSelect(albumRef);
    });

    // #then
    expect(playCollection).toHaveBeenCalledWith(albumRef);
  });

  it('mirrors the SDK track window into the queue', async () => {
    // #given
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when
    let returned: unknown;
    await act(async () => {
      returned = await result.current.handlePlaylistSelect(playlistRef('playlist-123'));
    });

    // #then — previous + current + next, deduped, in window order
    const tracks = queueStore.getTracks();
    expect(tracks.map((t) => t.id)).toEqual(['p1', 'c1', 'n1']);
    expect(queueStore.getSnapshot().originalTracks).toEqual(tracks);
    expect(queueStore.getCurrentIndex()).toBe(0);
    expect(returned).toEqual(tracks);
  });

  it('sets the typed selection for the ref before playback starts', async () => {
    // #given
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when
    await act(async () => {
      await result.current.handlePlaylistSelect(playlistRef('playlist-123'));
    });

    // #then
    expect(setSelection).toHaveBeenCalledWith({ type: 'collection', ref: playlistRef('playlist-123') });
  });

  it('errors on liked refs without touching playback', async () => {
    // #given
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when
    await act(async () => {
      await result.current.handlePlaylistSelect({ provider: 'spotify', kind: 'liked' });
    });

    // #then
    expect(setError).toHaveBeenCalledWith(expect.stringContaining('No liked songs'));
    expect(playCollection).not.toHaveBeenCalled();
  });

  it('sets error when the SDK window is empty after context playback', async () => {
    // #given
    vi.mocked(spotifyPlayer.getCurrentState).mockResolvedValue(null);
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when
    await act(async () => {
      await result.current.handlePlaylistSelect(playlistRef('playlist-empty'));
    });

    // #then
    expect(setError).toHaveBeenCalledWith(expect.stringContaining('No tracks found in this playlist'));
    expect(queueStore.getTracks()).toEqual([]);
  });

  it('calls redirectToAuth on auth error', async () => {
    // #given
    const { AuthExpiredError } = await import('@/providers/errors');
    playCollection.mockRejectedValueOnce(new AuthExpiredError('spotify'));
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when
    await act(async () => {
      await result.current.handlePlaylistSelect(playlistRef('playlist-auth-fail'));
    });

    // #then
    expect(spotifyAuth.redirectToAuth).toHaveBeenCalled();
  });

  it('sets isLoading false in finally block on error', async () => {
    // #given
    playCollection.mockRejectedValueOnce(new Error('Some error'));
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when
    await act(async () => {
      await result.current.handlePlaylistSelect(playlistRef('playlist-error'));
    });

    // #then
    expect(setIsLoading).toHaveBeenLastCalledWith(false);
  });
});
