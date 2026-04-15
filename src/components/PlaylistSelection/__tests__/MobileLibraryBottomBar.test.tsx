import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { MobileLibraryBottomBar } from '../MobileLibraryBottomBar';
import {
  LibraryBrowsingProvider,
  type LibraryBrowsingContextValue,
} from '../LibraryContext';
import type {
  AlbumSortOption,
  PlaylistSortOption,
  RecentlyAddedFilterOption,
} from '@/utils/playlistFilters';
import type { ProviderId } from '@/types/domain';

interface HarnessOverrides {
  initialViewMode?: 'playlists' | 'albums';
  initialSearchQuery?: string;
  initialPlaylistSort?: PlaylistSortOption;
  initialAlbumSort?: AlbumSortOption;
}

function BrowsingStateHarness({
  initialViewMode = 'playlists',
  initialSearchQuery = '',
  initialPlaylistSort = 'recently-added',
  initialAlbumSort = 'recently-added',
  children,
}: HarnessOverrides & { children: React.ReactNode }): React.ReactElement {
  const [viewMode, setViewMode] = useState<'playlists' | 'albums'>(initialViewMode);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
  const [playlistSort, setPlaylistSort] = useState<PlaylistSortOption>(initialPlaylistSort);
  const [albumSort, setAlbumSort] = useState<AlbumSortOption>(initialAlbumSort);
  const [artistFilter, setArtistFilter] = useState<string>('');
  const [providerFilters, setProviderFilters] = useState<ProviderId[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [recentlyAddedFilter, setRecentlyAddedFilter] =
    useState<RecentlyAddedFilterOption>('all');

  const value: LibraryBrowsingContextValue = {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    playlistSort,
    setPlaylistSort,
    albumSort,
    setAlbumSort,
    artistFilter,
    setArtistFilter,
    providerFilters,
    setProviderFilters,
    handleProviderToggle: () => undefined,
    availableGenres: [],
    selectedGenres,
    setSelectedGenres,
    recentlyAddedFilter,
    setRecentlyAddedFilter,
    hasActiveFilters: false,
  };

  return (
    <ThemeProvider theme={theme}>
      <LibraryBrowsingProvider value={value}>{children}</LibraryBrowsingProvider>
    </ThemeProvider>
  );
}

function getSearchInput(): HTMLInputElement {
  return screen.getByRole('textbox', {
    name: /search playlists and albums/i,
  }) as HTMLInputElement;
}

describe('MobileLibraryBottomBar', () => {
  describe('search input', () => {
    it('updates searchQuery state when the user types', () => {
      // #when
      render(
        <BrowsingStateHarness>
          <MobileLibraryBottomBar />
        </BrowsingStateHarness>,
      );
      const input = getSearchInput();
      fireEvent.change(input, { target: { value: 'foo' } });

      // #then
      expect(input.value).toBe('foo');
    });

    it('initialises from the provided searchQuery value', () => {
      // #when
      render(
        <BrowsingStateHarness initialSearchQuery="chill">
          <MobileLibraryBottomBar />
        </BrowsingStateHarness>,
      );

      // #then
      expect(getSearchInput().value).toBe('chill');
    });
  });

  describe('clear button', () => {
    it('is hidden while the search query is empty', () => {
      // #when
      render(
        <BrowsingStateHarness>
          <MobileLibraryBottomBar />
        </BrowsingStateHarness>,
      );

      // #then
      expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull();
    });

    it('clears the search input when clicked', () => {
      // #given
      render(
        <BrowsingStateHarness initialSearchQuery="rock">
          <MobileLibraryBottomBar />
        </BrowsingStateHarness>,
      );
      const input = getSearchInput();
      expect(input.value).toBe('rock');

      // #when
      fireEvent.click(screen.getByRole('button', { name: /clear search/i }));

      // #then
      expect(input.value).toBe('');
      expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull();
    });
  });

  describe('sort dropdown', () => {
    it('renders the playlist sort selector when viewMode is playlists', () => {
      // #when
      render(
        <BrowsingStateHarness initialViewMode="playlists">
          <MobileLibraryBottomBar />
        </BrowsingStateHarness>,
      );

      // #then
      expect(screen.getByLabelText(/sort playlists/i)).toBeTruthy();
      expect(screen.queryByLabelText(/sort albums/i)).toBeNull();
    });

    it('renders the album sort selector when viewMode is albums', () => {
      // #when
      render(
        <BrowsingStateHarness initialViewMode="albums">
          <MobileLibraryBottomBar />
        </BrowsingStateHarness>,
      );

      // #then
      expect(screen.getByLabelText(/sort albums/i)).toBeTruthy();
      expect(screen.queryByLabelText(/sort playlists/i)).toBeNull();
    });

    it('updates playlistSort when a new playlist option is selected', () => {
      // #given
      render(
        <BrowsingStateHarness initialViewMode="playlists">
          <MobileLibraryBottomBar />
        </BrowsingStateHarness>,
      );
      const select = screen.getByLabelText(/sort playlists/i) as HTMLSelectElement;
      expect(select.value).toBe('recently-added');

      // #when
      fireEvent.change(select, { target: { value: 'name-asc' } });

      // #then
      expect(select.value).toBe('name-asc');
    });

    it('updates albumSort when a new album option is selected', () => {
      // #given
      render(
        <BrowsingStateHarness initialViewMode="albums">
          <MobileLibraryBottomBar />
        </BrowsingStateHarness>,
      );
      const select = screen.getByLabelText(/sort albums/i) as HTMLSelectElement;
      expect(select.value).toBe('recently-added');

      // #when
      fireEvent.change(select, { target: { value: 'artist-asc' } });

      // #then
      expect(select.value).toBe('artist-asc');
    });

    it('leaves playlistSort unchanged when switching album sort in albums view', () => {
      // #given
      render(
        <BrowsingStateHarness initialViewMode="albums" initialPlaylistSort="name-desc">
          <MobileLibraryBottomBar />
        </BrowsingStateHarness>,
      );
      const albumSelect = screen.getByLabelText(/sort albums/i) as HTMLSelectElement;

      // #when
      fireEvent.change(albumSelect, { target: { value: 'release-newest' } });

      // #then
      expect(albumSelect.value).toBe('release-newest');
    });
  });
});
