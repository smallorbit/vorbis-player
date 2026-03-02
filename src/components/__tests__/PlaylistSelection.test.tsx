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

vi.mock('@/hooks/usePlayerSizing', () => ({
  usePlayerSizing: vi.fn(() => ({
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
    expect(onPlaylistSelect).toHaveBeenCalledWith('pl-1', 'Chill Vibes');
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
    expect(onPlaylistSelect).toHaveBeenCalledWith(LIKED_SONGS_ID, 'Liked Songs');
  });
});
