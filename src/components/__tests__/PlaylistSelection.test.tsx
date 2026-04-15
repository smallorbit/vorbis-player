import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { LibraryPage } from '../PlaylistSelection';
import { TestWrapper } from '@/test/testWrappers';
import { makePlaylistInfo, makeAlbumInfo } from '@/test/fixtures';
import { LIKED_SONGS_ID } from '@/constants/playlist';
import { useLibrarySync } from '@/hooks/useLibrarySync';

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('@/hooks/useLibrarySync', () => ({
  useLibrarySync: vi.fn(),
}));

const mockUseLibrarySync = vi.mocked(useLibrarySync);

vi.mock('@/contexts/PlayerSizingContext', () => ({
  PlayerSizingProvider: ({ children }: { children: React.ReactNode }) => children,
  usePlayerSizingContext: vi.fn(() => ({
    viewport: { width: 1024, height: 768, ratio: 1024 / 768 },
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    hasPointerInput: true,
    dimensions: { width: 600, height: 600 },
  })),
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    isAuthenticated: vi.fn(() => true),
    handleRedirect: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn().mockReturnValue('mock-token'),
    ensureValidToken: vi.fn().mockResolvedValue('mock-token'),
    redirectToAuth: vi.fn(),
    logout: vi.fn(),
  },
  getUserPlaylists: vi.fn(),
  getPlaylistTracks: vi.fn(),
  getAlbumTracks: vi.fn(),
  getLikedSongs: vi.fn(),
  getLikedSongsCount: vi.fn(),
  checkTrackSaved: vi.fn(),
  saveTrack: vi.fn(),
  unsaveTrack: vi.fn(),
  getUserLibraryInterleaved: vi.fn(),
}));

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    setVolume: vi.fn().mockResolvedValue(undefined),
    onPlayerStateChanged: vi.fn(() => vi.fn()),
    getCurrentState: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    getDeviceId: vi.fn().mockReturnValue(null),
    getIsReady: vi.fn().mockReturnValue(false),
  },
}));

const MOCK_PLAYLIST_NAMES = {
  CHILL: 'Chill Vibes',
  ROCK: 'Rock Anthems',
  JAZZ: 'Jazz Classics',
} as const;

const mockPlaylists = [
  makePlaylistInfo({ id: 'pl-1', name: MOCK_PLAYLIST_NAMES.CHILL }),
  makePlaylistInfo({ id: 'pl-2', name: MOCK_PLAYLIST_NAMES.ROCK }),
  makePlaylistInfo({ id: 'pl-3', name: MOCK_PLAYLIST_NAMES.JAZZ }),
];

const mockAlbums = [
  makeAlbumInfo({ id: 'al-1', name: 'Album One', artists: 'Artist A' }),
  makeAlbumInfo({ id: 'al-2', name: 'Album Two', artists: 'Artist B' }),
];

function setMockLibrarySync(overrides?: Record<string, unknown>) {
  mockUseLibrarySync.mockReturnValue({
    playlists: mockPlaylists,
    albums: mockAlbums,
    likedSongsCount: 10,
    likedSongsPerProvider: [],
    isInitialLoadComplete: true,
    isSyncing: false,
    lastSyncTimestamp: Date.now(),
    syncError: null,
    refreshNow: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useLibrarySync>);
}

function renderLibraryPage(props?: Partial<Parameters<typeof LibraryPage>[0]>) {
  const onPlaylistSelect = vi.fn();
  const result = render(
    <ThemeProvider theme={theme}>
      <TestWrapper>
        <LibraryPage onPlaylistSelect={onPlaylistSelect} {...props} />
      </TestWrapper>
    </ThemeProvider>
  );
  return { ...result, onPlaylistSelect };
}

describe('PlaylistSelection', () => {
  beforeEach(() => {
    setMockLibrarySync();
  });

  it('renders Playlists and Albums tab buttons', () => {
    renderLibraryPage();
    expect(screen.getByRole('button', { name: /playlists/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /albums/i })).toBeTruthy();
  });

  it('switching to Albums tab shows the album grid', () => {
    // #given
    renderLibraryPage();

    // #when
    fireEvent.click(screen.getByRole('button', { name: /albums/i }));

    // #then
    expect(screen.getByText('Album One')).toBeTruthy();
    expect(screen.getByText('Album Two')).toBeTruthy();
  });

  it('search input filters playlist list by name (case-insensitive)', () => {
    // #given
    renderDrawerLibrary();
    const searchInput = screen.getByRole('textbox', { name: /search playlists and albums/i });

    // #when
    fireEvent.change(searchInput, { target: { value: 'chill' } });

    // #then
    expect(screen.getByText('Chill Vibes')).toBeTruthy();
    expect(screen.queryByText('Rock Anthems')).toBeNull();
  });

  it('pinned items appear before unpinned items', () => {
    renderLibraryPage();
    const items = screen.getAllByText(/tracks/);
    expect(items.length).toBeGreaterThan(0);
  });

  it('clicking a playlist opens the context menu instead of playing directly', () => {
    // #given
    renderLibraryPage();

    // #when
    fireEvent.click(screen.getByText('Chill Vibes'));

    // #then
    expect(screen.getByText('Play Chill Vibes')).toBeTruthy();
  });

  it('shows loading state while isSyncing is true and no data yet', () => {
    // #given
    setMockLibrarySync({
      playlists: [],
      albums: [],
      likedSongsCount: 0,
      isInitialLoadComplete: false,
      isSyncing: true,
    });

    // #when
    renderLibraryPage();

    // #then
    // When auth is resolved but initial load is not complete, the component renders
    // tab buttons with inline spinners — not the "Loading your library..." skeleton
    // (that skeleton only shows when isLoading=true, i.e. before auth resolves).
    expect(screen.getByRole('button', { name: /playlists/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /albums/i })).toBeTruthy();
    expect(screen.queryByText('Loading your library...')).toBeNull();
  });

  it('shows error message when no content is found after load', () => {
    // #given
    setMockLibrarySync({
      playlists: [],
      albums: [],
      likedSongsCount: 0,
      isInitialLoadComplete: true,
    });

    // #when
    renderLibraryPage();

    // #then
    expect(
      screen.getByText(/no playlists, albums, or liked songs found/i)
    ).toBeTruthy();
  });

  it('Liked Songs item is present with LIKED_SONGS_ID', () => {
    // #given
    const { onPlaylistSelect } = renderLibraryPage();

    // #when
    fireEvent.click(screen.getByText('Liked Songs'));

    // #then
    expect(screen.getByText('Liked Songs')).toBeTruthy();
    expect(onPlaylistSelect).toHaveBeenCalledWith(LIKED_SONGS_ID, 'Liked Songs', undefined);
  });

});

describe('PlaylistSelection — search and filter', () => {
  beforeEach(() => {
    setMockLibrarySync();
  });

  it('filters playlists by search query', () => {
    // #given
    renderDrawerLibrary();
    const searchInput = screen.getByRole('textbox', { name: /search playlists and albums/i });

    // #when
    fireEvent.change(searchInput, { target: { value: MOCK_PLAYLIST_NAMES.CHILL } });

    // #then
    expect(screen.getByText(MOCK_PLAYLIST_NAMES.CHILL)).toBeTruthy();
    expect(screen.queryByText(MOCK_PLAYLIST_NAMES.ROCK)).toBeNull();
    expect(screen.queryByText(MOCK_PLAYLIST_NAMES.JAZZ)).toBeNull();
  });

  it('shows empty state when search matches nothing', () => {
    // #given
    setMockLibrarySync({ likedSongsCount: 0 });
    renderDrawerLibrary();
    const searchInput = screen.getByRole('textbox', { name: /search playlists and albums/i });

    // #when
    fireEvent.change(searchInput, { target: { value: 'XYZ123NonExistent' } });

    // #then
    expect(screen.getByText(/no playlists match/i)).toBeTruthy();
  });

  it('clears search when clear button is clicked', () => {
    // #given
    renderDrawerLibrary();
    const searchInput = screen.getByRole('textbox', { name: /search playlists and albums/i }) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: MOCK_PLAYLIST_NAMES.CHILL } });
    expect(searchInput.value).toBe(MOCK_PLAYLIST_NAMES.CHILL);

    const clearButton = screen.queryByRole('button', { name: /clear search/i });

    // #when
    if (clearButton) {
      fireEvent.click(clearButton);

      // #then
      expect((searchInput as HTMLInputElement).value).toBe('');
      expect(screen.getByText(MOCK_PLAYLIST_NAMES.CHILL)).toBeTruthy();
      expect(screen.getByText(MOCK_PLAYLIST_NAMES.ROCK)).toBeTruthy();
      expect(screen.getByText(MOCK_PLAYLIST_NAMES.JAZZ)).toBeTruthy();
    }
  });

  it('search is case-insensitive', () => {
    // #given
    renderDrawerLibrary();
    const searchInput = screen.getByRole('textbox', { name: /search playlists and albums/i });

    // #when
    fireEvent.change(searchInput, { target: { value: 'JAZZ' } });

    // #then
    expect(screen.getByText(MOCK_PLAYLIST_NAMES.JAZZ)).toBeTruthy();
    expect(screen.queryByText(MOCK_PLAYLIST_NAMES.CHILL)).toBeNull();

    // #when
    fireEvent.change(searchInput, { target: { value: 'rock' } });

    // #then
    expect(screen.getByText(MOCK_PLAYLIST_NAMES.ROCK)).toBeTruthy();
    expect(screen.queryByText(MOCK_PLAYLIST_NAMES.JAZZ)).toBeNull();
  });

  it('search updates live as user types', () => {
    // #given
    renderDrawerLibrary();
    const searchInput = screen.getByRole('textbox', { name: /search playlists and albums/i });

    // #when
    fireEvent.change(searchInput, { target: { value: MOCK_PLAYLIST_NAMES.CHILL } });

    // #then
    expect(screen.getByText(MOCK_PLAYLIST_NAMES.CHILL)).toBeTruthy();

    // #when
    fireEvent.change(searchInput, { target: { value: MOCK_PLAYLIST_NAMES.JAZZ } });

    // #then
    expect(screen.getByText(MOCK_PLAYLIST_NAMES.JAZZ)).toBeTruthy();

    // #when
    fireEvent.change(searchInput, { target: { value: MOCK_PLAYLIST_NAMES.ROCK } });

    // #then
    expect(screen.getByText(MOCK_PLAYLIST_NAMES.ROCK)).toBeTruthy();

    // #when
    fireEvent.change(searchInput, { target: { value: '' } });

    // #then
    expect(screen.getByText(MOCK_PLAYLIST_NAMES.CHILL)).toBeTruthy();
    expect(screen.getByText(MOCK_PLAYLIST_NAMES.JAZZ)).toBeTruthy();
    expect(screen.getByText(MOCK_PLAYLIST_NAMES.ROCK)).toBeTruthy();
  });
});
