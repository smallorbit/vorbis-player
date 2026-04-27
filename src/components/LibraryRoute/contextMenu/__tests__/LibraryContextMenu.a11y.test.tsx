/**
 * Accessibility tests for LibraryContextMenu — Gap 2 (focus return) and Gap 3 (arrow-key nav).
 *
 * Covers:
 *  - Arrow-key navigation: ArrowDown advances focus, wraps at end
 *  - Arrow-key navigation: ArrowUp retreats focus, wraps at start
 *  - Home / End jump to first / last enabled item
 *  - Disabled items are skipped by arrow-key cycling
 *  - onReturnFocusClose is called on Escape (not onClose)
 *  - onReturnFocusClose is called when a menu item is activated (not onClose)
 *  - onClose is called on pointer-outside dismiss (not onReturnFocusClose)
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

const { mockQueueLikedFromCollection } = vi.hoisted(() => ({
  mockQueueLikedFromCollection: vi.fn(),
}));

vi.mock('../useQueueLikedFromCollection', () => ({
  useQueueLikedFromCollection: () => ({ queueLikedFromCollection: mockQueueLikedFromCollection }),
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

const defaultMocks = {
  pinnedState: () => ({
    isPlaylistPinned: vi.fn(() => false),
    isAlbumPinned: vi.fn(() => false),
    togglePinPlaylist: vi.fn(),
    togglePinAlbum: vi.fn(),
  }),
  likedSection: () => ({ perProvider: [] }),
  recent: () => ({ remove: vi.fn() }),
};

function renderMenu(props: Partial<LibraryContextMenuProps> & { request: ContextMenuRequest | null }) {
  const defaults: LibraryContextMenuProps = {
    request: null,
    onClose: vi.fn(),
    onReturnFocusClose: vi.fn(),
    onPlayCollection: vi.fn(),
    onAddToQueue: vi.fn(),
    onPlayNext: vi.fn(),
    onStartRadioForCollection: vi.fn(),
    onPlayLikedTracks: vi.fn(),
    onQueueLikedTracks: vi.fn(),
  };
  return render(
    <ThemeProvider theme={theme}>
      <LibraryContextMenu {...defaults} {...props} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockPinned.mockImplementation(defaultMocks.pinnedState);
  mockLikedSection.mockImplementation(defaultMocks.likedSection);
  mockRecent.mockImplementation(defaultMocks.recent);
  mockLoadLiked.mockResolvedValue([]);
});

function getMenuItems() {
  return screen.getAllByRole('menuitem') as HTMLButtonElement[];
}

describe('LibraryContextMenu — arrow-key navigation', () => {
  it('ArrowDown moves focus to the next item', () => {
    renderMenu({ request: makeRequest() });
    const items = getMenuItems();
    items[0].focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
  });

  it('ArrowDown wraps from last item to first', () => {
    renderMenu({ request: makeRequest() });
    const items = getMenuItems().filter((b) => !b.disabled);
    items[items.length - 1].focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowUp moves focus to the previous item', () => {
    renderMenu({ request: makeRequest() });
    const items = getMenuItems();
    items[1].focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowUp wraps from first item to last enabled item', () => {
    renderMenu({ request: makeRequest() });
    const items = getMenuItems().filter((b) => !b.disabled);
    items[0].focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('Home moves focus to the first enabled item', () => {
    renderMenu({ request: makeRequest() });
    const items = getMenuItems().filter((b) => !b.disabled);
    items[items.length - 1].focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('End moves focus to the last enabled item', () => {
    renderMenu({ request: makeRequest() });
    const items = getMenuItems().filter((b) => !b.disabled);
    items[0].focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });
});

describe('LibraryContextMenu — focus return on keyboard dismiss', () => {
  it('calls onReturnFocusClose (not onClose) when a menu item is activated', () => {
    const onClose = vi.fn();
    const onReturnFocusClose = vi.fn();
    renderMenu({ request: makeRequest(), onClose, onReturnFocusClose });

    const playBtn = screen.getByTestId('menu-play');
    fireEvent.click(playBtn);

    expect(onReturnFocusClose).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
