/**
 * Edge-case tests for LibraryContextMenu beyond builder-2's baseline.
 *
 * Covers:
 *  - aria-label reflects the request.name (screen-reader announcement)
 *  - onOpenChange(false) (Radix's outside-click + Escape pathway) calls onClose
 *  - togglePin click for playlist routes through usePinnedItems.togglePinPlaylist
 *  - togglePin click for album routes through togglePinAlbum
 *  - Remove-from-history with recentRef.kind='album' calls remove with album shape
 *  - Remove-from-history with recentRef.kind='liked' calls remove with liked shape
 *  - When no recentRef on a recently-played request, no Remove item is rendered
 *  - closeAfter error handling: label + cause surfaced in toast
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import type { ContextMenuRequest } from '../../types';
import type { CollectionRef, CollectionSelection, ProviderId } from '@/types/domain';
import { createMenuActionError } from '../menuItemsForKind';
import { makeCollectionSelection } from '@/test/fixtures';

const mockToast = vi.fn();
vi.mock('sonner', () => ({ toast: (...args: unknown[]) => mockToast(...args) }));

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
  }),
}));

import LibraryContextMenu, { type LibraryContextMenuProps } from '../LibraryContextMenu';

interface MakeRequestOptions {
  kind?: 'playlist' | 'album' | 'liked' | 'recently-played';
  id?: string;
  name?: string;
  provider?: ProviderId | undefined;
  selection?: CollectionSelection;
  originalKind?: 'playlist' | 'album' | 'liked';
  recentRef?: CollectionRef;
}

function makeRequest(overrides: MakeRequestOptions = {}): ContextMenuRequest {
  const kind = overrides.kind ?? 'playlist';
  const id = overrides.id ?? 'p1';
  const name = overrides.name ?? 'My Playlist';
  const provider: ProviderId | undefined =
    'provider' in overrides ? overrides.provider : 'spotify';

  const effectiveKind = kind === 'recently-played' ? (overrides.originalKind ?? 'playlist') : kind;
  const selection: CollectionSelection =
    overrides.selection ??
    (effectiveKind === 'liked'
      ? makeCollectionSelection('liked', id, provider ?? 'spotify')
      : makeCollectionSelection(effectiveKind, id, provider ?? 'spotify'));

  const base = {
    id,
    name,
    selection,
    anchorRect: new DOMRect(10, 10, 100, 40),
    ...(provider !== undefined && { provider }),
  };

  if (kind === 'recently-played') {
    return {
      ...base,
      kind: 'recently-played',
      originalKind: overrides.originalKind ?? 'playlist',
      recentRef:
        overrides.recentRef ?? { provider: provider ?? 'spotify', kind: 'playlist', id },
    };
  }
  if (kind === 'album') return { ...base, kind: 'album' };
  if (kind === 'liked') return { ...base, kind: 'liked' };
  return { ...base, kind: 'playlist' };
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
    onReturnFocusClose: vi.fn(),
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

describe('LibraryContextMenu edges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  describe('accessibility', () => {
    it('aria-label on menu reflects the request.name', () => {
      // #given
      const request = makeRequest({ name: 'Chill Vibes' });

      // #when
      renderMenu({ request });

      // #then
      const menu = screen.getByRole('menu');
      expect(menu.getAttribute('aria-label')).toBe('Actions for Chill Vibes');
    });

    it('every menu entry has role="menuitem"', () => {
      // #when
      renderMenu({ request: makeRequest({ kind: 'playlist' }) });

      // #then
      const items = screen.getAllByRole('menuitem');
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.tagName).toBe('BUTTON');
      }
    });
  });

  describe('togglePin routing by kind', () => {
    it('playlist togglePin click invokes togglePinPlaylist with request.id', () => {
      // #given
      const togglePinPlaylist = vi.fn();
      const togglePinAlbum = vi.fn();
      mockPinned.mockReturnValue({
        isPlaylistPinned: () => false,
        isAlbumPinned: () => false,
        togglePinPlaylist,
        togglePinAlbum,
      });
      const onReturnFocusClose = vi.fn();

      // #when
      renderMenu({ request: makeRequest({ kind: 'playlist', id: 'p42' }), onReturnFocusClose });
      fireEvent.click(screen.getByTestId('menu-toggle-pin'));

      // #then
      expect(togglePinPlaylist).toHaveBeenCalledWith('p42');
      expect(togglePinAlbum).not.toHaveBeenCalled();
      expect(onReturnFocusClose).toHaveBeenCalledTimes(1);
    });

    it('album togglePin click invokes togglePinAlbum with request.id', () => {
      // #given
      const togglePinPlaylist = vi.fn();
      const togglePinAlbum = vi.fn();
      mockPinned.mockReturnValue({
        isPlaylistPinned: () => false,
        isAlbumPinned: () => false,
        togglePinPlaylist,
        togglePinAlbum,
      });

      // #when
      renderMenu({ request: makeRequest({ kind: 'album', id: 'a99' }) });
      fireEvent.click(screen.getByTestId('menu-toggle-pin'));

      // #then
      expect(togglePinAlbum).toHaveBeenCalledWith('a99');
      expect(togglePinPlaylist).not.toHaveBeenCalled();
    });
  });

  describe('Remove from history — recentRef shape variants', () => {
    it('album recentRef → remove called with album-shape ref', () => {
      // #given
      const remove = vi.fn();
      mockRecent.mockReturnValue({ remove });

      // #when
      renderMenu({
        request: makeRequest({
          kind: 'recently-played',
          originalKind: 'album',
          recentRef: { kind: 'album', id: 'a1', provider: 'spotify' },
        }),
      });
      fireEvent.click(screen.getByTestId('menu-remove-from-history'));

      // #then
      expect(remove).toHaveBeenCalledWith({ provider: 'spotify', kind: 'album', id: 'a1' });
    });

    it('liked recentRef → remove called with liked-shape ref (no id)', () => {
      // #given
      const remove = vi.fn();
      mockRecent.mockReturnValue({ remove });

      // #when
      renderMenu({
        request: makeRequest({
          kind: 'recently-played',
          originalKind: 'liked',
          recentRef: { kind: 'liked', provider: 'dropbox' },
        }),
      });
      fireEvent.click(screen.getByTestId('menu-remove-from-history'));

      // #then
      expect(remove).toHaveBeenCalledWith({ provider: 'dropbox', kind: 'liked' });
    });

    it('recently-played without recentRef does NOT render Remove from history', () => {
      // #given — recently-played but recentRef missing (defensive path)
      // #when
      const request = makeRequest({
        kind: 'recently-played',
        originalKind: 'playlist',
      });
      Reflect.deleteProperty(request, 'recentRef');
      renderMenu({ request });

      // #then
      expect(screen.queryByTestId('menu-remove-from-history')).toBeNull();
    });
  });

  describe('outside-click / Escape close pathway', () => {
    it('calls onReturnFocusClose (not onClose) when Escape is pressed', () => {
      // #given — Radix Popover closes on Escape; onEscapeKeyDown sets the return-focus flag
      const onClose = vi.fn();
      const onReturnFocusClose = vi.fn();
      renderMenu({ onClose, onReturnFocusClose });

      // #when
      fireEvent.keyDown(document, { key: 'Escape' });

      // #then
      expect(onReturnFocusClose).toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('closeAfter structured error handling', () => {
    // Tests use the liked-provider play path because playLikedFor is async and
    // properly propagates loadLikedTracks rejections through closeAfter's .catch.
    beforeEach(() => {
      mockToast.mockClear();
      mockLikedSection.mockReturnValue({
        perProvider: [{ provider: 'spotify' as ProviderId, count: 10 }],
      });
    });

    it('shows label + Error.message in toast when the action rejects with a plain Error', async () => {
      // #given
      mockLoadLiked.mockRejectedValue(new Error('network timeout'));

      // #when
      renderMenu({ request: makeRequest({ kind: 'liked', id: 'liked', provider: undefined }) });
      await act(async () => {
        fireEvent.click(screen.getByTestId('menu-play-liked-spotify'));
      });

      // #then — label is the per-provider entry label "Play (Spotify)"
      expect(mockToast).toHaveBeenCalledWith(
        "Couldn't play (spotify): network timeout. Try again.",
      );
    });

    it('shows label without cause detail when the rejection is a non-Error non-string', async () => {
      // #given
      mockLoadLiked.mockRejectedValue({ code: 42 });

      // #when
      renderMenu({ request: makeRequest({ kind: 'liked', id: 'liked', provider: undefined }) });
      await act(async () => {
        fireEvent.click(screen.getByTestId('menu-play-liked-spotify'));
      });

      // #then
      expect(mockToast).toHaveBeenCalledWith("Couldn't play (spotify). Try again.");
    });

    it('uses MenuActionError label and cause when the action throws createMenuActionError', async () => {
      // #given — loadLikedTracks itself throws a structured error with a custom label
      mockLoadLiked.mockRejectedValue(
        createMenuActionError('Load Liked Tracks', new Error('quota exceeded')),
      );

      // #when
      renderMenu({ request: makeRequest({ kind: 'liked', id: 'liked', provider: undefined }) });
      await act(async () => {
        fireEvent.click(screen.getByTestId('menu-play-liked-spotify'));
      });

      // #then — MenuActionError overrides both label and cause
      expect(mockToast).toHaveBeenCalledWith(
        "Couldn't load liked tracks: quota exceeded. Try again.",
      );
    });

    it('surfaces a string rejection as the cause message in the toast', async () => {
      // #given
      mockLoadLiked.mockRejectedValue('service unavailable');

      // #when
      renderMenu({ request: makeRequest({ kind: 'liked', id: 'liked', provider: undefined }) });
      await act(async () => {
        fireEvent.click(screen.getByTestId('menu-play-liked-spotify'));
      });

      // #then
      expect(mockToast).toHaveBeenCalledWith(
        "Couldn't play (spotify): service unavailable. Try again.",
      );
    });
  });
});
