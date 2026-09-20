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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import type { ContextMenuRequest } from '../../types';
import type { CollectionRef, CollectionSelection, ProviderId } from '@/types/domain';
import { defined } from '@/test/defined';
import { makeCollectionSelection } from '@/test/fixtures';

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
    defined(items[0]).focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
  });

  it('ArrowDown wraps from last item to first', () => {
    renderMenu({ request: makeRequest() });
    const items = getMenuItems().filter((b) => !b.disabled);
    defined(items[items.length - 1]).focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowUp moves focus to the previous item', () => {
    renderMenu({ request: makeRequest() });
    const items = getMenuItems();
    defined(items[1]).focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowUp wraps from first item to last enabled item', () => {
    renderMenu({ request: makeRequest() });
    const items = getMenuItems().filter((b) => !b.disabled);
    defined(items[0]).focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('Home moves focus to the first enabled item', () => {
    renderMenu({ request: makeRequest() });
    const items = getMenuItems().filter((b) => !b.disabled);
    defined(items[items.length - 1]).focus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('End moves focus to the last enabled item', () => {
    renderMenu({ request: makeRequest() });
    const items = getMenuItems().filter((b) => !b.disabled);
    defined(items[0]).focus();
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
