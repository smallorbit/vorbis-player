import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ContextMenuRequest } from '../../types';
import type { ProviderId } from '@/types/domain';

const { mockPinned, mockLikedSection, mockRecent, mockLoadLiked } = vi.hoisted(() => ({
  mockPinned: vi.fn(),
  mockLikedSection: vi.fn(),
  mockRecent: vi.fn(),
  mockLoadLiked: vi.fn(),
}));

vi.mock('@/hooks/usePinnedItems', () => ({
  usePinnedItems: () => mockPinned(),
}));

vi.mock('@/hooks/useRecentlyPlayedCollections', () => ({
  useRecentlyPlayedCollections: () => mockRecent(),
}));

vi.mock('../../hooks', () => ({
  useLikedSection: () => mockLikedSection(),
}));

vi.mock('../useLikedTracksForProvider', () => ({
  useLikedTracksForProvider: () => ({ loadLikedTracks: mockLoadLiked }),
}));

const { mockQueueLikedFromCollection, mockUseAlbumSavedStatus } = vi.hoisted(() => ({
  mockQueueLikedFromCollection: vi.fn(),
  mockUseAlbumSavedStatus: vi.fn(),
}));

vi.mock('../useQueueLikedFromCollection', () => ({
  useQueueLikedFromCollection: () => ({ queueLikedFromCollection: mockQueueLikedFromCollection }),
}));

vi.mock('../useAlbumSavedStatus', () => ({
  useAlbumSavedStatus: (...args: unknown[]) => mockUseAlbumSavedStatus(...args),
}));

import { useMenuItems, type UseMenuItemsCallbacks } from '../useMenuItems';

function makeRequest(overrides: Partial<ContextMenuRequest> = {}): ContextMenuRequest {
  return {
    kind: 'playlist',
    id: 'p1',
    name: 'My Playlist',
    provider: 'spotify' as ProviderId,
    anchorRect: new DOMRect(10, 10, 100, 40),
    ...overrides,
  };
}

function makeCallbacks(overrides: Partial<UseMenuItemsCallbacks> = {}): UseMenuItemsCallbacks {
  return {
    closeAfter: (_label, fn) => () => {
      void fn();
    },
    onPlayCollection: vi.fn(),
    onAddToQueue: vi.fn(),
    onPlayLikedTracks: vi.fn(),
    ...overrides,
  };
}

function defaultMocks() {
  mockPinned.mockReturnValue({
    isPlaylistPinned: () => false,
    isAlbumPinned: () => false,
    togglePinPlaylist: vi.fn(),
    togglePinAlbum: vi.fn(),
  });
  mockLikedSection.mockReturnValue({
    perProvider: [{ provider: 'spotify' as ProviderId, count: 10 }],
  });
  mockRecent.mockReturnValue({ remove: vi.fn() });
  mockLoadLiked.mockResolvedValue([]);
  mockUseAlbumSavedStatus.mockReturnValue({
    isSaved: null,
    toggleSaved: vi.fn(),
    canToggle: false,
    saveError: null,
    clearSaveError: vi.fn(),
  });
}

describe('useMenuItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  it('returns an empty array when request is null', () => {
    // #when
    const { result } = renderHook(() => useMenuItems(null, makeCallbacks()));

    // #then
    expect(result.current).toEqual([]);
  });

  it('returns the playlist schema with 5 items', () => {
    // #when
    const { result } = renderHook(() =>
      useMenuItems(makeRequest({ kind: 'playlist' }), makeCallbacks()),
    );

    // #then
    expect(result.current.map((i) => i.id)).toEqual([
      'play',
      'add-to-queue',
      'play-next',
      'toggle-pin',
      'start-radio',
    ]);
  });

  it('disables Play Next and Start Radio when handlers are undefined', () => {
    // #when
    const { result } = renderHook(() =>
      useMenuItems(
        makeRequest({ kind: 'playlist' }),
        makeCallbacks({ onPlayNext: undefined, onStartRadioForCollection: undefined }),
      ),
    );

    // #then
    const playNext = result.current.find((i) => i.id === 'play-next');
    const startRadio = result.current.find((i) => i.id === 'start-radio');
    expect(playNext?.disabled).toBe(true);
    expect(startRadio?.disabled).toBe(true);
  });

  it('labels toggle-pin as "Pin" when not pinned', () => {
    // #given - default mock has isPlaylistPinned = () => false

    // #when
    const { result } = renderHook(() =>
      useMenuItems(makeRequest({ kind: 'playlist' }), makeCallbacks()),
    );

    // #then
    const togglePin = result.current.find((i) => i.id === 'toggle-pin');
    expect(togglePin?.label).toBe('Pin');
  });

  it('labels toggle-pin as "Unpin" when playlist is pinned', () => {
    // #given
    mockPinned.mockReturnValue({
      isPlaylistPinned: () => true,
      isAlbumPinned: () => false,
      togglePinPlaylist: vi.fn(),
      togglePinAlbum: vi.fn(),
    });

    // #when
    const { result } = renderHook(() =>
      useMenuItems(makeRequest({ kind: 'playlist' }), makeCallbacks()),
    );

    // #then
    const togglePin = result.current.find((i) => i.id === 'toggle-pin');
    expect(togglePin?.label).toBe('Unpin');
  });

  it('builds per-provider liked entries from useLikedSection', () => {
    // #given
    mockLikedSection.mockReturnValue({
      perProvider: [
        { provider: 'spotify', count: 10 },
        { provider: 'dropbox', count: 5 },
      ],
    });

    // #when
    const { result } = renderHook(() =>
      useMenuItems(
        makeRequest({ kind: 'liked', id: 'liked', provider: undefined }),
        makeCallbacks(),
      ),
    );

    // #then
    const ids = result.current.map((i) => i.id);
    expect(ids).toContain('play-all');
    expect(ids).toContain('play-liked-spotify');
    expect(ids).toContain('play-liked-dropbox');
  });

  it('appends Remove from history for recently-played requests with recentRef', () => {
    // #when
    const { result } = renderHook(() =>
      useMenuItems(
        makeRequest({
          kind: 'recently-played',
          originalKind: 'playlist',
          recentRef: { kind: 'playlist', id: 'p1', provider: 'spotify' },
        }),
        makeCallbacks(),
      ),
    );

    // #then
    const ids = result.current.map((i) => i.id);
    expect(ids).toContain('remove-from-history');
  });

  it('omits queue-liked when onQueueLikedTracks is not provided', () => {
    // #when
    const { result } = renderHook(() =>
      useMenuItems(makeRequest({ kind: 'playlist' }), makeCallbacks()),
    );

    // #then
    const ids = result.current.map((i) => i.id);
    expect(ids).not.toContain('queue-liked');
  });

  it('includes queue-liked when onQueueLikedTracks is provided and provider exists', () => {
    // #when
    const { result } = renderHook(() =>
      useMenuItems(
        makeRequest({ kind: 'playlist' }),
        makeCallbacks({ onQueueLikedTracks: vi.fn() }),
      ),
    );

    // #then
    const ids = result.current.map((i) => i.id);
    expect(ids).toContain('queue-liked');
  });

  it('includes Unlike for an album when canToggleSaved and isSaved=true', () => {
    // #given
    mockUseAlbumSavedStatus.mockReturnValue({
      isSaved: true,
      toggleSaved: vi.fn(),
      canToggle: true,
      saveError: null,
      clearSaveError: vi.fn(),
    });

    // #when
    const { result } = renderHook(() =>
      useMenuItems(
        makeRequest({ kind: 'album', id: 'a1', name: 'My Album' }),
        makeCallbacks(),
      ),
    );

    // #then
    const toggleSave = result.current.find((i) => i.id === 'toggle-save');
    expect(toggleSave?.label).toBe('Unlike');
  });
});
