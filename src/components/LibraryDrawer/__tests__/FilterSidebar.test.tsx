import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { FilterSidebar } from '../FilterSidebar';
import type { RecentlyPlayedEntry } from '@/hooks/useRecentlyPlayedCollections';

function renderFilterSidebar(props = {}) {
  const defaultProps = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    viewMode: 'playlists' as const,
    onViewModeChange: vi.fn(),
    enabledProviderIds: [] as const,
    selectedProviderIds: [] as const,
    onProviderToggle: vi.fn(),
    showProviderFilter: false,
    availableGenres: [] as string[],
    selectedGenres: [] as string[],
    onGenreToggle: vi.fn(),
    recentlyPlayed: [] as RecentlyPlayedEntry[],
    onRecentlyPlayedSelect: vi.fn(),
    playlistSort: 'recently-added' as const,
    setPlaylistSort: vi.fn(),
    albumSort: 'recently-added' as const,
    setAlbumSort: vi.fn(),
    hasActiveFilters: false,
    onClearFilters: vi.fn(),
    ...props,
  };

  return render(
    <ThemeProvider theme={theme}>
      <FilterSidebar {...defaultProps} />
    </ThemeProvider>
  );
}

describe('FilterSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders collection type toggle buttons', () => {
    // #given
    renderFilterSidebar({ viewMode: 'playlists' });

    // #when
    const playlistsBtn = screen.getByRole('button', { name: 'Playlists' });
    const albumsBtn = screen.getByRole('button', { name: 'Albums' });

    // #then
    expect(playlistsBtn).toBeInTheDocument();
    expect(albumsBtn).toBeInTheDocument();
  });

  it('highlights active collection type', () => {
    // #given
    renderFilterSidebar({ viewMode: 'albums' });

    // #when
    const albumsBtn = screen.getByRole('button', { name: 'Albums' });

    // #then
    expect(albumsBtn).toBeInTheDocument();
  });

  it('calls onViewModeChange when clicking playlists button', () => {
    // #given
    const onViewModeChange = vi.fn();
    renderFilterSidebar({
      viewMode: 'albums',
      onViewModeChange,
    });

    // #when
    const playlistsBtn = screen.getByRole('button', { name: 'Playlists' });
    fireEvent.click(playlistsBtn);

    // #then
    expect(onViewModeChange).toHaveBeenCalledWith('playlists');
  });

  it('calls onViewModeChange when clicking albums button', () => {
    // #given
    const onViewModeChange = vi.fn();
    renderFilterSidebar({
      viewMode: 'playlists',
      onViewModeChange,
    });

    // #when
    const albumsBtn = screen.getByRole('button', { name: 'Albums' });
    fireEvent.click(albumsBtn);

    // #then
    expect(onViewModeChange).toHaveBeenCalledWith('albums');
  });

  it('does not render provider filter when showProviderFilter is false', () => {
    // #given
    renderFilterSidebar({
      showProviderFilter: false,
      enabledProviderIds: ['spotify', 'dropbox'],
    });

    // #when
    const providers = screen.queryAllByLabelText(/Filter by/);

    // #then
    expect(providers).toHaveLength(0);
  });

  it('renders provider filter chips when showProviderFilter is true', () => {
    // #given
    renderFilterSidebar({
      showProviderFilter: true,
      enabledProviderIds: ['spotify', 'dropbox'],
      selectedProviderIds: [],
    });

    // #when
    const spotifyChip = screen.getByLabelText('Filter by spotify');
    const dropboxChip = screen.getByLabelText('Filter by dropbox');

    // #then
    expect(spotifyChip).toBeInTheDocument();
    expect(dropboxChip).toBeInTheDocument();
  });

  it('calls onProviderToggle with provider id when clicking a provider chip', () => {
    // #given
    const onProviderToggle = vi.fn();
    renderFilterSidebar({
      showProviderFilter: true,
      enabledProviderIds: ['spotify', 'dropbox'],
      selectedProviderIds: [],
      onProviderToggle,
    });

    // #when
    fireEvent.click(screen.getByLabelText('Filter by spotify'));

    // #then
    expect(onProviderToggle).toHaveBeenCalledWith('spotify');
  });

  it('does not render Clear Filters button when hasActiveFilters is false', () => {
    // #given
    renderFilterSidebar({ hasActiveFilters: false });

    // #when
    const clearBtn = screen.queryByRole('button', { name: 'Clear Filters' });

    // #then
    expect(clearBtn).not.toBeInTheDocument();
  });

  it('renders Clear Filters button when hasActiveFilters is true', () => {
    // #given
    renderFilterSidebar({ hasActiveFilters: true });

    // #when
    const clearBtn = screen.queryByRole('button', { name: 'Clear Filters' });

    // #then
    expect(clearBtn).toBeInTheDocument();
  });

  it('calls onClearFilters when clicking Clear Filters', () => {
    // #given
    const onClearFilters = vi.fn();
    renderFilterSidebar({
      hasActiveFilters: true,
      onClearFilters,
    });

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));

    // #then
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('shows every provider chip as active when no filter is set', () => {
    // #given
    renderFilterSidebar({
      showProviderFilter: true,
      enabledProviderIds: ['spotify', 'dropbox'],
      selectedProviderIds: [],
    });

    // #when
    const spotifyChip = screen.getByLabelText('Filter by spotify');
    const dropboxChip = screen.getByLabelText('Filter by dropbox');

    // #then
    expect(spotifyChip).toHaveAttribute('aria-pressed', 'true');
    expect(dropboxChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows only selected provider chips as active when filter is non-empty', () => {
    // #given
    renderFilterSidebar({
      showProviderFilter: true,
      enabledProviderIds: ['spotify', 'dropbox'],
      selectedProviderIds: ['spotify'],
    });

    // #when
    const spotifyChip = screen.getByLabelText('Filter by spotify');
    const dropboxChip = screen.getByLabelText('Filter by dropbox');

    // #then
    expect(spotifyChip).toHaveAttribute('aria-pressed', 'true');
    expect(dropboxChip).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows every genre chip as active when no genre is selected', () => {
    // #given
    renderFilterSidebar({
      availableGenres: ['rock', 'pop'],
      selectedGenres: [],
    });

    // #when
    const rockChip = screen.getByLabelText('Filter by genre: rock');
    const popChip = screen.getByLabelText('Filter by genre: pop');

    // #then
    expect(rockChip).toHaveAttribute('aria-pressed', 'true');
    expect(popChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows only selected genre chips as active when filter is non-empty', () => {
    // #given
    renderFilterSidebar({
      availableGenres: ['rock', 'pop'],
      selectedGenres: ['rock'],
    });

    // #when
    const rockChip = screen.getByLabelText('Filter by genre: rock');
    const popChip = screen.getByLabelText('Filter by genre: pop');

    // #then
    expect(rockChip).toHaveAttribute('aria-pressed', 'true');
    expect(popChip).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onGenreToggle with genre when clicking a genre chip', () => {
    // #given
    const onGenreToggle = vi.fn();
    renderFilterSidebar({
      availableGenres: ['rock', 'pop'],
      selectedGenres: [],
      onGenreToggle,
    });

    // #when
    fireEvent.click(screen.getByLabelText('Filter by genre: rock'));

    // #then
    expect(onGenreToggle).toHaveBeenCalledWith('rock');
  });

  it('does not render an "All genres" pseudo-row when a genre is selected', () => {
    // #given
    renderFilterSidebar({
      availableGenres: ['rock', 'pop'],
      selectedGenres: ['rock'],
    });

    // #when
    const allGenres = screen.queryByLabelText('Show all genres');

    // #then
    expect(allGenres).not.toBeInTheDocument();
  });

  describe('Recently Played section', () => {
    const entries: RecentlyPlayedEntry[] = [
      { ref: { provider: 'spotify', kind: 'playlist', id: 'p-1' }, name: 'Chill Mix' },
      { ref: { provider: 'dropbox', kind: 'album', id: 'a-1' }, name: 'Rumours' },
      { ref: { provider: 'spotify', kind: 'liked' }, name: 'Liked Songs' },
    ];

    it('does not render the section when history is empty', () => {
      // #when
      renderFilterSidebar({ recentlyPlayed: [] });

      // #then
      expect(screen.queryByText('Recently Played')).not.toBeInTheDocument();
    });

    it('renders the section header when history has entries', () => {
      // #when
      renderFilterSidebar({ recentlyPlayed: entries });

      // #then
      expect(screen.getByText('Recently Played')).toBeInTheDocument();
    });

    it('renders one clickable shortcut per entry (up to 5)', () => {
      // #when
      renderFilterSidebar({ recentlyPlayed: entries });

      // #then
      expect(screen.getByRole('button', { name: 'Play Chill Mix' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Play Rumours' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Play Liked Songs' })).toBeInTheDocument();
    });

    it('caps the rendered list at 5 entries', () => {
      // #given
      const six: RecentlyPlayedEntry[] = Array.from({ length: 6 }, (_, i) => ({
        ref: { provider: 'spotify', kind: 'playlist', id: `p-${i}` },
        name: `Playlist ${i}`,
      }));

      // #when
      renderFilterSidebar({ recentlyPlayed: six });

      // #then
      for (let i = 0; i < 5; i++) {
        expect(screen.getByRole('button', { name: `Play Playlist ${i}` })).toBeInTheDocument();
      }
      expect(screen.queryByRole('button', { name: 'Play Playlist 5' })).not.toBeInTheDocument();
    });

    it('renders a thumbnail image when an entry has an imageUrl', () => {
      // #given
      const withImage: RecentlyPlayedEntry[] = [{
        ref: { provider: 'spotify', kind: 'playlist', id: 'p-img' },
        name: 'With Cover',
        imageUrl: 'https://cdn.example/cover.jpg',
      }];

      // #when
      renderFilterSidebar({ recentlyPlayed: withImage });

      // #then
      const button = screen.getByRole('button', { name: 'Play With Cover' });
      const img = button.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBe('https://cdn.example/cover.jpg');
    });

    it('renders a placeholder when an entry has no imageUrl', () => {
      // #given
      const noImage: RecentlyPlayedEntry[] = [{
        ref: { provider: 'spotify', kind: 'liked' },
        name: 'No Cover',
      }];

      // #when
      renderFilterSidebar({ recentlyPlayed: noImage });

      // #then
      const button = screen.getByRole('button', { name: 'Play No Cover' });
      expect(button.querySelector('img')).toBeNull();
      expect(button.querySelector('svg')).not.toBeNull();
    });

    it('calls onRecentlyPlayedSelect with the entry when a shortcut is clicked', () => {
      // #given
      const onRecentlyPlayedSelect = vi.fn();
      renderFilterSidebar({ recentlyPlayed: entries, onRecentlyPlayedSelect });

      // #when
      fireEvent.click(screen.getByRole('button', { name: 'Play Chill Mix' }));

      // #then
      expect(onRecentlyPlayedSelect).toHaveBeenCalledWith(entries[0]);
    });
  });
});
