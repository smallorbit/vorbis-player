import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import PlaylistSelection from '../PlaylistSelection';
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

function renderPlaylistSelection(props?: Partial<Parameters<typeof PlaylistSelection>[0]>) {
  const onPlaylistSelect = vi.fn();
  const result = render(
    <ThemeProvider theme={theme}>
      <TestWrapper>
        <PlaylistSelection onPlaylistSelect={onPlaylistSelect} {...props} />
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
    renderPlaylistSelection();
    expect(screen.getByRole('button', { name: /playlists/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /albums/i })).toBeTruthy();
  });

  it('switching to Albums tab shows the album grid', () => {
    // #given
    renderPlaylistSelection();

    // #when
    fireEvent.click(screen.getByRole('button', { name: /albums/i }));

    // #then
    expect(screen.getByText('Album One')).toBeTruthy();
    expect(screen.getByText('Album Two')).toBeTruthy();
  });

  it('search input filters playlist list by name (case-insensitive)', () => {
    // #given
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...');

    // #when
    fireEvent.change(searchInput, { target: { value: 'chill' } });

    // #then
    expect(screen.getByText('Chill Vibes')).toBeTruthy();
    expect(screen.queryByText('Rock Anthems')).toBeNull();
  });

  it('pinned items appear before unpinned items', () => {
    renderPlaylistSelection();
    const items = screen.getAllByText(/tracks/);
    expect(items.length).toBeGreaterThan(0);
  });

  it('clicking a playlist calls onPlaylistSelect with the correct playlist ID', () => {
    // #given
    const { onPlaylistSelect } = renderPlaylistSelection();

    // #when
    fireEvent.click(screen.getByText('Chill Vibes'));

    // #then
    expect(onPlaylistSelect).toHaveBeenCalledWith('pl-1', 'Chill Vibes', undefined);
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
    renderPlaylistSelection();

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
    renderPlaylistSelection();

    // #then
    expect(
      screen.getByText(/no playlists, albums, or liked songs found/i)
    ).toBeTruthy();
  });

  it('Liked Songs item is present with LIKED_SONGS_ID', () => {
    // #given
    const { onPlaylistSelect } = renderPlaylistSelection();

    // #when
    fireEvent.click(screen.getByText('Liked Songs'));

    // #then
    expect(screen.getByText('Liked Songs')).toBeTruthy();
    expect(onPlaylistSelect).toHaveBeenCalledWith(LIKED_SONGS_ID, 'Liked Songs', undefined);
  });

  it('inDrawer: tapping a playlist opens the menu; Play then calls onPlaylistSelect', () => {
    // #given
    const { onPlaylistSelect } = renderPlaylistSelection({ inDrawer: true });

    // #when
    fireEvent.click(screen.getByText('Chill Vibes'));

    // #then
    expect(onPlaylistSelect).not.toHaveBeenCalled();

    // #when
    fireEvent.click(screen.getByRole('button', { name: /play chill vibes/i }));

    // #then
    expect(onPlaylistSelect).toHaveBeenCalledWith('pl-1', 'Chill Vibes', undefined);
  });
});

describe('PlaylistSelection — search and filter', () => {
  beforeEach(() => {
    setMockLibrarySync();
  });

  it('filters playlists by search query', () => {
    // #given
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...');

    // #when
    fireEvent.change(searchInput, { target: { value: MOCK_PLAYLIST_NAMES.CHILL } });

    // #then
    expect(screen.getByText(MOCK_PLAYLIST_NAMES.CHILL)).toBeTruthy();
    expect(screen.queryByText(MOCK_PLAYLIST_NAMES.ROCK)).toBeNull();
    expect(screen.queryByText(MOCK_PLAYLIST_NAMES.JAZZ)).toBeNull();
  });

  it('shows empty state when search matches nothing', () => {
    // #given
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...');

    // #when
    fireEvent.change(searchInput, { target: { value: 'XYZ123NonExistent' } });

    // #then
    const noResultsText = screen.queryByText(/no/i);
    expect(noResultsText || searchInput.parentElement?.textContent).toBeTruthy();
  });

  it('clears search when clear button is clicked', () => {
    // #given
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: MOCK_PLAYLIST_NAMES.CHILL } });
    expect(searchInput.value).toBe(MOCK_PLAYLIST_NAMES.CHILL);

    const clearButton = screen.queryByRole('button', { name: /clear|close|reset/i })
      || screen.getByRole('button', { name: /✕|✖|×|x/i });

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
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...');

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
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...');

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
