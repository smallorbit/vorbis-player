/**
 * Regression test for #1347 — clicking a Liked Songs card must invoke onSelectCollection
 * (which AudioPlayer wires to handleCloseLibrary + collection loading), closing the library.
 *
 * Since #1687, liked cards emit a typed CollectionSelection ({ type: 'liked', provider? })
 * instead of the legacy LIKED_SONGS_ID string remapping.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CollectionSelection } from '@/types/domain';

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
 * Simulates what PinnedSection does since #1687: call onSelectCollection with a
 * typed liked selection (provider-less for unified, provider-tagged otherwise).
 */
vi.mock('../views/HomeView', () => ({
  default: ({
    onSelectCollection,
  }: {
    onSelectCollection: (selection: CollectionSelection) => void;
  }) => (
    <div data-testid="home-view">
      <button
        data-testid="select-liked-unified"
        onClick={() => onSelectCollection({ type: 'liked', name: 'Liked Songs' })}
      >
        Liked Songs
      </button>
      <button
        data-testid="select-liked-per-provider"
        onClick={() =>
          onSelectCollection({ type: 'liked', provider: 'spotify', name: 'Liked Songs' })
        }
      >
        Liked Songs (Spotify)
      </button>
    </div>
  ),
}));

import LibraryRoute from '../index';

const baseProps = {
  onAddToQueue: vi.fn(async () => null),
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

  it('invokes onSelectCollection with a provider-less liked selection when unified Liked card is clicked', () => {
    // #given
    const onClose = vi.fn();
    const onSelectCollection = vi.fn().mockImplementation(() => onClose());
    render(
      <LibraryRoute {...baseProps} onSelectCollection={onSelectCollection} onClose={onClose} />,
    );

    // #when
    fireEvent.click(screen.getByTestId('select-liked-unified'));

    // #then
    expect(onSelectCollection).toHaveBeenCalledWith({ type: 'liked', name: 'Liked Songs' });
    expect(onClose).toHaveBeenCalled();
  });

  it('invokes onSelectCollection with a provider-tagged liked selection when per-provider Liked card is clicked', () => {
    // #given
    const onClose = vi.fn();
    const onSelectCollection = vi.fn().mockImplementation(() => onClose());
    render(
      <LibraryRoute {...baseProps} onSelectCollection={onSelectCollection} onClose={onClose} />,
    );

    // #when
    fireEvent.click(screen.getByTestId('select-liked-per-provider'));

    // #then — the selection stays typed; no LIKED_SONGS_ID string remapping
    expect(onSelectCollection).toHaveBeenCalledWith({
      type: 'liked',
      provider: 'spotify',
      name: 'Liked Songs',
    });
    expect(onClose).toHaveBeenCalled();
  });
});
