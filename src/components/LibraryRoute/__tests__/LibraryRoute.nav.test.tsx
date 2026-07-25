/**
 * Tests for LibraryRoute — sub-route navigation and typed collection selection (#1294, #1687).
 * Supplements the existing LibraryRoute.test.tsx (layout shell tests).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CollectionSelection } from '@/types/domain';

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: vi.fn(),
}));

// LibraryRoute mounts MiniPlayer (added by #1295), which calls useCurrentTrackContext.
// Stub the context so navigation tests don't need a full TrackProvider tree.
// Default returns null → MiniPlayer renders null and stays out of the way.
vi.mock('@/contexts/TrackContext', () => ({
  useCurrentTrackContext: () => ({ currentTrack: null }),
}));

// LibraryRoute mounts LibraryContextMenu (added by #1297), which calls
// usePinnedItems + useRecentlyPlayedCollections. Stub them so navigation tests
// don't need full PinnedItems/RecentlyPlayed providers.
vi.mock('@/hooks/usePinnedItems', () => ({
  usePinnedItems: () => ({
    pinnedPlaylistIds: [],
    pinnedAlbumIds: [],
    isPlaylistPinned: () => false,
    isAlbumPinned: () => false,
    togglePinPlaylist: vi.fn(),
    togglePinAlbum: vi.fn(),
  }),
}));

vi.mock('@/hooks/useRecentlyPlayedCollections', () => ({
  useRecentlyPlayedCollections: () => ({ history: [], record: vi.fn(), remove: vi.fn() }),
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    hasMultipleProviders: false,
    enabledProviderIds: ['spotify'],
  })),
}));

vi.mock('@/hooks/useUnifiedLikedTracks', () => ({
  useUnifiedLikedTracks: vi.fn(() => ({
    unifiedTracks: [],
    isUnifiedLikedActive: false,
    totalCount: 0,
    isLoading: false,
  })),
}));

vi.mock('../hooks', () => ({
  useResumeSection: vi.fn(() => ({ session: null, hasResumable: false })),
  useRecentlyPlayedSection: vi.fn(() => ({ items: [], isLoading: false, isEmpty: true })),
  usePinnedSection: vi.fn(() => ({ combined: [], pinnedPlaylists: [], pinnedAlbums: [], isLoading: false, isEmpty: true })),
  usePlaylistsSection: vi.fn(() => ({ items: [], isLoading: false, isEmpty: true })),
  useAlbumsSection: vi.fn(() => ({ items: [], isLoading: false, isEmpty: true })),
  useLikedSection: vi.fn(() => ({ totalCount: 0, perProvider: [], isUnified: false, isLoading: false })),
  fetchLikedForProvider: vi.fn(async () => []),
}));

// Stub views so we can control navigation triggers without rendering the full section tree
vi.mock('../views/HomeView', () => ({
  default: ({
    onNavigate,
    onSelectCollection,
  }: {
    onNavigate: (view: string) => void;
    onSelectCollection: (selection: CollectionSelection) => void;
  }) => (
    <div data-testid="home-view">
      <button onClick={() => onNavigate('playlists')}>go-playlists</button>
      <button onClick={() => onNavigate('albums')}>go-albums</button>
      <button
        onClick={() =>
          onSelectCollection({
            type: 'collection',
            ref: { provider: 'spotify', kind: 'album', id: 'a1' },
            name: 'Dark Side',
          })
        }
      >
        select-album
      </button>
      <button
        onClick={() =>
          onSelectCollection({
            type: 'collection',
            ref: { provider: 'spotify', kind: 'playlist', id: 'p1' },
            name: 'Chill',
          })
        }
      >
        select-playlist
      </button>
    </div>
  ),
}));

vi.mock('../views/SeeAllView', () => ({
  default: ({ view, onBack }: { view: string; onBack: () => void }) => (
    <div data-testid={`see-all-view-${view}`}>
      <button onClick={onBack}>back</button>
    </div>
  ),
}));

import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import LibraryRoute from '../index';

const mockUsePlayerSizingContext = vi.mocked(usePlayerSizingContext);

const baseProps = {
  onSelectCollection: vi.fn(),
  onAddToQueue: vi.fn(async () => null),
  lastSession: null,
  isPlaying: false,
  onMiniPlay: vi.fn(),
  onMiniPause: vi.fn(),
  onMiniNext: vi.fn(),
  onMiniPrevious: vi.fn(),
  onMiniExpand: vi.fn(),
};

describe('LibraryRoute — navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlayerSizingContext.mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);
  });

  it('starts at HomeView by default', () => {
    // #given + #when
    render(<LibraryRoute {...baseProps} />);

    // #then
    expect(screen.getByTestId('home-view')).toBeInTheDocument();
    expect(screen.queryByTestId(/see-all-view/)).not.toBeInTheDocument();
  });

  it('navigates to SeeAllView when onNavigate("playlists") fires', () => {
    // #given
    render(<LibraryRoute {...baseProps} />);

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'go-playlists' }));

    // #then
    expect(screen.getByTestId('see-all-view-playlists')).toBeInTheDocument();
    expect(screen.queryByTestId('home-view')).not.toBeInTheDocument();
  });

  it('navigates to SeeAllView for albums', () => {
    // #given
    render(<LibraryRoute {...baseProps} />);

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'go-albums' }));

    // #then
    expect(screen.getByTestId('see-all-view-albums')).toBeInTheDocument();
  });

  it('navigates back to HomeView from SeeAllView when onBack fires', () => {
    // #given
    render(<LibraryRoute {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'go-playlists' }));
    expect(screen.getByTestId('see-all-view-playlists')).toBeInTheDocument();

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'back' }));

    // #then
    expect(screen.getByTestId('home-view')).toBeInTheDocument();
    expect(screen.queryByTestId(/see-all-view/)).not.toBeInTheDocument();
  });

  it('calls onSelectCollection with the typed album selection (bare id, no album: prefix)', () => {
    // #given
    const onSelectCollection = vi.fn();
    render(<LibraryRoute {...baseProps} onSelectCollection={onSelectCollection} />);

    // #when — select an album
    fireEvent.click(screen.getByRole('button', { name: 'select-album' }));

    // #then — the typed selection carries the bare album id inside a CollectionRef
    expect(onSelectCollection).toHaveBeenCalledTimes(1);
    expect(onSelectCollection).toHaveBeenCalledWith({
      type: 'collection',
      ref: { provider: 'spotify', kind: 'album', id: 'a1' },
      name: 'Dark Side',
    });
  });

  it('calls onSelectCollection with the typed playlist selection', () => {
    // #given
    const onSelectCollection = vi.fn();
    render(<LibraryRoute {...baseProps} onSelectCollection={onSelectCollection} />);

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'select-playlist' }));

    // #then
    expect(onSelectCollection).toHaveBeenCalledWith({
      type: 'collection',
      ref: { provider: 'spotify', kind: 'playlist', id: 'p1' },
      name: 'Chill',
    });
  });
});
