/**
 * Tests for LibraryRoute — sub-route navigation, liked fallback, album encoding (#1294).
 * Supplements the existing LibraryRoute.test.tsx (layout shell tests).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: vi.fn(),
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
    onSelectCollection: (kind: string, id: string, name: string, provider?: string) => void;
  }) => (
    <div data-testid="home-view">
      <button onClick={() => onNavigate('playlists')}>go-playlists</button>
      <button onClick={() => onNavigate('albums')}>go-albums</button>
      <button onClick={() => onNavigate('liked')}>go-liked</button>
      <button onClick={() => onSelectCollection('album', 'a1', 'Dark Side', 'spotify')}>select-album</button>
      <button onClick={() => onSelectCollection('playlist', 'p1', 'Chill', 'spotify')}>select-playlist</button>
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
  onPlaylistSelect: vi.fn(),
  onOpenSettings: vi.fn(),
  lastSession: null,
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

  it('falls back to HomeView when navigating to "liked" (no SeeAll page)', () => {
    // #given
    render(<LibraryRoute {...baseProps} />);

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'go-liked' }));

    // #then — "liked" has no SeeAll; LibraryRoute renders HomeView defensively
    expect(screen.getByTestId('home-view')).toBeInTheDocument();
    expect(screen.queryByTestId('see-all-view-liked')).not.toBeInTheDocument();
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

  it('calls onPlaylistSelect with toAlbumPlaylistId encoding for album selection', () => {
    // #given
    const onPlaylistSelect = vi.fn();
    render(<LibraryRoute {...baseProps} onPlaylistSelect={onPlaylistSelect} />);

    // #when — select an album
    fireEvent.click(screen.getByRole('button', { name: 'select-album' }));

    // #then — album id must be encoded via toAlbumPlaylistId
    expect(onPlaylistSelect).toHaveBeenCalledTimes(1);
    const [playlistId, name, provider] = onPlaylistSelect.mock.calls[0];
    expect(playlistId).toMatch(/album/i); // toAlbumPlaylistId wraps with "album:" prefix
    expect(name).toBe('Dark Side');
    expect(provider).toBe('spotify');
  });

  it('calls onPlaylistSelect with plain id for playlist selection', () => {
    // #given
    const onPlaylistSelect = vi.fn();
    render(<LibraryRoute {...baseProps} onPlaylistSelect={onPlaylistSelect} />);

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'select-playlist' }));

    // #then
    expect(onPlaylistSelect).toHaveBeenCalledWith('p1', 'Chill', 'spotify');
  });
});
