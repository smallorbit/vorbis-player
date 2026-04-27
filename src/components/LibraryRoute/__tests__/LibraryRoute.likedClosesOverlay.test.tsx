/**
 * Regression test for #1347 — clicking a Liked Songs card must invoke onPlaylistSelect
 * (which AudioPlayer wires to handleCloseLibrary + handlePlaylistSelect), closing the library.
 *
 * The test is written test-first: it is RED before the liked branch is added to
 * handleSelectCollection in step 5 of the refactor (per-provider case calls
 * onPlaylistSelect with 'liked-spotify' ≠ LIKED_SONGS_ID until the branch remaps it).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LIKED_SONGS_ID } from '@/constants/playlist';

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: vi.fn(() => ({ isMobile: false })),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useCurrentTrackContext: () => ({ currentTrack: null }),
}));

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
  useProviderContext: vi.fn(() => ({ hasMultipleProviders: false, enabledProviderIds: ['spotify'] })),
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

vi.mock('../views/SeeAllView', () => ({
  default: ({ view, onBack }: { view: string; onBack: () => void }) => (
    <div data-testid={`see-all-view-${view}`}>
      <button onClick={onBack}>back</button>
    </div>
  ),
}));

/**
 * Stub HomeView to surface the two liked-activation paths we want to test.
 * Simulates what PinnedSection will do after the liked-consolidation refactor:
 * call onSelectCollection with kind='liked' and the card's id.
 */
vi.mock('../views/HomeView', () => ({
  default: ({
    onSelectCollection,
  }: {
    onSelectCollection: (kind: string, id: string, name: string, provider?: string) => void;
  }) => (
    <div data-testid="home-view">
      <button
        data-testid="select-liked-unified"
        onClick={() => onSelectCollection('liked', LIKED_SONGS_ID, 'Liked Songs', undefined)}
      >
        Liked Songs
      </button>
      <button
        data-testid="select-liked-per-provider"
        onClick={() => onSelectCollection('liked', 'liked-spotify', 'Liked Songs', 'spotify')}
      >
        Liked Songs (Spotify)
      </button>
    </div>
  ),
}));

import LibraryRoute from '../index';

const baseProps = {
  onOpenSettings: vi.fn(),
  lastSession: null,
  isPlaying: false,
  onMiniPlay: vi.fn(),
  onMiniPause: vi.fn(),
  onMiniNext: vi.fn(),
  onMiniPrevious: vi.fn(),
  onMiniExpand: vi.fn(),
};

describe('LibraryRoute — Liked Songs activation closes the library overlay (#1347)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes onPlaylistSelect with LIKED_SONGS_ID when unified Liked card is clicked', () => {
    // #given
    const onClose = vi.fn();
    const onPlaylistSelect = vi.fn().mockImplementation(() => onClose());
    render(<LibraryRoute {...baseProps} onPlaylistSelect={onPlaylistSelect} onClose={onClose} />);

    // #when
    fireEvent.click(screen.getByTestId('select-liked-unified'));

    // #then
    expect(onPlaylistSelect).toHaveBeenCalledWith(LIKED_SONGS_ID, 'Liked Songs', undefined);
    expect(onClose).toHaveBeenCalled();
  });

  it('invokes onPlaylistSelect with LIKED_SONGS_ID (not liked-spotify) when per-provider Liked card is clicked', () => {
    // #given — this test is RED before the kind==='liked' branch remaps per-provider ids
    const onClose = vi.fn();
    const onPlaylistSelect = vi.fn().mockImplementation(() => onClose());
    render(<LibraryRoute {...baseProps} onPlaylistSelect={onPlaylistSelect} onClose={onClose} />);

    // #when
    fireEvent.click(screen.getByTestId('select-liked-per-provider'));

    // #then — id must be LIKED_SONGS_ID, not 'liked-spotify'
    expect(onPlaylistSelect).toHaveBeenCalledWith(LIKED_SONGS_ID, 'Liked Songs', 'spotify');
    expect(onClose).toHaveBeenCalled();
  });
});
