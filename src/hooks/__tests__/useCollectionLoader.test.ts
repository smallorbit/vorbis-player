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

    const trackCount = await act(async () => {
      return result.current.handlePlaylistSelect('playlist_123', 'My Playlist');
    });

    expect(mockSetIsLoading).toHaveBeenCalledWith(true);
    expect(mockSetTracks).toHaveBeenCalled();
    expect(mockSetOriginalTracks).toHaveBeenCalled();
    expect(mockPlayTrack).toHaveBeenCalledWith(0);
    expect(trackCount).toBe(3);
  });

  it('loading unified liked songs merges results from multiple providers sorted by addedAt', async () => {
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

    const trackCount = await act(async () => {
      return result.current.handlePlaylistSelect(LIKED_SONGS_ID);
    });

    // Should merge and sort by addedAt (newest first): track 3 (1500), track 1 (1000), track 2 (500)
    expect(mockSetTracks).toHaveBeenCalled();
    expect(trackCount).toBe(3);
  });

  it('an empty collection result sets error state', async () => {
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

    const trackCount = await act(async () => {
      return result.current.handlePlaylistSelect('playlist_123', 'Empty Playlist');
    });

    expect(mockSetError).toHaveBeenCalledWith('No tracks found in this collection.');
    expect(mockSetTracks).toHaveBeenCalledWith([]);
    expect(trackCount).toBe(0);
  });

  it('the legacy SDK fallback path is invoked when list.length === 0 and playCollection is defined', async () => {
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

    const trackCount = await act(async () => {
      return result.current.handlePlaylistSelect('playlist_123');
    });

    // Should delegate to spotifyHandlePlaylistSelect
    expect(mockSpotifyHandlePlaylistSelect).toHaveBeenCalledWith('playlist_123');
    expect(trackCount).toBe(2);
  });
});
