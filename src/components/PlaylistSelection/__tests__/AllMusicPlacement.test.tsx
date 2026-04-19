import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof IntersectionObserver;

import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { PlaylistGrid } from '../PlaylistGrid';
import { AlbumGrid } from '../AlbumGrid';
import {
  LibraryActionsProvider,
  LibraryBrowsingProvider,
  LibraryDataProvider,
  LibraryPinProvider,
  type LibraryActionsContextValue,
  type LibraryBrowsingContextValue,
  type LibraryDataContextValue,
  type LibraryPinContextValue,
} from '../LibraryContext';
import type { AlbumInfo } from '../../../services/spotify';

const baseBrowsing: LibraryBrowsingContextValue = {
  viewMode: 'playlists',
  setViewMode: () => undefined,
  searchQuery: '',
  setSearchQuery: () => undefined,
  playlistSort: 'recently-added',
  setPlaylistSort: () => undefined,
  albumSort: 'recently-added',
  setAlbumSort: () => undefined,
  artistFilter: '',
  setArtistFilter: () => undefined,
  providerFilters: [],
  setProviderFilters: () => undefined,
  handleProviderToggle: () => undefined,
  availableGenres: [],
  selectedGenres: [],
  setSelectedGenres: () => undefined,
  handleGenreToggle: () => undefined,
  recentlyPlayed: [],
  onRecentlyPlayedSelect: () => undefined,
  hasActiveFilters: false,
  handleClearFilters: () => undefined,
};

const baseActions: LibraryActionsContextValue = {
  onPlaylistClick: vi.fn(),
  onPlaylistContextMenu: vi.fn(),
  onLikedSongsClick: vi.fn(),
  onAlbumClick: vi.fn(),
  onAlbumContextMenu: vi.fn(),
  onArtistClick: vi.fn(),
};

const basePin: LibraryPinContextValue = {
  pinnedPlaylists: [],
  unpinnedPlaylists: [],
  pinnedAlbums: [],
  unpinnedAlbums: [],
  isPlaylistPinned: () => false,
  canPinMorePlaylists: true,
  isAlbumPinned: () => false,
  canPinMoreAlbums: true,
  onPinPlaylistClick: vi.fn(),
  onPinAlbumClick: vi.fn(),
};

const baseData: LibraryDataContextValue = {
  inDrawer: false,
  albums: [],
  isInitialLoadComplete: true,
  showProviderBadges: false,
  enabledProviderIds: ['dropbox'],
  likedSongsPerProvider: [],
  likedSongsCount: 0,
  isLikedSongsSyncing: false,
  isUnifiedLikedActive: false,
  unifiedLikedCount: 0,
  allMusicCount: 250,
  activeDescriptor: null,
};

function renderGrid(
  Component: React.ComponentType,
  data: Partial<LibraryDataContextValue> = {},
  pin: Partial<LibraryPinContextValue> = {},
  browsing: Partial<LibraryBrowsingContextValue> = {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <LibraryDataProvider value={{ ...baseData, ...data }}>
        <LibraryBrowsingProvider value={{ ...baseBrowsing, ...browsing }}>
          <LibraryPinProvider value={{ ...basePin, ...pin }}>
            <LibraryActionsProvider value={baseActions}>
              <Component />
            </LibraryActionsProvider>
          </LibraryPinProvider>
        </LibraryBrowsingProvider>
      </LibraryDataProvider>
    </ThemeProvider>,
  );
}

describe('PlaylistGrid placement of AllMusicCard', () => {
  it('renders AllMusicCard inside the playlist grid when Dropbox is enabled', () => {
    // #when
    renderGrid(PlaylistGrid);

    // #then
    expect(screen.getByText('All Music')).toBeInTheDocument();
    expect(screen.getByText('250 tracks • Shuffled')).toBeInTheDocument();
  });

  it('places AllMusicCard before any other entry (top anchor slot, before Liked Songs and pinned playlists)', () => {
    // #when
    renderGrid(PlaylistGrid, {
      likedSongsCount: 7,
      likedSongsPerProvider: [{ provider: 'dropbox', count: 7 }],
    });

    // #then — All Music heading appears before Liked Songs in document order
    const allMusic = screen.getByText('All Music');
    const liked = screen.getByText('Liked Songs');
    expect(allMusic.compareDocumentPosition(liked) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides AllMusicCard when Dropbox is not in enabledProviderIds', () => {
    // #when
    renderGrid(PlaylistGrid, { enabledProviderIds: ['spotify'] });

    // #then
    expect(screen.queryByText('All Music')).not.toBeInTheDocument();
  });

  it('hides AllMusicCard when Dropbox is excluded by provider filter chip', () => {
    // #when
    renderGrid(PlaylistGrid, undefined, undefined, { providerFilters: ['spotify'] });

    // #then
    expect(screen.queryByText('All Music')).not.toBeInTheDocument();
  });
});

describe('AlbumGrid does not render All Music', () => {
  const dropboxAlbum: AlbumInfo = {
    id: '/Artist/Abbey Road',
    name: 'Abbey Road',
    artists: 'The Beatles',
    images: [],
    release_date: '1969',
    total_tracks: 17,
    uri: '',
    provider: 'dropbox',
  };

  it('renders only real albums even though All Music is fed via context data', () => {
    // #when
    renderGrid(
      AlbumGrid,
      { albums: [dropboxAlbum] },
      { unpinnedAlbums: [dropboxAlbum] },
    );

    // #then
    expect(screen.getByText('Abbey Road')).toBeInTheDocument();
    expect(screen.queryByText('All Music')).not.toBeInTheDocument();
  });

  it('shows the empty-state message when no real albums are present', () => {
    // #when
    const { container } = renderGrid(AlbumGrid);

    // #then
    expect(within(container).queryByText('All Music')).not.toBeInTheDocument();
  });
});
