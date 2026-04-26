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
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
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
      const onClose = vi.fn();

      // #when
      renderMenu({ request: makeRequest({ kind: 'playlist', id: 'p42' }), onClose });
      fireEvent.click(screen.getByTestId('menu-toggle-pin'));

      // #then
      expect(togglePinPlaylist).toHaveBeenCalledWith('p42');
      expect(togglePinAlbum).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
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
      renderMenu({
        request: makeRequest({
          kind: 'recently-played',
          originalKind: 'playlist',
        }),
      });

      // #then
      expect(screen.queryByTestId('menu-remove-from-history')).toBeNull();
    });
  });

  describe('outside-click / Escape close pathway', () => {
    it('calls onClose when Escape is pressed (Radix onOpenChange(false))', () => {
      // #given — Radix Popover closes on Escape via the document keydown handler
      const onClose = vi.fn();
      renderMenu({ onClose });

      // #when
      fireEvent.keyDown(document, { key: 'Escape' });

      // #then
      expect(onClose).toHaveBeenCalled();
    });
  });
});
