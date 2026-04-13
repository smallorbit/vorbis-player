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
    collectionType: 'playlists' as const,
    onCollectionTypeChange: vi.fn(),
    enabledProviderIds: [] as const,
    selectedProviderIds: [] as const,
    onProviderFilterChange: vi.fn(),
    showProviderFilter: false,
    availableGenres: [] as string[],
    selectedGenres: [] as string[],
    onGenreChange: vi.fn(),
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
    renderFilterSidebar({ collectionType: 'playlists' });

    // #when
    const playlistsBtn = screen.getByRole('button', { name: 'Playlists' });
    const albumsBtn = screen.getByRole('button', { name: 'Albums' });

    // #then
    expect(playlistsBtn).toBeInTheDocument();
    expect(albumsBtn).toBeInTheDocument();
  });

  it('highlights active collection type', () => {
    // #given
    renderFilterSidebar({ collectionType: 'albums' });

    // #when
    const albumsBtn = screen.getByRole('button', { name: 'Albums' });

    // #then
    expect(albumsBtn).toBeInTheDocument();
  });

  it('calls onCollectionTypeChange when clicking playlists button', () => {
    // #given
    const onCollectionTypeChange = vi.fn();
    renderFilterSidebar({
      collectionType: 'albums',
      onCollectionTypeChange,
    });

    // #when
    const playlistsBtn = screen.getByRole('button', { name: 'Playlists' });
    fireEvent.click(playlistsBtn);

    // #then
    expect(onCollectionTypeChange).toHaveBeenCalledWith('playlists');
  });

  it('calls onCollectionTypeChange when clicking albums button', () => {
    // #given
    const onCollectionTypeChange = vi.fn();
    renderFilterSidebar({
      collectionType: 'playlists',
      onCollectionTypeChange,
    });

    // #when
    const albumsBtn = screen.getByRole('button', { name: 'Albums' });
    fireEvent.click(albumsBtn);

    // #then
    expect(onCollectionTypeChange).toHaveBeenCalledWith('albums');
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

  it('renders provider filter checkboxes when showProviderFilter is true', () => {
    // #given
    renderFilterSidebar({
      showProviderFilter: true,
      enabledProviderIds: ['spotify', 'dropbox'],
      selectedProviderIds: [],
    });

    // #when
    const spotifyCheckbox = screen.getByLabelText('Filter by spotify');
    const dropboxCheckbox = screen.getByLabelText('Filter by dropbox');

    // #then
    expect(spotifyCheckbox).toBeInTheDocument();
    expect(dropboxCheckbox).toBeInTheDocument();
  });

  it('toggles provider when clicking provider checkbox', () => {
    // #given
    const onProviderFilterChange = vi.fn();
    renderFilterSidebar({
      showProviderFilter: true,
      enabledProviderIds: ['spotify', 'dropbox'],
      selectedProviderIds: [],
      onProviderFilterChange,
    });

    // #when
    const spotifyCheckbox = screen.getByLabelText('Filter by spotify');
    fireEvent.click(spotifyCheckbox);

    // #then
    expect(onProviderFilterChange).toHaveBeenCalled();
  });

  it('does not render Clear Filters button when no filters are active', () => {
    // #given
    renderFilterSidebar({
      collectionType: 'playlists',
      selectedProviderIds: [],
    });

    // #when
    const clearBtn = screen.queryByRole('button', { name: 'Clear Filters' });

    // #then
    expect(clearBtn).not.toBeInTheDocument();
  });

  it('renders Clear Filters button when collection type is albums', () => {
    // #given
    renderFilterSidebar({
      collectionType: 'albums',
      selectedProviderIds: [],
    });

    // #when
    const clearBtn = screen.queryByRole('button', { name: 'Clear Filters' });

    // #then
    expect(clearBtn).toBeInTheDocument();
  });

  it('renders Clear Filters button when providers are filtered', () => {
    // #given
    renderFilterSidebar({
      collectionType: 'playlists',
      selectedProviderIds: ['spotify'],
    });

    // #when
    const clearBtn = screen.queryByRole('button', { name: 'Clear Filters' });

    // #then
    expect(clearBtn).toBeInTheDocument();
  });

  it('resets filters to default when clicking Clear Filters', () => {
    // #given
    const onCollectionTypeChange = vi.fn();
    const onProviderFilterChange = vi.fn();
    renderFilterSidebar({
      collectionType: 'albums',
      selectedProviderIds: ['spotify'],
      onCollectionTypeChange,
      onProviderFilterChange,
    });

    // #when
    const clearBtn = screen.getByRole('button', { name: 'Clear Filters' });
    fireEvent.click(clearBtn);

    // #then
    expect(onCollectionTypeChange).toHaveBeenCalledWith('playlists');
    expect(onProviderFilterChange).toHaveBeenCalledWith([]);
  });

  it('checks providers by default when no filter is active', () => {
    // #given
    renderFilterSidebar({
      showProviderFilter: true,
      enabledProviderIds: ['spotify', 'dropbox'],
      selectedProviderIds: [],
    });

    // #when
    const spotifyCheckbox = screen.getByLabelText('Filter by spotify') as HTMLInputElement;
    const dropboxCheckbox = screen.getByLabelText('Filter by dropbox') as HTMLInputElement;

    // #then
    expect(spotifyCheckbox.checked).toBe(true);
    expect(dropboxCheckbox.checked).toBe(true);
  });

  it('only checks selected providers when filter is active', () => {
    // #given
    renderFilterSidebar({
      showProviderFilter: true,
      enabledProviderIds: ['spotify', 'dropbox'],
      selectedProviderIds: ['spotify'],
    });

    // #when
    const spotifyCheckbox = screen.getByLabelText('Filter by spotify') as HTMLInputElement;
    const dropboxCheckbox = screen.getByLabelText('Filter by dropbox') as HTMLInputElement;

    // #then
    expect(spotifyCheckbox.checked).toBe(true);
    expect(dropboxCheckbox.checked).toBe(false);
  });
});
