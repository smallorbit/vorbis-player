import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQueueManagement } from '../useQueueManagement';
import { makeTrack } from '@/test/fixtures';
import type { MediaTrack } from '@/types/domain';

function makeMediaTrack(id: string): MediaTrack {
  return {
    id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: `spotify:track:${id}` },
    name: `Track ${id}`,
    artists: 'Artist',
    album: 'Album',
    durationMs: 180000,
  };
}

describe('useQueueManagement', () => {
  let mockHandlePlaylistSelect: ReturnType<typeof vi.fn>;
  let mockHandleBackToLibrary: ReturnType<typeof vi.fn>;
  let mockSetTracks: ReturnType<typeof vi.fn>;
  let mockSetOriginalTracks: ReturnType<typeof vi.fn>;
  let mockSetCurrentTrackIndex: ReturnType<typeof vi.fn>;
  let mockGetDescriptor: ReturnType<typeof vi.fn>;
  let mockActiveDescriptor: any;
  let mediaTracksRef: React.MutableRefObject<MediaTrack[]>;

  beforeEach(() => {
    mockHandlePlaylistSelect = vi.fn();
    mockHandleBackToLibrary = vi.fn();
    mockSetTracks = vi.fn();
    mockSetOriginalTracks = vi.fn();
    mockSetCurrentTrackIndex = vi.fn();
    mockGetDescriptor = vi.fn();
    mockActiveDescriptor = { id: 'spotify' };
    mediaTracksRef = { current: [] };
  });

  it('handleRemoveFromQueue does nothing when index equals currentTrackIndex', () => {
    const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' }), makeTrack({ id: '3' })];
    const { result } = renderHook(() =>
      useQueueManagement({
        tracks,
        currentTrackIndex: 1,
        shuffleEnabled: false,
        trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        loadCollection: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
      })
    );

    act(() => {
      result.current.handleRemoveFromQueue(1);
    });

    // Should not call any setters when trying to remove the current track
    expect(mockSetTracks).not.toHaveBeenCalled();
    expect(mockSetOriginalTracks).not.toHaveBeenCalled();
  });

  it('handleRemoveFromQueue adjusts currentTrackIndex when removing a track before the current one', () => {
    // #given
    mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2'), makeMediaTrack('3')];
    const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' }), makeTrack({ id: '3' })];
    const { result } = renderHook(() =>
      useQueueManagement({
        tracks,
        currentTrackIndex: 2,
        shuffleEnabled: false,
        trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        loadCollection: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
      })
    );

    // #when
    act(() => {
      result.current.handleRemoveFromQueue(0);
    });

    // #then — setCurrentTrackIndex receives a functional updater that decrements by 1
    expect(mockSetCurrentTrackIndex).toHaveBeenCalledWith(expect.any(Function));
    const indexUpdater = mockSetCurrentTrackIndex.mock.calls[0][0] as (prev: number) => number;
    expect(indexUpdater(2)).toBe(1);

    // setTracks receives a functional updater that removes the track at index 0
    expect(mockSetTracks).toHaveBeenCalledWith(expect.any(Function));
    const tracksUpdater = mockSetTracks.mock.calls[0][0] as (prev: typeof tracks) => typeof tracks;
    expect(tracksUpdater(tracks)).toEqual([makeTrack({ id: '2' }), makeTrack({ id: '3' })]);

    expect(mockSetOriginalTracks).toHaveBeenCalled();
  });

  it('handleReorderQueue updates currentTrackIndex to follow the playing track', () => {
    // #given
    mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2'), makeMediaTrack('3')];
    const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' }), makeTrack({ id: '3' })];
    const { result } = renderHook(() =>
      useQueueManagement({
        tracks,
        currentTrackIndex: 0,
        shuffleEnabled: false,
        trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        loadCollection: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
      })
    );

    // #when
    act(() => {
      result.current.handleReorderQueue(0, 2);
    });

    // #then
    expect(mockSetCurrentTrackIndex).toHaveBeenCalledWith(2);
    expect(mockSetTracks).toHaveBeenCalled();
  });

  it('handleAddToQueue delegates to loadCollection when queue is empty', async () => {
    // #given
    mockHandlePlaylistSelect.mockResolvedValue(3);

    const { result } = renderHook(() =>
      useQueueManagement({
        tracks: [],
        currentTrackIndex: 0,
        shuffleEnabled: false,
        trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        loadCollection: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
      })
    );

    // #when
    const response = await act(async () => {
      return result.current.handleAddToQueue('playlist_id', 'My Playlist');
    });

    // #then
    expect(mockHandlePlaylistSelect).toHaveBeenCalledWith('playlist_id', undefined, 'My Playlist');
    expect(response).toEqual({ added: 3, collectionName: 'My Playlist' });
  });

  it('handleAddToQueue appends tracks to an existing queue without resetting currentTrackIndex', async () => {
    // #given
    mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2')];
    const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' })];

    const mockCatalog = {
      listTracks: vi.fn().mockResolvedValue([makeMediaTrack('3'), makeMediaTrack('4')]),
    };
    mockActiveDescriptor.id = 'spotify';
    mockActiveDescriptor.catalog = mockCatalog;

    const { result } = renderHook(() =>
      useQueueManagement({
        tracks,
        currentTrackIndex: 0,
        shuffleEnabled: false,
        trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        loadCollection: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
      })
    );

    // #when
    const response = await act(async () => {
      return result.current.handleAddToQueue('playlist_id');
    });

    // #then
    expect(mockSetTracks).toHaveBeenCalledWith(expect.any(Function));
    const tracksUpdater = mockSetTracks.mock.calls[0][0] as (prev: ReturnType<typeof makeMediaTrack>[]) => ReturnType<typeof makeMediaTrack>[];
    const existingTracks = [makeMediaTrack('1'), makeMediaTrack('2')];
    const appended = tracksUpdater(existingTracks);
    expect(appended).toHaveLength(4);
    expect(appended[0].id).toBe('1');
    expect(appended[1].id).toBe('2');
    expect(appended[2].id).toBe('3');
    expect(appended[3].id).toBe('4');

    expect(mockSetOriginalTracks).toHaveBeenCalled();
    expect(response).toEqual({ added: 2, collectionName: undefined });
    expect(mockSetCurrentTrackIndex).not.toHaveBeenCalled();
  });
});
