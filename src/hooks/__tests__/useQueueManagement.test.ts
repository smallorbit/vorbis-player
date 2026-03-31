import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQueueManagement } from '../useQueueManagement';
import type { Track } from '@/services/spotify';
import type { MediaTrack } from '@/types/domain';

function makeTrack(id: string): Track {
  return {
    id,
    provider: 'spotify',
    name: `Track ${id}`,
    artists: 'Artist',
    artistsData: [],
    album: 'Album',
    album_id: 'album_id',
    track_number: 1,
    duration_ms: 180000,
    uri: `spotify:track:${id}`,
  };
}

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
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];
    const { result } = renderHook(() =>
      useQueueManagement({
        tracks,
        currentTrackIndex: 1,
        shuffleEnabled: false,
        mediaTracksRef,
        handlePlaylistSelect: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setTracks: mockSetTracks,
        setOriginalTracks: mockSetOriginalTracks,
        setCurrentTrackIndex: mockSetCurrentTrackIndex,
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
    mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2'), makeMediaTrack('3')];
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];
    const { result } = renderHook(() =>
      useQueueManagement({
        tracks,
        currentTrackIndex: 2,
        shuffleEnabled: false,
        mediaTracksRef,
        handlePlaylistSelect: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setTracks: mockSetTracks,
        setOriginalTracks: mockSetOriginalTracks,
        setCurrentTrackIndex: mockSetCurrentTrackIndex,
      })
    );

    act(() => {
      result.current.handleRemoveFromQueue(0);
    });

    // Should decrement currentTrackIndex from 2 to 1
    expect(mockSetCurrentTrackIndex).toHaveBeenCalledWith(expect.any(Function));
    expect(mockSetTracks).toHaveBeenCalled();
    expect(mockSetOriginalTracks).toHaveBeenCalled();
  });

  it('handleReorderQueue updates currentTrackIndex to follow the playing track', () => {
    mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2'), makeMediaTrack('3')];
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];
    const { result } = renderHook(() =>
      useQueueManagement({
        tracks,
        currentTrackIndex: 0,
        shuffleEnabled: false,
        mediaTracksRef,
        handlePlaylistSelect: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setTracks: mockSetTracks,
        setOriginalTracks: mockSetOriginalTracks,
        setCurrentTrackIndex: mockSetCurrentTrackIndex,
      })
    );

    act(() => {
      result.current.handleReorderQueue(0, 2); // Move first track to end
    });

    // After reordering, the playing track (originally at 0) should be at index 2
    expect(mockSetCurrentTrackIndex).toHaveBeenCalledWith(2);
    expect(mockSetTracks).toHaveBeenCalled();
  });

  it('handleAddToQueue delegates to handlePlaylistSelect when queue is empty', async () => {
    mockHandlePlaylistSelect.mockResolvedValue(3);

    const { result } = renderHook(() =>
      useQueueManagement({
        tracks: [],
        currentTrackIndex: 0,
        shuffleEnabled: false,
        mediaTracksRef,
        handlePlaylistSelect: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setTracks: mockSetTracks,
        setOriginalTracks: mockSetOriginalTracks,
        setCurrentTrackIndex: mockSetCurrentTrackIndex,
      })
    );

    const response = await act(async () => {
      return result.current.handleAddToQueue('playlist_id', 'My Playlist');
    });

    expect(mockHandlePlaylistSelect).toHaveBeenCalledWith('playlist_id', 'My Playlist', undefined);
    expect(response).toEqual({ added: 3, collectionName: 'My Playlist' });
  });

  it('handleAddToQueue appends tracks to an existing queue without resetting currentTrackIndex', async () => {
    mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2')];
    const tracks = [makeTrack('1'), makeTrack('2')];

    const mockCatalog = {
      listTracks: vi.fn().mockResolvedValue([makeMediaTrack('3'), makeMediaTrack('4')]),
    };
    mockGetDescriptor.mockReturnValue({
      id: 'spotify',
      catalog: mockCatalog,
    });
    mockActiveDescriptor.id = 'spotify';

    const { result } = renderHook(() =>
      useQueueManagement({
        tracks,
        currentTrackIndex: 0,
        shuffleEnabled: false,
        mediaTracksRef,
        handlePlaylistSelect: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        setTracks: mockSetTracks,
        setOriginalTracks: mockSetOriginalTracks,
        setCurrentTrackIndex: mockSetCurrentTrackIndex,
      })
    );

    const response = await act(async () => {
      return result.current.handleAddToQueue('playlist_id');
    });

    // Should have appended the new tracks
    expect(mockSetTracks).toHaveBeenCalledWith(expect.any(Function));
    expect(mockSetOriginalTracks).toHaveBeenCalled();
    expect(response).toEqual({ added: 2, collectionName: undefined });
    // currentTrackIndex should NOT be reset
    expect(mockSetCurrentTrackIndex).not.toHaveBeenCalled();
  });
});
