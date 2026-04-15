import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { FilterSidebar } from '../FilterSidebar';

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
    recentlyAdded: 'all' as const,
    onRecentlyAddedChange: vi.fn(),
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

  it('renders recently added section with all time options', () => {
    // #when
    renderFilterSidebar({ recentlyAdded: 'all' });

    // #then
    expect(screen.getByRole('button', { name: 'All time' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last year' })).toBeInTheDocument();
  });

  it('calls onRecentlyAddedChange when clicking a time range option', () => {
    // #given
    const onRecentlyAddedChange = vi.fn();
    renderFilterSidebar({ recentlyAdded: 'all', onRecentlyAddedChange });

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 days' }));

    // #then
    expect(onRecentlyAddedChange).toHaveBeenCalledWith('30-days');
  });
});
