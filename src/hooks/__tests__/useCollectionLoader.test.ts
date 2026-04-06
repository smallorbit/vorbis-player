import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollectionLoader } from '../useCollectionLoader';
import { makeTrack } from '@/test/fixtures';
import { LIKED_SONGS_ID } from '@/constants/playlist';
import type { MediaTrack } from '@/types/domain';

function makeMediaTrack(id: string, addedAt?: number): MediaTrack {
  return {
    id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: `spotify:track:${id}` },
    name: `Track ${id}`,
    artists: 'Artist',
    album: 'Album',
    durationMs: 180000,
    addedAt,
  };
}

describe('useCollectionLoader', () => {
  let mockPlayTrack: ReturnType<typeof vi.fn>;
  let mockSetError: ReturnType<typeof vi.fn>;
  let mockSetIsLoading: ReturnType<typeof vi.fn>;
  let mockSetTracks: ReturnType<typeof vi.fn>;
  let mockSetOriginalTracks: ReturnType<typeof vi.fn>;
  let mockSetCurrentTrackIndex: ReturnType<typeof vi.fn>;
  let mockSetSelectedPlaylistId: ReturnType<typeof vi.fn>;
  let mockSetActiveProviderId: ReturnType<typeof vi.fn>;
  let mockGetDescriptor: ReturnType<typeof vi.fn>;
  let mockSpotifyHandlePlaylistSelect: ReturnType<typeof vi.fn>;
  let mockStopRadioBase: ReturnType<typeof vi.fn>;
  let mockActiveDescriptor: any;
  let mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
  let drivingProviderRef: React.MutableRefObject<string | null>;

  beforeEach(() => {
    mockPlayTrack = vi.fn().mockResolvedValue(undefined);
    mockSetError = vi.fn();
    mockSetIsLoading = vi.fn();
    mockSetTracks = vi.fn();
    mockSetOriginalTracks = vi.fn();
    mockSetCurrentTrackIndex = vi.fn();
    mockSetSelectedPlaylistId = vi.fn();
    mockSetActiveProviderId = vi.fn();
    mockGetDescriptor = vi.fn();
    mockSpotifyHandlePlaylistSelect = vi.fn().mockResolvedValue([]);
    mockStopRadioBase = vi.fn();
    mediaTracksRef = { current: [] };
    drivingProviderRef = { current: null };
    mockActiveDescriptor = { id: 'spotify' };
  });

  it('loading a standard provider collection sets tracks and calls playTrack(0)', async () => {
    // #given
    const mockCatalog = {
      listTracks: vi.fn().mockResolvedValue([
        makeMediaTrack('1'),
        makeMediaTrack('2'),
        makeMediaTrack('3'),
      ]),
    };
    mockGetDescriptor.mockReturnValue({
      id: 'spotify',
      catalog: mockCatalog,
      playback: { pause: vi.fn() },
    });
    mockActiveDescriptor.catalog = mockCatalog;
    mockActiveDescriptor.playback = { pause: vi.fn() };

    const { result } = renderHook(() =>
      useCollectionLoader({
        trackOps: { setError: mockSetError, setIsLoading: mockSetIsLoading, setSelectedPlaylistId: mockSetSelectedPlaylistId, setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setActiveProviderId: mockSetActiveProviderId,
        connectedProviderIds: ['spotify'],
        shuffleEnabled: false,
        isUnifiedLikedActive: false,
        drivingProviderRef,
        playTrack: mockPlayTrack,
        spotifyHandlePlaylistSelect: mockSpotifyHandlePlaylistSelect,
        stopRadioBase: mockStopRadioBase,
        radioStateIsActive: false,
      })
    );

    // #when
    const trackCount = await act(async () => {
      return result.current.loadCollection('playlist_123');
    });

    // #then
    const expectedTracks = [makeMediaTrack('1'), makeMediaTrack('2'), makeMediaTrack('3')];
    expect(mockSetIsLoading).toHaveBeenCalledWith(true);
    expect(mockSetTracks).toHaveBeenCalledWith(expectedTracks);
    expect(mockSetOriginalTracks).toHaveBeenCalledWith(expectedTracks);
    expect(mockPlayTrack).toHaveBeenCalledWith(0);
    expect(trackCount).toBe(3);
  });

  it('loading unified liked songs merges results from multiple providers sorted by addedAt', async () => {
    // #given
    const mockCatalog1 = {
      listTracks: vi.fn().mockResolvedValue([
        makeMediaTrack('1', 1000),
        makeMediaTrack('2', 500),
      ]),
    };
    const mockCatalog2 = {
      listTracks: vi.fn().mockResolvedValue([
        makeMediaTrack('3', 1500),
      ]),
    };

    mockGetDescriptor.mockImplementation((id: string) => {
      if (id === 'spotify') {
        return {
          id: 'spotify',
          catalog: mockCatalog1,
          capabilities: { hasLikedCollection: true },
        };
      }
      return {
        id: 'dropbox',
        catalog: mockCatalog2,
        capabilities: { hasLikedCollection: true },
      };
    });

    const { result } = renderHook(() =>
      useCollectionLoader({
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        trackOps: { setError: mockSetError, setIsLoading: mockSetIsLoading, setSelectedPlaylistId: mockSetSelectedPlaylistId, setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        setActiveProviderId: mockSetActiveProviderId,
        connectedProviderIds: ['spotify', 'dropbox'],
        shuffleEnabled: false,
        isUnifiedLikedActive: true,
        drivingProviderRef,
        playTrack: mockPlayTrack,
        spotifyHandlePlaylistSelect: mockSpotifyHandlePlaylistSelect,
        stopRadioBase: mockStopRadioBase,
        radioStateIsActive: false,
      })
    );

    // #when
    const trackCount = await act(async () => {
      return result.current.loadCollection(LIKED_SONGS_ID);
    });

    // #then
    const expectedMergedOrder = [makeMediaTrack('3', 1500), makeMediaTrack('1', 1000), makeMediaTrack('2', 500)];
    expect(mockSetTracks).toHaveBeenCalledWith(expectedMergedOrder);
    expect(mockSetOriginalTracks).toHaveBeenCalledWith(expectedMergedOrder);
    expect(trackCount).toBe(3);
  });

  it('an empty collection result sets error state', async () => {
    // #given
    const mockCatalog = {
      listTracks: vi.fn().mockResolvedValue([]),
    };
    mockActiveDescriptor.catalog = mockCatalog;
    mockActiveDescriptor.playback = { pause: vi.fn(), playCollection: undefined };

    const { result } = renderHook(() =>
      useCollectionLoader({
        trackOps: { setError: mockSetError, setIsLoading: mockSetIsLoading, setSelectedPlaylistId: mockSetSelectedPlaylistId, setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setActiveProviderId: mockSetActiveProviderId,
        connectedProviderIds: ['spotify'],
        shuffleEnabled: false,
        isUnifiedLikedActive: false,
        drivingProviderRef,
        playTrack: mockPlayTrack,
        spotifyHandlePlaylistSelect: mockSpotifyHandlePlaylistSelect,
        stopRadioBase: mockStopRadioBase,
        radioStateIsActive: false,
      })
    );

    // #when
    const trackCount = await act(async () => {
      return result.current.loadCollection('playlist_123');
    });

    // #then
    expect(mockSetError).toHaveBeenCalledWith('No tracks found in this collection.');
    expect(mockSetTracks).toHaveBeenCalledWith([]);
    expect(trackCount).toBe(0);
  });

  it('the legacy SDK fallback path is invoked when list.length === 0 and playCollection is defined', async () => {
    // #given
    mockSpotifyHandlePlaylistSelect.mockResolvedValue([makeTrack('1'), makeTrack('2')]);

    const mockCatalog = {
      listTracks: vi.fn().mockResolvedValue([]),
    };
    mockActiveDescriptor.catalog = mockCatalog;
    mockActiveDescriptor.playback = { pause: vi.fn(), playCollection: vi.fn() };

    const { result } = renderHook(() =>
      useCollectionLoader({
        trackOps: { setError: mockSetError, setIsLoading: mockSetIsLoading, setSelectedPlaylistId: mockSetSelectedPlaylistId, setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setActiveProviderId: mockSetActiveProviderId,
        connectedProviderIds: ['spotify'],
        shuffleEnabled: false,
        isUnifiedLikedActive: false,
        drivingProviderRef,
        playTrack: mockPlayTrack,
        spotifyHandlePlaylistSelect: mockSpotifyHandlePlaylistSelect,
        stopRadioBase: mockStopRadioBase,
        radioStateIsActive: false,
      })
    );

    // #when
    const trackCount = await act(async () => {
      return result.current.loadCollection('playlist_123');
    });

    // #then
    expect(mockSpotifyHandlePlaylistSelect).toHaveBeenCalledWith('playlist_123');
    expect(trackCount).toBe(2);
  });

  it('stops radio before loading a new collection when radio is active', async () => {
    // #given
    const mockCatalog = {
      listTracks: vi.fn().mockResolvedValue([makeMediaTrack('1')]),
    };
    mockActiveDescriptor.catalog = mockCatalog;
    mockActiveDescriptor.playback = { pause: vi.fn() };

    const { result } = renderHook(() =>
      useCollectionLoader({
        trackOps: { setError: mockSetError, setIsLoading: mockSetIsLoading, setSelectedPlaylistId: mockSetSelectedPlaylistId, setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setActiveProviderId: mockSetActiveProviderId,
        connectedProviderIds: ['spotify'],
        shuffleEnabled: false,
        isUnifiedLikedActive: false,
        drivingProviderRef,
        playTrack: mockPlayTrack,
        spotifyHandlePlaylistSelect: mockSpotifyHandlePlaylistSelect,
        stopRadioBase: mockStopRadioBase,
        radioStateIsActive: true,
      })
    );

    // #when
    await act(async () => {
      await result.current.loadCollection('playlist_123');
    });

    // #then
    expect(mockStopRadioBase).toHaveBeenCalled();
  });

  it('shuffles tracks when shuffleEnabled is true', async () => {
    // #given
    const tracks = [makeMediaTrack('1'), makeMediaTrack('2'), makeMediaTrack('3')];
    const mockCatalog = { listTracks: vi.fn().mockResolvedValue(tracks) };
    mockActiveDescriptor.catalog = mockCatalog;
    mockActiveDescriptor.playback = { pause: vi.fn() };

    const { result } = renderHook(() =>
      useCollectionLoader({
        trackOps: { setError: mockSetError, setIsLoading: mockSetIsLoading, setSelectedPlaylistId: mockSetSelectedPlaylistId, setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setActiveProviderId: mockSetActiveProviderId,
        connectedProviderIds: ['spotify'],
        shuffleEnabled: true,
        isUnifiedLikedActive: false,
        drivingProviderRef,
        playTrack: mockPlayTrack,
        spotifyHandlePlaylistSelect: mockSpotifyHandlePlaylistSelect,
        stopRadioBase: mockStopRadioBase,
        radioStateIsActive: false,
      })
    );

    // #when
    await act(async () => {
      await result.current.loadCollection('playlist_123');
    });

    // #then
    expect(mockSetOriginalTracks).toHaveBeenCalledWith(tracks);
    expect(mockSetTracks).toHaveBeenCalledTimes(1);
    const shuffledTracks = mockSetTracks.mock.calls[0][0] as MediaTrack[];
    expect(shuffledTracks).toHaveLength(tracks.length);
    expect(shuffledTracks.map(t => t.id).sort()).toEqual(['1', '2', '3']);
  });

  it('switches active provider when loading a collection from a different provider', async () => {
    // #given
    const dropboxCatalog = { listTracks: vi.fn().mockResolvedValue([makeMediaTrack('1')]) };
    const dropboxDescriptor = {
      id: 'dropbox' as const,
      catalog: dropboxCatalog,
      playback: { pause: vi.fn() },
    };
    mockGetDescriptor.mockReturnValue(dropboxDescriptor);
    mockActiveDescriptor.playback = { pause: vi.fn().mockResolvedValue(undefined) };

    const { result } = renderHook(() =>
      useCollectionLoader({
        trackOps: { setError: mockSetError, setIsLoading: mockSetIsLoading, setSelectedPlaylistId: mockSetSelectedPlaylistId, setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setActiveProviderId: mockSetActiveProviderId,
        connectedProviderIds: ['spotify', 'dropbox'],
        shuffleEnabled: false,
        isUnifiedLikedActive: false,
        drivingProviderRef,
        playTrack: mockPlayTrack,
        spotifyHandlePlaylistSelect: mockSpotifyHandlePlaylistSelect,
        stopRadioBase: mockStopRadioBase,
        radioStateIsActive: false,
      })
    );

    // #when
    await act(async () => {
      await result.current.loadCollection('playlist_123', 'dropbox');
    });

    // #then
    expect(mockSetActiveProviderId).toHaveBeenCalledWith('dropbox');
  });

  it('sets error state when catalog throws during collection load', async () => {
    const mockCatalog = { listTracks: vi.fn().mockRejectedValue(new Error('Network error')) };
    mockActiveDescriptor.catalog = mockCatalog;
    mockActiveDescriptor.playback = { pause: vi.fn() };

    const { result } = renderHook(() =>
      useCollectionLoader({
        trackOps: { setError: mockSetError, setIsLoading: mockSetIsLoading, setSelectedPlaylistId: mockSetSelectedPlaylistId, setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setActiveProviderId: mockSetActiveProviderId,
        connectedProviderIds: ['spotify'],
        shuffleEnabled: false,
        isUnifiedLikedActive: false,
        drivingProviderRef,
        playTrack: mockPlayTrack,
        spotifyHandlePlaylistSelect: mockSpotifyHandlePlaylistSelect,
        stopRadioBase: mockStopRadioBase,
        radioStateIsActive: false,
      })
    );

    const trackCount = await act(async () => {
      return result.current.loadCollection('playlist_123');
    });

    expect(mockSetError).toHaveBeenCalledWith('Network error');
    expect(trackCount).toBe(0);
  });

  it('shows empty-collection error when all unified liked catalogs fail or return no tracks', async () => {
    // listTracks rejections are swallowed per-provider (.catch(() => [])); the hook
    // surfaces 'No liked tracks found.' when the merged result is empty.
    mockGetDescriptor.mockReturnValue({
      id: 'spotify',
      catalog: { listTracks: vi.fn().mockRejectedValue(new Error('Auth expired')) },
      capabilities: { hasLikedCollection: true },
    });

    const { result } = renderHook(() =>
      useCollectionLoader({
        trackOps: { setError: mockSetError, setIsLoading: mockSetIsLoading, setSelectedPlaylistId: mockSetSelectedPlaylistId, setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setActiveProviderId: mockSetActiveProviderId,
        connectedProviderIds: ['spotify'],
        shuffleEnabled: false,
        isUnifiedLikedActive: true,
        drivingProviderRef,
        playTrack: mockPlayTrack,
        spotifyHandlePlaylistSelect: mockSpotifyHandlePlaylistSelect,
        stopRadioBase: mockStopRadioBase,
        radioStateIsActive: false,
      })
    );

    const trackCount = await act(async () => {
      return result.current.loadCollection(LIKED_SONGS_ID);
    });

    expect(mockSetError).toHaveBeenCalledWith('No liked tracks found.');
    expect(trackCount).toBe(0);
  });

  it('returns 0 without loading when no descriptor is found for the requested provider', async () => {
    mockGetDescriptor.mockReturnValue(undefined);

    const { result } = renderHook(() =>
      useCollectionLoader({
        trackOps: { setError: mockSetError, setIsLoading: mockSetIsLoading, setSelectedPlaylistId: mockSetSelectedPlaylistId, setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        activeDescriptor: undefined,
        getDescriptor: mockGetDescriptor,
        setActiveProviderId: mockSetActiveProviderId,
        connectedProviderIds: [],
        shuffleEnabled: false,
        isUnifiedLikedActive: false,
        drivingProviderRef,
        playTrack: mockPlayTrack,
        spotifyHandlePlaylistSelect: mockSpotifyHandlePlaylistSelect,
        stopRadioBase: mockStopRadioBase,
        radioStateIsActive: false,
      })
    );

    const trackCount = await act(async () => {
      return result.current.loadCollection('playlist_123');
    });

    expect(trackCount).toBe(0);
    expect(mockSetIsLoading).not.toHaveBeenCalled();
  });
});
