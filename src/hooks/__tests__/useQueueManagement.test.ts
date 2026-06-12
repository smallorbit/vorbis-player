import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { useQueueManagement } from '../useQueueManagement';
import { makeTrack } from '@/test/fixtures';
import type { MediaTrack } from '@/types/domain';

vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

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
  let mockActiveDescriptor: { id: string; [key: string]: unknown };
  let mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
  let mockGetDrivingProviderDescriptor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockHandlePlaylistSelect = vi.fn();
    mockHandleBackToLibrary = vi.fn();
    mockSetTracks = vi.fn();
    mockSetOriginalTracks = vi.fn();
    mockSetCurrentTrackIndex = vi.fn();
    mockGetDescriptor = vi.fn();
    mockActiveDescriptor = { id: 'spotify' };
    mediaTracksRef = { current: [] };
    // Default: no driving descriptor (notify is a no-op). Tests covering native-sync
    // override this with a descriptor that declares `hasNativeQueueSync`.
    mockGetDrivingProviderDescriptor = vi.fn(() => undefined);
    vi.mocked(toast).mockClear();
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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
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

  it('handleAddToQueue shuffles Dropbox All Music tracks before appending', async () => {
    // #given — existing queue + All Music ref ('' id, dropbox folder) returning a large ordered list
    mediaTracksRef.current = [makeMediaTrack('a'), makeMediaTrack('b')];
    const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    const incoming = Array.from({ length: 20 }, (_, i) => makeMediaTrack(`n${i + 1}`));
    const mockCatalog = { listTracks: vi.fn().mockResolvedValue(incoming) };
    const dropboxDescriptor = { id: 'dropbox' as const, catalog: mockCatalog, playback: { pause: vi.fn() } };

    const { result } = renderHook(() =>
      useQueueManagement({
        tracks,
        currentTrackIndex: 0,
        shuffleEnabled: false,
        trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        loadCollection: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: dropboxDescriptor,
        getDescriptor: mockGetDescriptor,
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when — empty playlist id resolves to All Music (dropbox/folder/'')
    await act(async () => {
      await result.current.handleAddToQueue('');
    });

    // #then — setTracks updater yields a shuffled permutation of the incoming tracks appended to the existing queue
    expect(mockSetTracks).toHaveBeenCalledWith(expect.any(Function));
    const tracksUpdater = mockSetTracks.mock.calls[0][0] as (prev: MediaTrack[]) => MediaTrack[];
    const appended = tracksUpdater([makeMediaTrack('a'), makeMediaTrack('b')]);
    expect(appended).toHaveLength(22);
    expect(appended[0].id).toBe('a');
    expect(appended[1].id).toBe('b');
    const appendedIds = appended.slice(2).map(t => t.id);
    expect(appendedIds.slice().sort()).toEqual(incoming.map(t => t.id).slice().sort());
    const orderPreserved = appendedIds.every((id, i) => id === incoming[i].id);
    expect(orderPreserved).toBe(false);
  });

  it('handleAddToQueue preserves catalog order when appending a non-All-Music Dropbox folder', async () => {
    // #given — regression guard for shuffle-by-default semantics
    mediaTracksRef.current = [makeMediaTrack('a')];
    const tracks = [makeTrack({ id: 'a' })];
    const incoming = Array.from({ length: 20 }, (_, i) => makeMediaTrack(`n${i + 1}`));
    const mockCatalog = { listTracks: vi.fn().mockResolvedValue(incoming) };
    const dropboxDescriptor = { id: 'dropbox' as const, catalog: mockCatalog, playback: { pause: vi.fn() } };

    const { result } = renderHook(() =>
      useQueueManagement({
        tracks,
        currentTrackIndex: 0,
        shuffleEnabled: false,
        trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        loadCollection: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: dropboxDescriptor,
        getDescriptor: mockGetDescriptor,
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when — non-empty folder id (not All Music)
    await act(async () => {
      await result.current.handleAddToQueue('/Music/Artist/Album');
    });

    // #then — appended portion preserves incoming order
    const tracksUpdater = mockSetTracks.mock.calls[0][0] as (prev: MediaTrack[]) => MediaTrack[];
    const appended = tracksUpdater([makeMediaTrack('a')]);
    expect(appended.slice(1).map(t => t.id)).toEqual(incoming.map(t => t.id));
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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
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

  it('handleAddToQueue toasts the empty-collection message when loadCollection returns 0', async () => {
    // #given — empty queue, descriptor present, but loadCollection yields nothing
    mockHandlePlaylistSelect.mockResolvedValue(0);

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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when
    const response = await act(async () => result.current.handleAddToQueue('empty_playlist'));

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith('This collection is empty.', { id: 'qap-add-queue-empty' });
  });

  it('handleAddToQueue toasts the failure message when no descriptor resolves', async () => {
    // #given — no active descriptor and no resolvable provider
    const { result } = renderHook(() =>
      useQueueManagement({
        tracks: [makeTrack({ id: 'a' })],
        currentTrackIndex: 0,
        shuffleEnabled: false,
        trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
        loadCollection: mockHandlePlaylistSelect,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: undefined,
        getDescriptor: mockGetDescriptor,
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when
    const response = await act(async () => result.current.handleAddToQueue('playlist_id'));

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith("Couldn't add to queue. Try again.", { id: 'qap-add-queue-error' });
    expect(mockSetTracks).not.toHaveBeenCalled();
  });

  it('handleAddToQueue toasts the duplicate message when every fetched track is already queued', async () => {
    // #given — queue already contains every track listTracks will return
    mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2')];
    const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' })];
    const mockCatalog = {
      listTracks: vi.fn().mockResolvedValue([makeMediaTrack('1'), makeMediaTrack('2')]),
    };
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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when
    const response = await act(async () => result.current.handleAddToQueue('playlist_id'));

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith('Already in your queue.', { id: 'qap-add-queue-dup' });
    expect(mockSetTracks).not.toHaveBeenCalled();
  });

  it('handleAddToQueue toasts the failure message when listTracks throws', async () => {
    // #given — non-empty queue, descriptor whose catalog rejects
    mediaTracksRef.current = [makeMediaTrack('1')];
    const tracks = [makeTrack({ id: '1' })];
    const mockCatalog = {
      listTracks: vi.fn().mockRejectedValue(new Error('boom')),
    };
    mockActiveDescriptor.catalog = mockCatalog;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when
    const response = await act(async () => result.current.handleAddToQueue('playlist_id'));

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith("Couldn't add to queue. Try again.", { id: 'qap-add-queue-error' });
    errorSpy.mockRestore();
  });

  it('insertTracksNext inserts a single track at currentTrackIndex + 1', () => {
    // #given — queue of 4 tracks, currently playing index 1
    mediaTracksRef.current = [makeMediaTrack('a'), makeMediaTrack('b'), makeMediaTrack('c'), makeMediaTrack('d')];
    const tracks = [
      makeTrack({ id: 'a' }),
      makeTrack({ id: 'b' }),
      makeTrack({ id: 'c' }),
      makeTrack({ id: 'd' }),
    ];

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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when
    let response: ReturnType<typeof result.current.insertTracksNext> = null;
    act(() => {
      response = result.current.insertTracksNext([makeMediaTrack('x')], 'X');
    });

    // #then — setTracks called with full array (insert-next path uses non-functional update)
    expect(response).toEqual({ added: 1, collectionName: 'X' });
    expect(mockSetTracks).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a' }),
      expect.objectContaining({ id: 'b' }),
      expect.objectContaining({ id: 'x' }),
      expect.objectContaining({ id: 'c' }),
      expect.objectContaining({ id: 'd' }),
    ]);
    expect(mediaTracksRef.current.map((t) => t.id)).toEqual(['a', 'b', 'x', 'c', 'd']);
    expect(mockSetCurrentTrackIndex).not.toHaveBeenCalled();
  });

  it('insertTracksNext appends when queue is empty (no current track to insert after)', () => {
    // #given — empty queue
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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when
    let response: ReturnType<typeof result.current.insertTracksNext> = null;
    act(() => {
      response = result.current.insertTracksNext([makeMediaTrack('1'), makeMediaTrack('2')]);
    });

    // #then
    expect(response).toEqual({ added: 2, collectionName: undefined });
    expect(mockSetTracks).toHaveBeenCalledWith([
      expect.objectContaining({ id: '1' }),
      expect.objectContaining({ id: '2' }),
    ]);
    expect(mediaTracksRef.current.map((t) => t.id)).toEqual(['1', '2']);
  });

  it('insertTracksNext returns null and toasts when every track is already queued', () => {
    // #given
    mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2')];
    const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' })];

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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when
    let response: ReturnType<typeof result.current.insertTracksNext> = null;
    act(() => {
      response = result.current.insertTracksNext([makeMediaTrack('1'), makeMediaTrack('2')]);
    });

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith('Already in your queue.', { id: 'qap-add-queue-dup' });
    expect(mockSetTracks).not.toHaveBeenCalled();
  });

  it('insertTracksNext dedups against existing queue and inserts only the unique tracks', () => {
    // #given — '1' is already queued, 'x' and 'y' are new
    mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2')];
    const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' })];

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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when — mix of duplicate '1' with new 'x' and 'y'
    let response: ReturnType<typeof result.current.insertTracksNext> = null;
    act(() => {
      response = result.current.insertTracksNext([makeMediaTrack('1'), makeMediaTrack('x'), makeMediaTrack('y')]);
    });

    // #then — only x and y are inserted, currentTrackIndex preserved
    expect(response).toEqual({ added: 2, collectionName: undefined });
    expect(mediaTracksRef.current.map((t) => t.id)).toEqual(['1', 'x', 'y', '2']);
    expect(mockSetCurrentTrackIndex).not.toHaveBeenCalled();
  });

  it('insertCollectionNext delegates to loadCollection when queue is empty', async () => {
    // #given
    mockHandlePlaylistSelect.mockResolvedValue(5);

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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when
    const response = await act(async () =>
      result.current.insertCollectionNext('playlist_id', 'My Playlist'),
    );

    // #then
    expect(mockHandlePlaylistSelect).toHaveBeenCalledWith('playlist_id', undefined, 'My Playlist');
    expect(response).toEqual({ added: 5, collectionName: 'My Playlist' });
  });

  it('insertCollectionNext fetches via catalog and inserts at currentTrackIndex + 1 when queue is non-empty', async () => {
    // #given
    mediaTracksRef.current = [makeMediaTrack('a'), makeMediaTrack('b')];
    const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    const fetched = [makeMediaTrack('p1'), makeMediaTrack('p2'), makeMediaTrack('p3')];
    const mockCatalog = { listTracks: vi.fn().mockResolvedValue(fetched) };
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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when
    const response = await act(async () =>
      result.current.insertCollectionNext('playlist_id', 'P'),
    );

    // #then — 3 tracks inserted at index 1 (currentTrackIndex + 1)
    expect(response).toEqual({ added: 3, collectionName: 'P' });
    expect(mockCatalog.listTracks).toHaveBeenCalled();
    expect(mediaTracksRef.current.map((t) => t.id)).toEqual(['a', 'p1', 'p2', 'p3', 'b']);
    expect(mockSetCurrentTrackIndex).not.toHaveBeenCalled();
  });

  it('insertCollectionNext toasts the failure message when listTracks throws', async () => {
    // #given
    mediaTracksRef.current = [makeMediaTrack('a')];
    const tracks = [makeTrack({ id: 'a' })];
    const mockCatalog = { listTracks: vi.fn().mockRejectedValue(new Error('boom')) };
    mockActiveDescriptor.catalog = mockCatalog;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when
    const response = await act(async () => result.current.insertCollectionNext('p1'));

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith("Couldn't add to queue. Try again.", { id: 'qap-add-queue-error' });
    errorSpy.mockRestore();
  });

  it('keeps callback identities stable across re-renders when inputs are unchanged', () => {
    // #given — identical input references on every render
    const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' }), makeTrack({ id: '3' })];
    mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2'), makeMediaTrack('3')];

    const props = {
      tracks,
      currentTrackIndex: 0,
      shuffleEnabled: false,
      trackOps: {
        setTracks: mockSetTracks,
        setOriginalTracks: mockSetOriginalTracks,
        setCurrentTrackIndex: mockSetCurrentTrackIndex,
        mediaTracksRef,
      },
      loadCollection: mockHandlePlaylistSelect,
      handleBackToLibrary: mockHandleBackToLibrary,
      activeDescriptor: mockActiveDescriptor,
      getDescriptor: mockGetDescriptor,
      getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
    };

    const { result, rerender } = renderHook((p: typeof props) => useQueueManagement(p), {
      initialProps: props,
    });

    const initialRemove = result.current.handleRemoveFromQueue;
    const initialReorder = result.current.handleReorderQueue;
    const initialAdd = result.current.handleAddToQueue;

    // #when — re-render with identical references (mediaTracksRef identity is stable
    // even as its `.current` array contents mutate; this test guards against the
    // exhaustive-deps fix re-introducing callback churn).
    rerender(props);
    rerender(props);
    rerender(props);

    // #then
    expect(result.current.handleRemoveFromQueue).toBe(initialRemove);
    expect(result.current.handleReorderQueue).toBe(initialReorder);
    expect(result.current.handleAddToQueue).toBe(initialAdd);
  });

  describe('native-queue-sync notifications', () => {
    function makeDrivingDescriptor(opts: { hasNativeQueueSync: boolean }): {
      descriptor: { id: 'spotify'; capabilities: { hasNativeQueueSync: boolean }; playback: { onQueueChanged: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> } };
      onQueueChanged: ReturnType<typeof vi.fn>;
    } {
      const onQueueChanged = vi.fn();
      return {
        descriptor: {
          id: 'spotify',
          capabilities: { hasNativeQueueSync: opts.hasNativeQueueSync },
          playback: { onQueueChanged, pause: vi.fn() },
        },
        onQueueChanged,
      };
    }

    it('handleAddToQueue notifies the driving provider with the post-append tracks and unchanged index', async () => {
      // #given — non-empty queue, driving provider declares native-queue-sync
      mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2')];
      const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' })];
      const mockCatalog = { listTracks: vi.fn().mockResolvedValue([makeMediaTrack('3'), makeMediaTrack('4')]) };
      mockActiveDescriptor.catalog = mockCatalog;
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      mockGetDrivingProviderDescriptor.mockReturnValue(descriptor);

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      await act(async () => {
        await result.current.handleAddToQueue('playlist_id');
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks, notifiedIndex] = onQueueChanged.mock.calls[0];
      expect((notifiedTracks as MediaTrack[]).map((t) => t.id)).toEqual(['1', '2', '3', '4']);
      expect(notifiedIndex).toBe(0);
    });

    it('handleRemoveFromQueue notifies with the post-removal tracks and adjusted index', () => {
      // #given — currently playing index 2; remove index 0 → adjusted to 1
      mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2'), makeMediaTrack('3')];
      const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' }), makeTrack({ id: '3' })];
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      mockGetDrivingProviderDescriptor.mockReturnValue(descriptor);

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      act(() => {
        result.current.handleRemoveFromQueue(0);
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks, notifiedIndex] = onQueueChanged.mock.calls[0];
      expect((notifiedTracks as MediaTrack[]).map((t) => t.id)).toEqual(['2', '3']);
      expect(notifiedIndex).toBe(1);
    });

    it('handleReorderQueue notifies with the reordered tracks and the followed-current index', () => {
      // #given — playing index 0 ('a'); reorder 0→2 follows the playing track to index 2
      mediaTracksRef.current = [makeMediaTrack('a'), makeMediaTrack('b'), makeMediaTrack('c')];
      const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      mockGetDrivingProviderDescriptor.mockReturnValue(descriptor);

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      act(() => {
        result.current.handleReorderQueue(0, 2);
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks, notifiedIndex] = onQueueChanged.mock.calls[0];
      expect((notifiedTracks as MediaTrack[]).map((t) => t.id)).toEqual(['b', 'c', 'a']);
      expect(notifiedIndex).toBe(2);
    });

    it('insertTracksNext notifies with the spliced tracks and unchanged current index', () => {
      // #given — playing index 1 of 4; insert one track at index 2
      mediaTracksRef.current = [makeMediaTrack('a'), makeMediaTrack('b'), makeMediaTrack('c'), makeMediaTrack('d')];
      const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' }), makeTrack({ id: 'd' })];
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      mockGetDrivingProviderDescriptor.mockReturnValue(descriptor);

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      act(() => {
        result.current.insertTracksNext([makeMediaTrack('x')]);
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks, notifiedIndex] = onQueueChanged.mock.calls[0];
      expect((notifiedTracks as MediaTrack[]).map((t) => t.id)).toEqual(['a', 'b', 'x', 'c', 'd']);
      expect(notifiedIndex).toBe(1);
    });

    it('insertTracksNext notifies with index 0 when the queue starts empty', () => {
      // #given — empty queue; fall-through path treats inserted tracks as the new queue
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      mockGetDrivingProviderDescriptor.mockReturnValue(descriptor);

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      act(() => {
        result.current.insertTracksNext([makeMediaTrack('1'), makeMediaTrack('2')]);
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks, notifiedIndex] = onQueueChanged.mock.calls[0];
      expect((notifiedTracks as MediaTrack[]).map((t) => t.id)).toEqual(['1', '2']);
      expect(notifiedIndex).toBe(0);
    });

    it('queueTracksDirectly notifies with the post-append tracks and unchanged index', () => {
      // #given — non-empty queue, driving provider declares native-queue-sync
      mediaTracksRef.current = [makeMediaTrack('1')];
      const tracks = [makeTrack({ id: '1' })];
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      mockGetDrivingProviderDescriptor.mockReturnValue(descriptor);

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      act(() => {
        result.current.queueTracksDirectly([makeMediaTrack('2'), makeMediaTrack('3')]);
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks, notifiedIndex] = onQueueChanged.mock.calls[0];
      expect((notifiedTracks as MediaTrack[]).map((t) => t.id)).toEqual(['1', '2', '3']);
      expect(notifiedIndex).toBe(0);
    });

    it('insertCollectionNext notifies through insertTracksNext on the non-empty path', async () => {
      // #given
      mediaTracksRef.current = [makeMediaTrack('a'), makeMediaTrack('b')];
      const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
      const fetched = [makeMediaTrack('p1'), makeMediaTrack('p2')];
      const mockCatalog = { listTracks: vi.fn().mockResolvedValue(fetched) };
      mockActiveDescriptor.catalog = mockCatalog;
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      mockGetDrivingProviderDescriptor.mockReturnValue(descriptor);

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      await act(async () => {
        await result.current.insertCollectionNext('p1');
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks, notifiedIndex] = onQueueChanged.mock.calls[0];
      expect((notifiedTracks as MediaTrack[]).map((t) => t.id)).toEqual(['a', 'p1', 'p2', 'b']);
      expect(notifiedIndex).toBe(0);
    });

    it('does not notify when the driving provider lacks the native-queue-sync capability', () => {
      // #given — driving descriptor without the capability flag
      mediaTracksRef.current = [makeMediaTrack('a'), makeMediaTrack('b'), makeMediaTrack('c')];
      const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: false });
      mockGetDrivingProviderDescriptor.mockReturnValue(descriptor);

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      act(() => {
        result.current.handleReorderQueue(0, 2);
      });

      // #then
      expect(onQueueChanged).not.toHaveBeenCalled();
    });

    it('does not notify when a mutation bails before committing new state', () => {
      // #given — removing the currently playing index is a no-op
      mediaTracksRef.current = [makeMediaTrack('a'), makeMediaTrack('b'), makeMediaTrack('c')];
      const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      mockGetDrivingProviderDescriptor.mockReturnValue(descriptor);

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when — attempt to remove the playing track (bails)
      act(() => {
        result.current.handleRemoveFromQueue(1);
      });

      // #then
      expect(onQueueChanged).not.toHaveBeenCalled();
    });

    it('does not notify when insertTracksNext dedups to zero new tracks', () => {
      // #given — every incoming track is already in the queue
      mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2')];
      const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' })];
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      mockGetDrivingProviderDescriptor.mockReturnValue(descriptor);

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      act(() => {
        result.current.insertTracksNext([makeMediaTrack('1'), makeMediaTrack('2')]);
      });

      // #then
      expect(onQueueChanged).not.toHaveBeenCalled();
    });
  });

  describe('shuffle-safe originalTracks preservation', () => {
    it('handleAddToQueue while shuffled appends new tracks to originalTracks, not the shuffled snapshot', async () => {
      // #given — queue is shuffled [b, a]; originalTracks is [a, b] (the true order)
      mediaTracksRef.current = [makeMediaTrack('b'), makeMediaTrack('a')];
      const tracks = [makeTrack({ id: 'b' }), makeTrack({ id: 'a' })];
      const originalTracksState = [makeMediaTrack('a'), makeMediaTrack('b')];
      const mockCatalog = { listTracks: vi.fn().mockResolvedValue([makeMediaTrack('c')]) };
      mockActiveDescriptor.catalog = mockCatalog;

      let capturedOriginalTracks = originalTracksState;
      mockSetOriginalTracks.mockImplementation((updater: unknown) => {
        if (typeof updater === 'function') {
          capturedOriginalTracks = (updater as (prev: MediaTrack[]) => MediaTrack[])(capturedOriginalTracks);
        } else {
          capturedOriginalTracks = updater as MediaTrack[];
        }
      });

      const { result } = renderHook(() =>
        useQueueManagement({
          tracks,
          currentTrackIndex: 0,
          shuffleEnabled: true,
          trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
          loadCollection: mockHandlePlaylistSelect,
          handleBackToLibrary: mockHandleBackToLibrary,
          activeDescriptor: mockActiveDescriptor,
          getDescriptor: mockGetDescriptor,
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      await act(async () => {
        await result.current.handleAddToQueue('playlist_id');
      });

      // #then — originalTracks gets [a, b, c], not [b, a, c] (the shuffled snapshot)
      expect(capturedOriginalTracks.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    });

    it('handleAddToQueue while shuffle is OFF overwrites originalTracks with the full queue (existing behavior)', async () => {
      // #given
      mediaTracksRef.current = [makeMediaTrack('a'), makeMediaTrack('b')];
      const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
      const mockCatalog = { listTracks: vi.fn().mockResolvedValue([makeMediaTrack('c')]) };
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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      await act(async () => {
        await result.current.handleAddToQueue('playlist_id');
      });

      // #then — setOriginalTracks called with the full nextTracks array directly (not a functional updater)
      expect(mockSetOriginalTracks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'a' }),
          expect.objectContaining({ id: 'b' }),
          expect.objectContaining({ id: 'c' }),
        ]),
      );
      const callArg = mockSetOriginalTracks.mock.calls[0][0];
      expect(typeof callArg).not.toBe('function');
    });

    it('queueTracksDirectly while shuffled appends new tracks to originalTracks, not the shuffled snapshot', () => {
      // #given — queue is shuffled [b, a]; true originalTracks order is [a, b]
      mediaTracksRef.current = [makeMediaTrack('b'), makeMediaTrack('a')];
      const tracks = [makeTrack({ id: 'b' }), makeTrack({ id: 'a' })];
      const originalTracksState = [makeMediaTrack('a'), makeMediaTrack('b')];

      let capturedOriginalTracks = originalTracksState;
      mockSetOriginalTracks.mockImplementation((updater: unknown) => {
        if (typeof updater === 'function') {
          capturedOriginalTracks = (updater as (prev: MediaTrack[]) => MediaTrack[])(capturedOriginalTracks);
        } else {
          capturedOriginalTracks = updater as MediaTrack[];
        }
      });

      const { result } = renderHook(() =>
        useQueueManagement({
          tracks,
          currentTrackIndex: 0,
          shuffleEnabled: true,
          trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
          loadCollection: mockHandlePlaylistSelect,
          handleBackToLibrary: mockHandleBackToLibrary,
          activeDescriptor: mockActiveDescriptor,
          getDescriptor: mockGetDescriptor,
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      act(() => {
        result.current.queueTracksDirectly([makeMediaTrack('c')]);
      });

      // #then — originalTracks is [a, b, c], not the shuffled snapshot [b, a, c]
      expect(capturedOriginalTracks.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    });

    it('queueTracksDirectly while shuffle is OFF overwrites originalTracks with the full queue (existing behavior)', () => {
      // #given
      mediaTracksRef.current = [makeMediaTrack('a'), makeMediaTrack('b')];
      const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      act(() => {
        result.current.queueTracksDirectly([makeMediaTrack('c')]);
      });

      // #then — setOriginalTracks called with a plain array (not a functional updater)
      const callArg = mockSetOriginalTracks.mock.calls[0][0];
      expect(typeof callArg).not.toBe('function');
      expect((callArg as MediaTrack[]).map((t) => t.id)).toEqual(['a', 'b', 'c']);
    });

    it('insertTracksNext while shuffled appends new tracks to originalTracks, not the shuffled snapshot', () => {
      // #given — queue is shuffled [c, a, b]; true originalTracks order is [a, b, c]
      mediaTracksRef.current = [makeMediaTrack('c'), makeMediaTrack('a'), makeMediaTrack('b')];
      const tracks = [makeTrack({ id: 'c' }), makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
      const originalTracksState = [makeMediaTrack('a'), makeMediaTrack('b'), makeMediaTrack('c')];

      let capturedOriginalTracks = originalTracksState;
      mockSetOriginalTracks.mockImplementation((updater: unknown) => {
        if (typeof updater === 'function') {
          capturedOriginalTracks = (updater as (prev: MediaTrack[]) => MediaTrack[])(capturedOriginalTracks);
        } else {
          capturedOriginalTracks = updater as MediaTrack[];
        }
      });

      const { result } = renderHook(() =>
        useQueueManagement({
          tracks,
          currentTrackIndex: 0,
          shuffleEnabled: true,
          trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
          loadCollection: mockHandlePlaylistSelect,
          handleBackToLibrary: mockHandleBackToLibrary,
          activeDescriptor: mockActiveDescriptor,
          getDescriptor: mockGetDescriptor,
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      act(() => {
        result.current.insertTracksNext([makeMediaTrack('x')]);
      });

      // #then — originalTracks is [a, b, c, x], not the shuffled snapshot with x spliced in
      expect(capturedOriginalTracks.map((t) => t.id)).toEqual(['a', 'b', 'c', 'x']);
    });

    it('insertTracksNext while shuffle is OFF splices into originalTracks at currentTrackIndex+1 (existing behavior)', () => {
      // #given — playing index 0; original and queue order both [a, b, c]
      mediaTracksRef.current = [makeMediaTrack('a'), makeMediaTrack('b'), makeMediaTrack('c')];
      const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })];

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
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      act(() => {
        result.current.insertTracksNext([makeMediaTrack('x')]);
      });

      // #then — originalTracks is set to the full spliced array [a, x, b, c]
      const callArg = mockSetOriginalTracks.mock.calls[0][0];
      expect(typeof callArg).not.toBe('function');
      expect((callArg as MediaTrack[]).map((t) => t.id)).toEqual(['a', 'x', 'b', 'c']);
    });

    it('insertTracksNext with shuffle ON and empty queue sets originalTracks to the inserted batch', () => {
      // #given — empty queue with shuffle enabled (fast-path at the top of insertTracksNext)
      const { result } = renderHook(() =>
        useQueueManagement({
          tracks: [],
          currentTrackIndex: 0,
          shuffleEnabled: true,
          trackOps: { setTracks: mockSetTracks, setOriginalTracks: mockSetOriginalTracks, setCurrentTrackIndex: mockSetCurrentTrackIndex, mediaTracksRef },
          loadCollection: mockHandlePlaylistSelect,
          handleBackToLibrary: mockHandleBackToLibrary,
          activeDescriptor: mockActiveDescriptor,
          getDescriptor: mockGetDescriptor,
          getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
        })
      );

      // #when
      let response: ReturnType<typeof result.current.insertTracksNext> = null;
      act(() => {
        response = result.current.insertTracksNext([makeMediaTrack('1'), makeMediaTrack('2')], 'Fresh');
      });

      // #then — originalTracks receives the inserted batch directly (plain array, not functional updater)
      // because this is a fresh queue: there is no prior unshuffled order to merge with.
      expect(response).toEqual({ added: 2, collectionName: 'Fresh' });
      const callArg = mockSetOriginalTracks.mock.calls[0][0];
      expect(typeof callArg).not.toBe('function');
      expect((callArg as MediaTrack[]).map((t) => t.id)).toEqual(['1', '2']);
      expect(mockSetTracks).toHaveBeenCalledWith([
        expect.objectContaining({ id: '1' }),
        expect.objectContaining({ id: '2' }),
      ]);
    });
  });

  it('queueTracksDirectly toasts the duplicate message when every track is already queued', () => {
    // #given — queue already contains every incoming track
    mediaTracksRef.current = [makeMediaTrack('1'), makeMediaTrack('2')];
    const tracks = [makeTrack({ id: '1' }), makeTrack({ id: '2' })];

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
        getDrivingProviderDescriptor: mockGetDrivingProviderDescriptor,
      })
    );

    // #when
    let response: ReturnType<typeof result.current.queueTracksDirectly> = null;
    act(() => {
      response = result.current.queueTracksDirectly([makeMediaTrack('1'), makeMediaTrack('2')], 'Liked');
    });

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith('Already in your queue.', { id: 'qap-add-queue-dup' });
    expect(mockSetTracks).not.toHaveBeenCalled();
  });
});
