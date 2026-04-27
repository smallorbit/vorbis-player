/**
 * Edge-case tests for FilterSheet.
 *
 * Covers:
 *  - Provider checkboxes only render when enabledProviderIds.length > 1
 *  - Each enabled provider gets a checkbox with provider-specific testid
 *  - Toggling a provider checkbox calls search.toggleProvider with that id
 *  - Toggling kind checkbox calls search.toggleKind
 *  - Sort select reflects search.sort and forwards changes via setSort
 *  - Clear-all is disabled when neither hasActiveFilters nor isSearching
 *  - Clear-all is enabled when isSearching even without filters
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import type { LibrarySearchState } from '../useLibrarySearch';
import type { ProviderId } from '@/types/domain';

const { mockProviderCtx } = vi.hoisted(() => ({
  mockProviderCtx: vi.fn(),
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: () => mockProviderCtx(),
}));

import FilterSheet from '../FilterSheet';

function makeSearch(overrides: Partial<LibrarySearchState> = {}): LibrarySearchState {
  return {
    query: '',
    setQuery: vi.fn(),
    providerFilter: [],
    setProviderFilter: vi.fn(),
    toggleProvider: vi.fn(),
    kindFilter: [],
    setKindFilter: vi.fn(),
    toggleKind: vi.fn(),
    sort: 'recent',
    setSort: vi.fn(),
    isSearching: false,
    hasActiveFilters: false,
    clearAll: vi.fn(),
    ...overrides,
  };
}

function renderSheet(
  searchOverrides: Partial<LibrarySearchState> = {},
  providerCtx: { enabledProviderIds: ProviderId[]; hasMultipleProviders?: boolean } = {
    enabledProviderIds: ['spotify'],
  },
) {
  mockProviderCtx.mockReturnValue(providerCtx);
  const search = makeSearch(searchOverrides);
  const result = render(
    <ThemeProvider theme={theme}>
      <FilterSheet open onOpenChange={vi.fn()} search={search} />
    </ThemeProvider>,
  );
  return { ...result, search };
}

describe('FilterSheet edges', () => {
  describe('provider checkboxes — single-provider hides Source group', () => {
    it('does NOT render provider checkboxes when only 1 provider enabled', () => {
      // #given/when
      renderSheet({}, { enabledProviderIds: ['spotify'] });

      // #then
      expect(screen.queryByTestId('library-filter-provider-spotify')).toBeNull();
    });

    it('renders one checkbox per enabled provider when 2+ providers enabled', () => {
      // #given/when
      renderSheet({}, { enabledProviderIds: ['spotify', 'dropbox'] });

      // #then
      expect(screen.getByTestId('library-filter-provider-spotify')).toBeInTheDocument();
      expect(screen.getByTestId('library-filter-provider-dropbox')).toBeInTheDocument();
    });

    it('checkbox checked state reflects providerFilter contents', () => {
      // #given/when
      renderSheet(
        { providerFilter: ['spotify'] },
        { enabledProviderIds: ['spotify', 'dropbox'] },
      );

      // #then
      const spotifyCheck = screen.getByTestId(
        'library-filter-provider-spotify',
      ) as HTMLInputElement;
      const dropboxCheck = screen.getByTestId(
        'library-filter-provider-dropbox',
      ) as HTMLInputElement;
      expect(spotifyCheck.checked).toBe(true);
      expect(dropboxCheck.checked).toBe(false);
    });

    it('toggling provider checkbox calls search.toggleProvider with the id', () => {
      // #given
      const toggleProvider = vi.fn();
      renderSheet(
        { toggleProvider },
        { enabledProviderIds: ['spotify', 'dropbox'] },
      );

      // #when
      fireEvent.click(screen.getByTestId('library-filter-provider-dropbox'));

      // #then
      expect(toggleProvider).toHaveBeenCalledWith('dropbox');
    });
  });

  describe('kind checkboxes', () => {
    it('renders both playlist and album kind checkboxes', () => {
      // #given/when
      renderSheet();

      // #then
      expect(screen.getByTestId('library-filter-kind-playlist')).toBeInTheDocument();
      expect(screen.getByTestId('library-filter-kind-album')).toBeInTheDocument();
    });

    it('toggling kind checkbox calls search.toggleKind', () => {
      // #given
      const toggleKind = vi.fn();
      renderSheet({ toggleKind });

      // #when
      fireEvent.click(screen.getByTestId('library-filter-kind-album'));

      // #then
      expect(toggleKind).toHaveBeenCalledWith('album');
    });
  });

  describe('sort select', () => {
    it('reflects current sort value', () => {
      // #given/when
      renderSheet({ sort: 'name-desc' });

      // #then
      const select = screen.getByTestId('library-filter-sort') as HTMLSelectElement;
      expect(select.value).toBe('name-desc');
    });

    it('forwards changes via setSort', () => {
      // #given
      const setSort = vi.fn();
      renderSheet({ setSort });
      const select = screen.getByTestId('library-filter-sort') as HTMLSelectElement;

      // #when
      fireEvent.change(select, { target: { value: 'name-asc' } });

      // #then
      expect(setSort).toHaveBeenCalledWith('name-asc');
    });
  });

  describe('Clear all button', () => {
    it('is disabled when neither hasActiveFilters nor isSearching', () => {
      // #given/when
      renderSheet({ hasActiveFilters: false, isSearching: false });

      // #then
      const btn = screen.getByTestId('library-filter-clear') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('is enabled when only isSearching (no filters)', () => {
      // #given/when
      renderSheet({ hasActiveFilters: false, isSearching: true });

      // #then
      const btn = screen.getByTestId('library-filter-clear') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('is enabled when only hasActiveFilters (no query)', () => {
      // #given/when
      renderSheet({ hasActiveFilters: true, isSearching: false });

      // #then
      const btn = screen.getByTestId('library-filter-clear') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('clicking clear-all calls search.clearAll', () => {
      // #given
      const clearAll = vi.fn();
      renderSheet({ hasActiveFilters: true, clearAll });

      // #when
      fireEvent.click(screen.getByTestId('library-filter-clear'));

      // #then
      expect(clearAll).toHaveBeenCalledTimes(1);
    });
  });
});
