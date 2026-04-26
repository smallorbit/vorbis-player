import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import type { ContextMenuRequest } from '../../types';
import type { ProviderId, MediaTrack } from '@/types/domain';

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

vi.mock('../useAlbumSavedStatus', () => ({
  useAlbumSavedStatus: () => ({
    isSaved: null,
    toggleSaved: vi.fn(),
    canToggle: false,
    saveError: null,
    clearSaveError: vi.fn(),
  }),
}));

import LibraryContextMenu, { type LibraryContextMenuProps } from '../LibraryContextMenu';

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
}

function renderMenu(propsOverrides: Partial<LibraryContextMenuProps> = {}) {
  const props: LibraryContextMenuProps = {
    request: makeRequest(),
    onClose: vi.fn(),
    onPlayCollection: vi.fn(),
    onAddToQueue: vi.fn(),
    onPlayLikedTracks: vi.fn(),
    ...propsOverrides,
  };
  const result = render(
    <ThemeProvider theme={theme}>
      <LibraryContextMenu {...props} />
    </ThemeProvider>,
  );
  return { ...result, props };
}

describe('LibraryContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  it('renders nothing when request is null', () => {
    // #when
    renderMenu({ request: null });

    // #then
    expect(screen.queryByTestId('library-context-menu')).toBeNull();
  });

  it('renders the playlist schema with 5 items', () => {
    // #when
    renderMenu({ request: makeRequest({ kind: 'playlist' }) });

    // #then
    expect(screen.getByTestId('menu-play')).toBeInTheDocument();
    expect(screen.getByTestId('menu-add-to-queue')).toBeInTheDocument();
    expect(screen.getByTestId('menu-play-next')).toBeInTheDocument();
    expect(screen.getByTestId('menu-toggle-pin')).toBeInTheDocument();
    expect(screen.getByTestId('menu-start-radio')).toBeInTheDocument();
  });

  it('disables Play Next and Start Radio when handlers are undefined', () => {
    // #when
    renderMenu({
      request: makeRequest({ kind: 'playlist' }),
      onPlayNext: undefined,
      onStartRadioForCollection: undefined,
    });

    // #then
    expect((screen.getByTestId('menu-play-next') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('menu-start-radio') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Play Next and Start Radio when handlers are provided', () => {
    // #given
    const onPlayNext = vi.fn();
    const onStartRadio = vi.fn();
    const onClose = vi.fn();

    // #when
    renderMenu({
      request: makeRequest({ kind: 'playlist' }),
      onPlayNext,
      onStartRadioForCollection: onStartRadio,
      onClose,
    });
    fireEvent.click(screen.getByTestId('menu-play-next'));
    fireEvent.click(screen.getByTestId('menu-start-radio'));

    // #then
    expect(onPlayNext).toHaveBeenCalledWith('playlist', 'p1', 'My Playlist', 'spotify');
    expect(onStartRadio).toHaveBeenCalledWith('playlist', 'p1', 'spotify');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows Pin label when not pinned, Unpin when pinned', () => {
    // #given (not pinned)
    const { unmount } = renderMenu({ request: makeRequest({ kind: 'playlist' }) });

    // #then
    expect(screen.getByTestId('menu-toggle-pin').textContent).toBe('Pin');
    unmount();

    // #given (pinned)
    mockPinned.mockReturnValue({
      isPlaylistPinned: () => true,
      isAlbumPinned: () => false,
      togglePinPlaylist: vi.fn(),
      togglePinAlbum: vi.fn(),
    });
    renderMenu({ request: makeRequest({ kind: 'playlist' }) });

    // #then
    expect(screen.getByTestId('menu-toggle-pin').textContent).toBe('Unpin');
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
    renderMenu({ request: makeRequest({ kind: 'liked', id: 'liked', provider: undefined }) });

    // #then
    expect(screen.getByTestId('menu-play-all')).toBeInTheDocument();
    expect(screen.getByTestId('menu-play-liked-spotify')).toBeInTheDocument();
    expect(screen.getByTestId('menu-play-liked-dropbox')).toBeInTheDocument();
  });

  it('per-provider liked play loads tracks then forwards to onPlayLikedTracks', async () => {
    // #given
    const tracks: MediaTrack[] = [{ id: 't1' } as MediaTrack];
    mockLoadLiked.mockResolvedValue(tracks);
    const onPlayLikedTracks = vi.fn();
    const onClose = vi.fn();
    renderMenu({
      request: makeRequest({ kind: 'liked', id: 'liked', provider: undefined }),
      onPlayLikedTracks,
      onClose,
    });

    // #when
    await act(async () => {
      fireEvent.click(screen.getByTestId('menu-play-liked-spotify'));
    });

    // #then
    expect(mockLoadLiked).toHaveBeenCalledWith('spotify');
    expect(onPlayLikedTracks).toHaveBeenCalledWith(tracks, 'liked-spotify', 'Liked Songs', 'spotify');
    expect(onClose).toHaveBeenCalled();
  });

  it('appends Remove from history for recently-played and dispatches by originalKind', () => {
    // #when
    renderMenu({
      request: makeRequest({
        kind: 'recently-played',
        originalKind: 'playlist',
        recentRef: { kind: 'playlist', id: 'p1', provider: 'spotify' },
      }),
    });

    // #then
    expect(screen.getByTestId('menu-play')).toBeInTheDocument();
    expect(screen.getByTestId('menu-remove-from-history')).toBeInTheDocument();
  });

  it('Remove from history calls remove() with the recent ref', () => {
    // #given
    const remove = vi.fn();
    mockRecent.mockReturnValue({ remove });

    // #when
    renderMenu({
      request: makeRequest({
        kind: 'recently-played',
        originalKind: 'playlist',
        recentRef: { kind: 'playlist', id: 'p1', provider: 'spotify' },
      }),
    });
    fireEvent.click(screen.getByTestId('menu-remove-from-history'));

    // #then
    expect(remove).toHaveBeenCalledWith({ provider: 'spotify', kind: 'playlist', id: 'p1' });
  });

  it('Play action invokes onPlayCollection for playlist kind', () => {
    // #given
    const onPlayCollection = vi.fn();
    const onClose = vi.fn();

    // #when
    renderMenu({
      request: makeRequest({ kind: 'playlist' }),
      onPlayCollection,
      onClose,
    });
    fireEvent.click(screen.getByTestId('menu-play'));

    // #then
    expect(onPlayCollection).toHaveBeenCalledWith('playlist', 'p1', 'My Playlist', 'spotify');
    expect(onClose).toHaveBeenCalled();
  });

  it('Add to Queue invokes onAddToQueue', () => {
    // #given
    const onAddToQueue = vi.fn();

    // #when
    renderMenu({ request: makeRequest({ kind: 'playlist' }), onAddToQueue });
    fireEvent.click(screen.getByTestId('menu-add-to-queue'));

    // #then
    expect(onAddToQueue).toHaveBeenCalledWith('p1', 'My Playlist', 'spotify');
  });
});
