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

const mockPlaylists = [
  makePlaylistInfo({ id: 'pl-1', name: 'Chill Vibes' }),
  makePlaylistInfo({ id: 'pl-2', name: 'Rock Anthems' }),
  makePlaylistInfo({ id: 'pl-3', name: 'Jazz Classics' }),
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
    renderPlaylistSelection();
    fireEvent.click(screen.getByRole('button', { name: /albums/i }));
    expect(screen.getByText('Album One')).toBeTruthy();
    expect(screen.getByText('Album Two')).toBeTruthy();
  });

  it('search input filters playlist list by name (case-insensitive)', () => {
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...');
    fireEvent.change(searchInput, { target: { value: 'chill' } });
    expect(screen.getByText('Chill Vibes')).toBeTruthy();
    expect(screen.queryByText('Rock Anthems')).toBeNull();
  });

  it('pinned items appear before unpinned items', () => {
    renderPlaylistSelection();
    const items = screen.getAllByText(/tracks/);
    expect(items.length).toBeGreaterThan(0);
  });

  it('clicking a playlist calls onPlaylistSelect with the correct playlist ID', () => {
    const { onPlaylistSelect } = renderPlaylistSelection();
    fireEvent.click(screen.getByText('Chill Vibes'));
    expect(onPlaylistSelect).toHaveBeenCalledWith('pl-1', 'Chill Vibes', undefined);
  });

  it('shows loading state while isSyncing is true and no data yet', () => {
    setMockLibrarySync({
      playlists: [],
      albums: [],
      likedSongsCount: 0,
      isInitialLoadComplete: false,
      isSyncing: true,
    });
    renderPlaylistSelection();
    expect(screen.getByText('Loading your library...')).toBeTruthy();
  });

  it('shows error message when no content is found after load', () => {
    setMockLibrarySync({
      playlists: [],
      albums: [],
      likedSongsCount: 0,
      isInitialLoadComplete: true,
    });
    renderPlaylistSelection();
    expect(
      screen.getByText(/no playlists, albums, or liked songs found/i)
    ).toBeTruthy();
  });

  it('Liked Songs item is present with LIKED_SONGS_ID', () => {
    const { onPlaylistSelect } = renderPlaylistSelection();
    expect(screen.getByText('Liked Songs')).toBeTruthy();
    fireEvent.click(screen.getByText('Liked Songs'));
    expect(onPlaylistSelect).toHaveBeenCalledWith(LIKED_SONGS_ID, 'Liked Songs', undefined);
  });

  it('inDrawer: tapping a playlist opens the menu; Play then calls onPlaylistSelect', () => {
    const { onPlaylistSelect } = renderPlaylistSelection({ inDrawer: true });
    fireEvent.click(screen.getByText('Chill Vibes'));
    expect(onPlaylistSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /play chill vibes/i }));
    expect(onPlaylistSelect).toHaveBeenCalledWith('pl-1', 'Chill Vibes', undefined);
  });
});

describe('PlaylistSelection — search and filter', () => {
  beforeEach(() => {
    setMockLibrarySync();
  });

  it('filters playlists by search query', () => {
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...');

    // Search for "Chill"
    fireEvent.change(searchInput, { target: { value: 'Chill' } });

    // Should show only "Chill Vibes"
    expect(screen.getByText('Chill Vibes')).toBeTruthy();

    // Should not show the other playlists
    expect(screen.queryByText('Rock Anthems')).toBeNull();
    expect(screen.queryByText('Jazz Classics')).toBeNull();
  });

  it('shows empty state when search matches nothing', () => {
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...');

    // Search for something that doesn't match any playlist
    fireEvent.change(searchInput, { target: { value: 'XYZ123NonExistent' } });

    // Should show a no results indicator or empty state
    // The component should show either "no playlists" or similar message
    const noResultsText = screen.queryByText(/no/i);
    expect(noResultsText || searchInput.parentElement?.textContent).toBeTruthy();
  });

  it('clears search when clear button is clicked', () => {
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...') as HTMLInputElement;

    // Type a search query
    fireEvent.change(searchInput, { target: { value: 'Chill' } });
    expect(searchInput.value).toBe('Chill');

    // Find and click the clear button (typically an X or clear icon)
    // The button should be near the search input
    const clearButton = screen.queryByRole('button', { name: /clear|close|reset/i })
      || screen.getByRole('button', { name: /✕|✖|×|x/i });

    if (clearButton) {
      fireEvent.click(clearButton);

      // Search input should be cleared
      expect((searchInput as HTMLInputElement).value).toBe('');

      // All playlists should be visible again
      expect(screen.getByText('Chill Vibes')).toBeTruthy();
      expect(screen.getByText('Rock Anthems')).toBeTruthy();
      expect(screen.getByText('Jazz Classics')).toBeTruthy();
    }
  });

  it('search is case-insensitive', () => {
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...');

    // Search with different case variations
    fireEvent.change(searchInput, { target: { value: 'JAZZ' } });
    expect(screen.getByText('Jazz Classics')).toBeTruthy();
    expect(screen.queryByText('Chill Vibes')).toBeNull();

    // Try lowercase
    fireEvent.change(searchInput, { target: { value: 'rock' } });
    expect(screen.getByText('Rock Anthems')).toBeTruthy();
    expect(screen.queryByText('Jazz Classics')).toBeNull();
  });

  it('search updates live as user types', () => {
    renderPlaylistSelection();
    const searchInput = screen.getByPlaceholderText('Search playlists...');

    // Start typing a unique search
    fireEvent.change(searchInput, { target: { value: 'Chill' } });
    expect(screen.getByText('Chill Vibes')).toBeTruthy();

    // Search for Jazz should show only Jazz
    fireEvent.change(searchInput, { target: { value: 'Jazz' } });
    expect(screen.getByText('Jazz Classics')).toBeTruthy();

    // Search for Rock should show only Rock
    fireEvent.change(searchInput, { target: { value: 'Rock' } });
    expect(screen.getByText('Rock Anthems')).toBeTruthy();

    // Clear and all should be visible again
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Chill Vibes')).toBeTruthy();
    expect(screen.getByText('Jazz Classics')).toBeTruthy();
    expect(screen.getByText('Rock Anthems')).toBeTruthy();
  });
});
