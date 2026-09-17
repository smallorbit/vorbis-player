import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { useQueueManagement } from '../useQueueManagement';
import { playbackStore } from '@/stores/playbackStore';
import { queueStore } from '@/stores/queueStore';
import { providerRegistry } from '@/providers/registry';
import { makeProviderDescriptor } from '@/test/fixtures';
import type { CollectionSelection, MediaTrack, ProviderId } from '@/types/domain';
import type { CatalogProvider, ProviderDescriptor } from '@/types/providers';

vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

// notifyQueueChanged resolves the driving descriptor through
// playbackStore.getDrivingDescriptor() → providerRegistry.get(<driving id>),
// so the registry is mocked to let native-sync tests wire a fake driving
// descriptor behind the store's resolver.
vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn(),
    getAll: vi.fn(() => []),
    has: vi.fn(() => false),
  },
}));

/** Spotify playlist selection, as produced by the library UI. */
function playlistSel(id: string, name?: string): CollectionSelection {
  return {
    type: 'collection',
    ref: { provider: 'spotify', kind: 'playlist', id },
    ...(name !== undefined && { name }),
  };
}

/** Dropbox folder selection (empty id = the All Music aggregate). */
function folderSel(id: string, name?: string): CollectionSelection {
  return {
    type: 'collection',
    ref: { provider: 'dropbox', kind: 'folder', id },
    ...(name !== undefined && { name }),
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
    genres: [],
  };
}

/** Build MediaTracks for a list of ids. */
const t = (...ids: string[]): MediaTrack[] => ids.map(makeMediaTrack);
const idsOf = (tracks: MediaTrack[]): string[] => tracks.map((track) => track.id);

describe('useQueueManagement', () => {
  let mockLoadCollection: ReturnType<typeof vi.fn>;
  let mockHandleBackToLibrary: ReturnType<typeof vi.fn>;
  let mockGetDescriptor: ReturnType<typeof vi.fn>;
  let mockActiveDescriptor: ProviderDescriptor;

  /** Descriptor for `providerId` whose catalog resolves `listTracks` with the given mock. */
  function makeDescriptorWithListTracks(
    providerId: ProviderId,
    listTracks: CatalogProvider['listTracks'],
  ): ProviderDescriptor {
    const base = makeProviderDescriptor({ id: providerId });
    return { ...base, catalog: { ...base.catalog, providerId, listTracks } };
  }

  /** Point the active descriptor's catalog at a stubbed listTracks. */
  function stubActiveListTracks(listTracks: CatalogProvider['listTracks']): void {
    mockActiveDescriptor = {
      ...mockActiveDescriptor,
      catalog: { ...mockActiveDescriptor.catalog, listTracks },
    };
  }

  /** Render the hook with the default mock props; individual fields can be overridden. */
  function renderQueueManagement(overrides: Partial<Parameters<typeof useQueueManagement>[0]> = {}) {
    return renderHook(() =>
      useQueueManagement({
        loadCollection: mockLoadCollection,
        handleBackToLibrary: mockHandleBackToLibrary,
        activeDescriptor: mockActiveDescriptor,
        getDescriptor: mockGetDescriptor,
        ...overrides,
      })
    );
  }

  beforeEach(() => {
    // Queue state lives in the module-level queueStore; src/test/setup.ts resets
    // it before every test, and each test seeds it via queueStore.replaceQueue.
    mockLoadCollection = vi.fn();
    mockHandleBackToLibrary = vi.fn();
    mockActiveDescriptor = makeProviderDescriptor();
    // Selections always carry an explicit provider now, so resolve the active
    // descriptor by id unless the test overrides the implementation.
    mockGetDescriptor = vi.fn((providerId: ProviderId) =>
      providerId === mockActiveDescriptor.id ? mockActiveDescriptor : undefined
    );
    // Default: no driving provider (src/test/setup.ts resets playbackStore, so
    // drivingProviderId starts null and notify is a no-op). Tests covering
    // native-sync wire a driving descriptor via setDrivingDescriptor.
    vi.mocked(toast).mockClear();
  });

  it('handleRemoveFromQueue does nothing when index equals currentTrackIndex', () => {
    // #given — playing index 1
    queueStore.replaceQueue(t('1', '2', '3'), { currentIndex: 1 });
    const before = queueStore.getSnapshot();
    const { result } = renderQueueManagement();

    // #when
    act(() => {
      result.current.handleRemoveFromQueue(1);
    });

    // #then — the store is untouched when trying to remove the current track
    expect(queueStore.getSnapshot()).toBe(before);
    expect(mockHandleBackToLibrary).not.toHaveBeenCalled();
  });

  it('handleRemoveFromQueue adjusts currentTrackIndex when removing a track before the current one', () => {
    // #given — playing index 2
    queueStore.replaceQueue(t('1', '2', '3'), { currentIndex: 2 });
    const { result } = renderQueueManagement();

    // #when
    act(() => {
      result.current.handleRemoveFromQueue(0);
    });

    // #then — currentIndex decrements by 1 to keep following the playing track
    expect(queueStore.getCurrentIndex()).toBe(1);
    // the track at index 0 is removed from the queue
    expect(idsOf(queueStore.getTracks())).toEqual(['2', '3']);
    // and originalTracks drops it too (shuffle off: it mirrors the play order)
    expect(idsOf(queueStore.getSnapshot().originalTracks)).toEqual(['2', '3']);
  });

  it('handleReorderQueue updates currentTrackIndex to follow the playing track', () => {
    // #given — playing index 0 ('1')
    queueStore.replaceQueue(t('1', '2', '3'), { currentIndex: 0 });
    const { result } = renderQueueManagement();

    // #when
    act(() => {
      result.current.handleReorderQueue(0, 2);
    });

    // #then — the playing track moved to index 2 and currentIndex followed it
    expect(queueStore.getCurrentIndex()).toBe(2);
    expect(idsOf(queueStore.getTracks())).toEqual(['2', '3', '1']);
  });

  it('handleAddToQueue delegates to loadCollection when queue is empty', async () => {
    // #given — pristine (empty) queue
    mockLoadCollection.mockResolvedValue({ status: 'loaded', count: 3 });
    const { result } = renderQueueManagement();

    // #when
    const response = await act(async () => {
      return result.current.handleAddToQueue(playlistSel('playlist_id', 'My Playlist'));
    });

    // #then
    expect(mockLoadCollection).toHaveBeenCalledWith(playlistSel('playlist_id', 'My Playlist'));
    expect(response).toEqual({ added: 3, collectionName: 'My Playlist' });
  });

  it('handleAddToQueue shuffles Dropbox All Music tracks before appending', async () => {
    // #given — existing queue + All Music ref ('' id, dropbox folder) returning a large ordered list
    queueStore.replaceQueue(t('a', 'b'));
    const incoming = Array.from({ length: 20 }, (_, i) => makeMediaTrack(`n${i + 1}`));
    const dropboxDescriptor = makeDescriptorWithListTracks('dropbox', vi.fn().mockResolvedValue(incoming));
    mockGetDescriptor.mockReturnValue(dropboxDescriptor);
    const { result } = renderQueueManagement({ activeDescriptor: dropboxDescriptor });

    // #when — the All Music selection (dropbox/folder/'')
    await act(async () => {
      await result.current.handleAddToQueue(folderSel(''));
    });

    // #then — the store holds a shuffled permutation of the incoming tracks appended to the existing queue
    const appended = queueStore.getTracks();
    expect(appended).toHaveLength(22);
    expect(idsOf(appended.slice(0, 2))).toEqual(['a', 'b']);
    const appendedIds = idsOf(appended.slice(2));
    expect(appendedIds.slice().sort()).toEqual(idsOf(incoming).slice().sort());
    const orderPreserved = appendedIds.every((id, i) => id === incoming[i]?.id);
    expect(orderPreserved).toBe(false);
  });

  it('handleAddToQueue preserves catalog order when appending a non-All-Music Dropbox folder', async () => {
    // #given — regression guard for shuffle-by-default semantics
    queueStore.replaceQueue(t('a'));
    const incoming = Array.from({ length: 20 }, (_, i) => makeMediaTrack(`n${i + 1}`));
    const dropboxDescriptor = makeDescriptorWithListTracks('dropbox', vi.fn().mockResolvedValue(incoming));
    mockGetDescriptor.mockReturnValue(dropboxDescriptor);
    const { result } = renderQueueManagement({ activeDescriptor: dropboxDescriptor });

    // #when — non-empty folder id (not All Music)
    await act(async () => {
      await result.current.handleAddToQueue(folderSel('/Music/Artist/Album'));
    });

    // #then — appended portion preserves incoming order
    expect(idsOf(queueStore.getTracks().slice(1))).toEqual(idsOf(incoming));
  });

  it('handleAddToQueue appends tracks to an existing queue without resetting currentTrackIndex', async () => {
    // #given
    queueStore.replaceQueue(t('1', '2'), { currentIndex: 0 });
    stubActiveListTracks(vi.fn().mockResolvedValue(t('3', '4')));
    const { result } = renderQueueManagement();

    // #when
    const response = await act(async () => {
      return result.current.handleAddToQueue(playlistSel('playlist_id'));
    });

    // #then — fetched tracks are appended to the end of the queue
    expect(idsOf(queueStore.getTracks())).toEqual(['1', '2', '3', '4']);
    // originalTracks mirrors the full queue (shuffle off)
    expect(idsOf(queueStore.getSnapshot().originalTracks)).toEqual(['1', '2', '3', '4']);
    expect(response).toEqual({ added: 2 });
    // the playing index is untouched
    expect(queueStore.getCurrentIndex()).toBe(0);
  });

  it('handleAddToQueue toasts the empty-collection message when loadCollection reports empty', async () => {
    // #given — empty queue, descriptor present, but loadCollection yields nothing
    mockLoadCollection.mockResolvedValue({ status: 'empty' });
    const { result } = renderQueueManagement();

    // #when
    const response = await act(async () => result.current.handleAddToQueue(playlistSel('empty_playlist')));

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith('This collection is empty.', { id: 'qap-add-queue-empty' });
  });

  it('handleAddToQueue surfaces nothing when loadCollection was superseded by a newer load', async () => {
    // #given — empty queue; the delegated load loses to a newer one mid-flight.
    // Historically this returned the internal generation counter, producing a
    // bogus "Added N tracks" toast (F30).
    mockLoadCollection.mockResolvedValue({ status: 'superseded' });
    const { result } = renderQueueManagement();

    // #when
    const response = await act(async () => result.current.handleAddToQueue(playlistSel('playlist_id')));

    // #then — no added-count result and no toast of any kind
    expect(response).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });

  it('handleAddToQueue toasts the failure message when no descriptor resolves', async () => {
    // #given — non-empty queue but no active descriptor and no resolvable provider
    queueStore.replaceQueue(t('a'));
    const before = queueStore.getSnapshot();
    mockGetDescriptor.mockReturnValue(undefined);
    const { result } = renderQueueManagement({ activeDescriptor: undefined });

    // #when
    const response = await act(async () => result.current.handleAddToQueue(playlistSel('playlist_id')));

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith("Couldn't add to queue. Try again.", { id: 'qap-add-queue-error' });
    // the queue is untouched
    expect(queueStore.getSnapshot()).toBe(before);
  });

  it('handleAddToQueue toasts the duplicate message when every fetched track is already queued', async () => {
    // #given — queue already contains every track listTracks will return
    queueStore.replaceQueue(t('1', '2'));
    const before = queueStore.getSnapshot();
    stubActiveListTracks(vi.fn().mockResolvedValue(t('1', '2')));
    const { result } = renderQueueManagement();

    // #when
    const response = await act(async () => result.current.handleAddToQueue(playlistSel('playlist_id')));

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith('Already in your queue.', { id: 'qap-add-queue-dup' });
    // the queue is untouched
    expect(queueStore.getSnapshot()).toBe(before);
  });

  it('handleAddToQueue toasts the failure message when listTracks throws', async () => {
    // #given — non-empty queue, descriptor whose catalog rejects
    queueStore.replaceQueue(t('1'));
    stubActiveListTracks(vi.fn().mockRejectedValue(new Error('boom')));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderQueueManagement();

    // #when
    const response = await act(async () => result.current.handleAddToQueue(playlistSel('playlist_id')));

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith("Couldn't add to queue. Try again.", { id: 'qap-add-queue-error' });
    errorSpy.mockRestore();
  });

  it('insertTracksNext inserts a single track at currentTrackIndex + 1', () => {
    // #given — queue of 4 tracks, currently playing index 1
    queueStore.replaceQueue(t('a', 'b', 'c', 'd'), { currentIndex: 1 });
    const { result } = renderQueueManagement();

    // #when
    let response: ReturnType<typeof result.current.insertTracksNext> = null;
    act(() => {
      response = result.current.insertTracksNext([makeMediaTrack('x')], 'X');
    });

    // #then — the track lands right after the playing track
    expect(response).toEqual({ added: 1, collectionName: 'X' });
    expect(idsOf(queueStore.getTracks())).toEqual(['a', 'b', 'x', 'c', 'd']);
    expect(queueStore.getCurrentIndex()).toBe(1);
  });

  it('insertTracksNext appends when queue is empty (no current track to insert after)', () => {
    // #given — empty queue
    const { result } = renderQueueManagement();

    // #when
    let response: ReturnType<typeof result.current.insertTracksNext> = null;
    act(() => {
      response = result.current.insertTracksNext(t('1', '2'));
    });

    // #then — the inserted tracks become the whole queue
    expect(response).toEqual({ added: 2 });
    expect(idsOf(queueStore.getTracks())).toEqual(['1', '2']);
    expect(queueStore.getCurrentIndex()).toBe(0);
  });

  it('insertTracksNext returns null and toasts when every track is already queued', () => {
    // #given
    queueStore.replaceQueue(t('1', '2'));
    const before = queueStore.getSnapshot();
    const { result } = renderQueueManagement();

    // #when
    let response: ReturnType<typeof result.current.insertTracksNext> = null;
    act(() => {
      response = result.current.insertTracksNext(t('1', '2'));
    });

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith('Already in your queue.', { id: 'qap-add-queue-dup' });
    // the queue is untouched
    expect(queueStore.getSnapshot()).toBe(before);
  });

  it('insertTracksNext dedups against existing queue and inserts only the unique tracks', () => {
    // #given — '1' is already queued, 'x' and 'y' are new
    queueStore.replaceQueue(t('1', '2'), { currentIndex: 0 });
    const { result } = renderQueueManagement();

    // #when — mix of duplicate '1' with new 'x' and 'y'
    let response: ReturnType<typeof result.current.insertTracksNext> = null;
    act(() => {
      response = result.current.insertTracksNext(t('1', 'x', 'y'));
    });

    // #then — only x and y are inserted, currentIndex preserved
    expect(response).toEqual({ added: 2 });
    expect(idsOf(queueStore.getTracks())).toEqual(['1', 'x', 'y', '2']);
    expect(queueStore.getCurrentIndex()).toBe(0);
  });

  it('insertCollectionNext delegates to loadCollection when queue is empty', async () => {
    // #given
    mockLoadCollection.mockResolvedValue({ status: 'loaded', count: 5 });
    const { result } = renderQueueManagement();

    // #when
    const response = await act(async () =>
      result.current.insertCollectionNext(playlistSel('playlist_id', 'My Playlist')),
    );

    // #then
    expect(mockLoadCollection).toHaveBeenCalledWith(playlistSel('playlist_id', 'My Playlist'));
    expect(response).toEqual({ added: 5, collectionName: 'My Playlist' });
  });

  it('insertCollectionNext fetches via catalog and inserts at currentTrackIndex + 1 when queue is non-empty', async () => {
    // #given
    queueStore.replaceQueue(t('a', 'b'), { currentIndex: 0 });
    const listTracks = vi.fn().mockResolvedValue(t('p1', 'p2', 'p3'));
    stubActiveListTracks(listTracks);
    const { result } = renderQueueManagement();

    // #when
    const response = await act(async () =>
      result.current.insertCollectionNext(playlistSel('playlist_id', 'P')),
    );

    // #then — 3 tracks inserted at index 1 (currentTrackIndex + 1)
    expect(response).toEqual({ added: 3, collectionName: 'P' });
    expect(listTracks).toHaveBeenCalled();
    expect(idsOf(queueStore.getTracks())).toEqual(['a', 'p1', 'p2', 'p3', 'b']);
    expect(queueStore.getCurrentIndex()).toBe(0);
  });

  it('insertCollectionNext toasts the failure message when listTracks throws', async () => {
    // #given
    queueStore.replaceQueue(t('a'));
    stubActiveListTracks(vi.fn().mockRejectedValue(new Error('boom')));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderQueueManagement();

    // #when
    const response = await act(async () => result.current.insertCollectionNext(playlistSel('p1')));

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith("Couldn't add to queue. Try again.", { id: 'qap-add-queue-error' });
    errorSpy.mockRestore();
  });

  it('keeps callback identities stable across re-renders when inputs are unchanged', () => {
    // #given — identical input references on every render
    queueStore.replaceQueue(t('1', '2', '3'));

    const props = {
      loadCollection: mockLoadCollection,
      handleBackToLibrary: mockHandleBackToLibrary,
      activeDescriptor: mockActiveDescriptor,
      getDescriptor: mockGetDescriptor,
    };

    const { result, rerender } = renderHook((p: typeof props) => useQueueManagement(p), {
      initialProps: props,
    });

    const initialRemove = result.current.handleRemoveFromQueue;
    const initialReorder = result.current.handleReorderQueue;
    const initialAdd = result.current.handleAddToQueue;

    // #when — re-render with identical references (queue state lives in the
    // module-level store, so no per-render queue props can churn the callbacks;
    // this test guards against re-introducing identity churn via new deps).
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
      descriptor: ProviderDescriptor;
      onQueueChanged: Mock<(tracks: MediaTrack[], fromIndex: number) => void>;
    } {
      const onQueueChanged = vi.fn<(tracks: MediaTrack[], fromIndex: number) => void>();
      const base = makeProviderDescriptor();
      return {
        descriptor: {
          ...base,
          capabilities: { ...base.capabilities, hasNativeQueueSync: opts.hasNativeQueueSync },
          playback: { ...base.playback, onQueueChanged },
        },
        onQueueChanged,
      };
    }

    /**
     * Make `descriptor` the driving provider: the playback store resolves the
     * driving id, and the mocked registry serves the descriptor for that id.
     */
    function setDrivingDescriptor(descriptor: ProviderDescriptor): void {
      vi.mocked(providerRegistry.get).mockImplementation((providerId: ProviderId) =>
        providerId === descriptor.id ? descriptor : undefined
      );
      playbackStore.setDrivingProvider(descriptor.id);
    }

    it('handleAddToQueue notifies the driving provider with the post-append tracks and unchanged index', async () => {
      // #given — non-empty queue, driving provider declares native-queue-sync
      queueStore.replaceQueue(t('1', '2'), { currentIndex: 0 });
      stubActiveListTracks(vi.fn().mockResolvedValue(t('3', '4')));
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      setDrivingDescriptor(descriptor);
      const { result } = renderQueueManagement();

      // #when
      await act(async () => {
        await result.current.handleAddToQueue(playlistSel('playlist_id'));
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks = [], notifiedIndex] = onQueueChanged.mock.calls[0] ?? [];
      expect(idsOf(notifiedTracks)).toEqual(['1', '2', '3', '4']);
      expect(notifiedIndex).toBe(0);
    });

    it('handleRemoveFromQueue notifies with the post-removal tracks and adjusted index', () => {
      // #given — currently playing index 2; remove index 0 → adjusted to 1
      queueStore.replaceQueue(t('1', '2', '3'), { currentIndex: 2 });
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      setDrivingDescriptor(descriptor);
      const { result } = renderQueueManagement();

      // #when
      act(() => {
        result.current.handleRemoveFromQueue(0);
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks = [], notifiedIndex] = onQueueChanged.mock.calls[0] ?? [];
      expect(idsOf(notifiedTracks)).toEqual(['2', '3']);
      expect(notifiedIndex).toBe(1);
    });

    it('handleReorderQueue notifies with the reordered tracks and the followed-current index', () => {
      // #given — playing index 0 ('a'); reorder 0→2 follows the playing track to index 2
      queueStore.replaceQueue(t('a', 'b', 'c'), { currentIndex: 0 });
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      setDrivingDescriptor(descriptor);
      const { result } = renderQueueManagement();

      // #when
      act(() => {
        result.current.handleReorderQueue(0, 2);
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks = [], notifiedIndex] = onQueueChanged.mock.calls[0] ?? [];
      expect(idsOf(notifiedTracks)).toEqual(['b', 'c', 'a']);
      expect(notifiedIndex).toBe(2);
    });

    it('insertTracksNext notifies with the spliced tracks and unchanged current index', () => {
      // #given — playing index 1 of 4; insert one track at index 2
      queueStore.replaceQueue(t('a', 'b', 'c', 'd'), { currentIndex: 1 });
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      setDrivingDescriptor(descriptor);
      const { result } = renderQueueManagement();

      // #when
      act(() => {
        result.current.insertTracksNext([makeMediaTrack('x')]);
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks = [], notifiedIndex] = onQueueChanged.mock.calls[0] ?? [];
      expect(idsOf(notifiedTracks)).toEqual(['a', 'b', 'x', 'c', 'd']);
      expect(notifiedIndex).toBe(1);
    });

    it('insertTracksNext notifies with index 0 when the queue starts empty', () => {
      // #given — empty queue; the store treats inserted tracks as the new queue
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      setDrivingDescriptor(descriptor);
      const { result } = renderQueueManagement();

      // #when
      act(() => {
        result.current.insertTracksNext(t('1', '2'));
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks = [], notifiedIndex] = onQueueChanged.mock.calls[0] ?? [];
      expect(idsOf(notifiedTracks)).toEqual(['1', '2']);
      expect(notifiedIndex).toBe(0);
    });

    it('queueTracksDirectly notifies with the post-append tracks and unchanged index', () => {
      // #given — non-empty queue, driving provider declares native-queue-sync
      queueStore.replaceQueue(t('1'), { currentIndex: 0 });
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      setDrivingDescriptor(descriptor);
      const { result } = renderQueueManagement();

      // #when
      act(() => {
        result.current.queueTracksDirectly(t('2', '3'));
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks = [], notifiedIndex] = onQueueChanged.mock.calls[0] ?? [];
      expect(idsOf(notifiedTracks)).toEqual(['1', '2', '3']);
      expect(notifiedIndex).toBe(0);
    });

    it('insertCollectionNext notifies through insertTracksNext on the non-empty path', async () => {
      // #given
      queueStore.replaceQueue(t('a', 'b'), { currentIndex: 0 });
      stubActiveListTracks(vi.fn().mockResolvedValue(t('p1', 'p2')));
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      setDrivingDescriptor(descriptor);
      const { result } = renderQueueManagement();

      // #when
      await act(async () => {
        await result.current.insertCollectionNext(playlistSel('p1'));
      });

      // #then
      expect(onQueueChanged).toHaveBeenCalledTimes(1);
      const [notifiedTracks = [], notifiedIndex] = onQueueChanged.mock.calls[0] ?? [];
      expect(idsOf(notifiedTracks)).toEqual(['a', 'p1', 'p2', 'b']);
      expect(notifiedIndex).toBe(0);
    });

    it('does not notify when the driving provider lacks the native-queue-sync capability', () => {
      // #given — driving descriptor without the capability flag
      queueStore.replaceQueue(t('a', 'b', 'c'), { currentIndex: 0 });
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: false });
      setDrivingDescriptor(descriptor);
      const { result } = renderQueueManagement();

      // #when
      act(() => {
        result.current.handleReorderQueue(0, 2);
      });

      // #then
      expect(onQueueChanged).not.toHaveBeenCalled();
    });

    it('does not notify when a mutation bails before committing new state', () => {
      // #given — removing the currently playing index is a no-op
      queueStore.replaceQueue(t('a', 'b', 'c'), { currentIndex: 1 });
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      setDrivingDescriptor(descriptor);
      const { result } = renderQueueManagement();

      // #when — attempt to remove the playing track (bails)
      act(() => {
        result.current.handleRemoveFromQueue(1);
      });

      // #then
      expect(onQueueChanged).not.toHaveBeenCalled();
    });

    it('does not notify when insertTracksNext dedups to zero new tracks', () => {
      // #given — every incoming track is already in the queue
      queueStore.replaceQueue(t('1', '2'), { currentIndex: 0 });
      const { descriptor, onQueueChanged } = makeDrivingDescriptor({ hasNativeQueueSync: true });
      setDrivingDescriptor(descriptor);
      const { result } = renderQueueManagement();

      // #when
      act(() => {
        result.current.insertTracksNext(t('1', '2'));
      });

      // #then
      expect(onQueueChanged).not.toHaveBeenCalled();
    });
  });

  describe('shuffle-safe originalTracks preservation', () => {
    it('handleAddToQueue while shuffled appends new tracks to originalTracks, not the shuffled snapshot', async () => {
      // #given — queue is shuffled [b, a]; originalTracks is [a, b] (the true order)
      queueStore.replaceQueue(t('b', 'a'), { currentIndex: 0, originalTracks: t('a', 'b') });
      queueStore.__setShuffleForTests(true);
      stubActiveListTracks(vi.fn().mockResolvedValue(t('c')));
      const { result } = renderQueueManagement();

      // #when
      await act(async () => {
        await result.current.handleAddToQueue(playlistSel('playlist_id'));
      });

      // #then — originalTracks gets [a, b, c], not [b, a, c] (the shuffled snapshot)
      expect(idsOf(queueStore.getSnapshot().originalTracks)).toEqual(['a', 'b', 'c']);
      // and the play order got the append at the end
      expect(idsOf(queueStore.getTracks())).toEqual(['b', 'a', 'c']);
    });

    it('handleAddToQueue while shuffle is OFF overwrites originalTracks with the full queue (existing behavior)', async () => {
      // #given
      queueStore.replaceQueue(t('a', 'b'), { currentIndex: 0 });
      stubActiveListTracks(vi.fn().mockResolvedValue(t('c')));
      const { result } = renderQueueManagement();

      // #when
      await act(async () => {
        await result.current.handleAddToQueue(playlistSel('playlist_id'));
      });

      // #then — originalTracks mirrors the full post-append play order
      const snap = queueStore.getSnapshot();
      expect(idsOf(snap.originalTracks)).toEqual(['a', 'b', 'c']);
      expect(idsOf(snap.originalTracks)).toEqual(idsOf(snap.tracks));
    });

    it('queueTracksDirectly while shuffled appends new tracks to originalTracks, not the shuffled snapshot', () => {
      // #given — queue is shuffled [b, a]; true originalTracks order is [a, b]
      queueStore.replaceQueue(t('b', 'a'), { currentIndex: 0, originalTracks: t('a', 'b') });
      queueStore.__setShuffleForTests(true);
      const { result } = renderQueueManagement();

      // #when
      act(() => {
        result.current.queueTracksDirectly(t('c'));
      });

      // #then — originalTracks is [a, b, c], not the shuffled snapshot [b, a, c]
      expect(idsOf(queueStore.getSnapshot().originalTracks)).toEqual(['a', 'b', 'c']);
    });

    it('queueTracksDirectly while shuffle is OFF overwrites originalTracks with the full queue (existing behavior)', () => {
      // #given
      queueStore.replaceQueue(t('a', 'b'), { currentIndex: 0 });
      const { result } = renderQueueManagement();

      // #when
      act(() => {
        result.current.queueTracksDirectly(t('c'));
      });

      // #then — originalTracks mirrors the full post-append play order
      const snap = queueStore.getSnapshot();
      expect(idsOf(snap.originalTracks)).toEqual(['a', 'b', 'c']);
      expect(idsOf(snap.originalTracks)).toEqual(idsOf(snap.tracks));
    });

    it('insertTracksNext while shuffled appends new tracks to originalTracks, not the shuffled snapshot', () => {
      // #given — queue is shuffled [c, a, b]; true originalTracks order is [a, b, c]
      queueStore.replaceQueue(t('c', 'a', 'b'), { currentIndex: 0, originalTracks: t('a', 'b', 'c') });
      queueStore.__setShuffleForTests(true);
      const { result } = renderQueueManagement();

      // #when
      act(() => {
        result.current.insertTracksNext([makeMediaTrack('x')]);
      });

      // #then — originalTracks is [a, b, c, x], not the shuffled snapshot with x spliced in
      expect(idsOf(queueStore.getSnapshot().originalTracks)).toEqual(['a', 'b', 'c', 'x']);
      // while the play order got the splice at currentTrackIndex + 1
      expect(idsOf(queueStore.getTracks())).toEqual(['c', 'x', 'a', 'b']);
    });

    it('insertTracksNext while shuffle is OFF splices into originalTracks at currentTrackIndex+1 (existing behavior)', () => {
      // #given — playing index 0; original and queue order both [a, b, c]
      queueStore.replaceQueue(t('a', 'b', 'c'), { currentIndex: 0 });
      const { result } = renderQueueManagement();

      // #when
      act(() => {
        result.current.insertTracksNext([makeMediaTrack('x')]);
      });

      // #then — originalTracks holds the full spliced order [a, x, b, c]
      expect(idsOf(queueStore.getSnapshot().originalTracks)).toEqual(['a', 'x', 'b', 'c']);
    });

    it('insertTracksNext with shuffle ON and empty queue sets originalTracks to the inserted batch', () => {
      // #given — empty queue with shuffle enabled (empty-queue fast path in the store)
      queueStore.__setShuffleForTests(true);
      const { result } = renderQueueManagement();

      // #when
      let response: ReturnType<typeof result.current.insertTracksNext> = null;
      act(() => {
        response = result.current.insertTracksNext(t('1', '2'), 'Fresh');
      });

      // #then — originalTracks receives the inserted batch verbatim because this
      // is a fresh queue: there is no prior unshuffled order to merge with.
      expect(response).toEqual({ added: 2, collectionName: 'Fresh' });
      expect(idsOf(queueStore.getSnapshot().originalTracks)).toEqual(['1', '2']);
      expect(idsOf(queueStore.getTracks())).toEqual(['1', '2']);
    });
  });

  it('queueTracksDirectly toasts the duplicate message when every track is already queued', () => {
    // #given — queue already contains every incoming track
    queueStore.replaceQueue(t('1', '2'));
    const before = queueStore.getSnapshot();
    const { result } = renderQueueManagement();

    // #when
    let response: ReturnType<typeof result.current.queueTracksDirectly> = null;
    act(() => {
      response = result.current.queueTracksDirectly(t('1', '2'), 'Liked');
    });

    // #then
    expect(response).toBeNull();
    expect(toast).toHaveBeenCalledWith('Already in your queue.', { id: 'qap-add-queue-dup' });
    // the queue is untouched
    expect(queueStore.getSnapshot()).toBe(before);
  });
});
