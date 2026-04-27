/**
 * Edge-case tests for SearchResultsView.
 *
 * Covers:
 *  - Empty-state copy includes the (trimmed) query
 *  - kindFilter=['playlist'] hides the Albums section entirely
 *  - kindFilter=['album'] hides the Playlists section entirely
 *  - providerFilter excludes items from non-listed providers
 *  - Recently-Played section: 'liked' refs are filtered out (always)
 *  - Recently-Played section: 'album' ref is filtered out when kindFilter=['playlist']
 *  - onContextMenuRequest is forwarded to every rendered LibraryCard
 *  - Recently-Played 'liked' ref + recently-played re-render: liked entries never render
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import type { LibrarySearchState } from '../../search/useLibrarySearch';

const {
  mockPinnedSection,
  mockRecentlyPlayed,
  mockPlaylistsSection,
  mockAlbumsSection,
  mockProviderCtx,
} = vi.hoisted(() => ({
  mockPinnedSection: vi.fn(),
  mockRecentlyPlayed: vi.fn(),
  mockPlaylistsSection: vi.fn(),
  mockAlbumsSection: vi.fn(),
  mockProviderCtx: vi.fn(),
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: () => mockProviderCtx(),
}));

vi.mock('../../hooks', () => ({
  usePinnedSection: () => mockPinnedSection(),
  useRecentlyPlayedSection: () => mockRecentlyPlayed(),
  usePlaylistsSection: () => mockPlaylistsSection(),
  useAlbumsSection: () => mockAlbumsSection(),
}));

import SearchResultsView from '../SearchResultsView';

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
    isSearching: true,
    hasActiveFilters: false,
    clearAll: vi.fn(),
    ...overrides,
  };
}

function defaultMocks() {
  mockProviderCtx.mockReturnValue({ hasMultipleProviders: false });
  mockPinnedSection.mockReturnValue({ combined: [] });
  mockRecentlyPlayed.mockReturnValue({ items: [] });
  mockPlaylistsSection.mockReturnValue({ items: [] });
  mockAlbumsSection.mockReturnValue({ items: [] });
}

function renderView(
  searchOverrides: Partial<LibrarySearchState> = {},
  onContextMenuRequest = vi.fn(),
  onSelectCollection = vi.fn(),
) {
  const result = render(
    <ThemeProvider theme={theme}>
      <SearchResultsView
        search={makeSearch(searchOverrides)}
        onSelectCollection={onSelectCollection}
        onContextMenuRequest={onContextMenuRequest}
      />
    </ThemeProvider>,
  );
  return { ...result, onContextMenuRequest, onSelectCollection };
}

describe('SearchResultsView edges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  describe('empty state', () => {
    it('renders "No results for \\"<query>\\"" when nothing matches', () => {
      // #given — all sections empty, query non-empty
      // #when
      renderView({ query: 'nonexistent' });

      // #then
      expect(screen.getByTestId('library-search-results')).toBeInTheDocument();
      expect(screen.getByText(/No results for/)).toBeInTheDocument();
      expect(screen.getByText(/nonexistent/)).toBeInTheDocument();
    });

    it('trims the query in the empty-state message', () => {
      // #given
      // #when
      renderView({ query: '   spaces   ' });

      // #then — surrounding whitespace stripped
      expect(screen.getByText(/spaces/)).toBeInTheDocument();
      // The displayed query has no leading/trailing whitespace
      const empty = screen.getByText(/No results for/);
      // Component uses curly quotes (&ldquo; / &rdquo;)
      expect(empty.textContent).toContain('“spaces”');
      expect(empty.textContent).not.toContain('   spaces   ');
    });
  });

  describe('kindFilter exclusion', () => {
    it('kindFilter=["playlist"] hides the Albums section entirely', () => {
      // #given — both kinds present, only playlists pass filter
      mockPlaylistsSection.mockReturnValue({
        items: [{ id: 'p1', name: 'Playlist One', provider: 'spotify' }],
      });
      mockAlbumsSection.mockReturnValue({
        items: [{ id: 'a1', name: 'Album One', artists: 'Artist', provider: 'spotify' }],
      });

      // #when
      renderView({ query: 'one', kindFilter: ['playlist'] });

      // #then
      expect(screen.getByText('Playlists')).toBeInTheDocument();
      expect(screen.queryByText('Albums')).toBeNull();
    });

    it('kindFilter=["album"] hides the Playlists section entirely', () => {
      // #given
      mockPlaylistsSection.mockReturnValue({
        items: [{ id: 'p1', name: 'P One', provider: 'spotify' }],
      });
      mockAlbumsSection.mockReturnValue({
        items: [{ id: 'a1', name: 'A One', artists: 'A', provider: 'spotify' }],
      });

      // #when
      renderView({ query: 'one', kindFilter: ['album'] });

      // #then
      expect(screen.queryByText('Playlists')).toBeNull();
      expect(screen.getByText('Albums')).toBeInTheDocument();
    });
  });

  describe('providerFilter exclusion', () => {
    it('excludes items whose provider is not in the filter list', () => {
      // #given
      mockPlaylistsSection.mockReturnValue({
        items: [
          { id: 'p1', name: 'Match Spotify', provider: 'spotify' },
          { id: 'p2', name: 'Match Dropbox', provider: 'dropbox' },
        ],
      });

      // #when
      renderView({ query: 'match', providerFilter: ['spotify'] });

      // #then
      expect(screen.getByText('Match Spotify')).toBeInTheDocument();
      expect(screen.queryByText('Match Dropbox')).toBeNull();
    });
  });

  describe('Recently-played section semantics', () => {
    it("filters out 'liked' refs from Recently Played always", () => {
      // #given — recently-played has a liked entry that name-matches
      mockRecentlyPlayed.mockReturnValue({
        items: [
          {
            ref: { kind: 'liked', provider: 'spotify' },
            name: 'Liked Songs',
            imageUrl: null,
          },
          {
            ref: { kind: 'playlist', id: 'p1', provider: 'spotify' },
            name: 'Liked Songs',
            imageUrl: null,
          },
        ],
      });

      // #when
      renderView({ query: 'liked' });

      // #then — only the playlist entry shows under Recently Played
      expect(screen.getByText('Recently Played')).toBeInTheDocument();
      const cards = screen.getAllByText('Liked Songs');
      expect(cards).toHaveLength(1);
    });

    it("filters out 'album' refs from Recently Played when kindFilter=['playlist']", () => {
      // #given
      mockRecentlyPlayed.mockReturnValue({
        items: [
          {
            ref: { kind: 'album', id: 'a1', provider: 'spotify' },
            name: 'Match Album',
          },
          {
            ref: { kind: 'playlist', id: 'p1', provider: 'spotify' },
            name: 'Match Playlist',
          },
        ],
      });

      // #when
      renderView({ query: 'match', kindFilter: ['playlist'] });

      // #then
      expect(screen.queryByText('Match Album')).toBeNull();
      expect(screen.getByText('Match Playlist')).toBeInTheDocument();
    });
  });

  describe('artist search for albums', () => {
    it('includes an album when the query matches the artist name (not the album title)', () => {
      // #given — album title "Core" does NOT contain "stone"; artist does
      mockAlbumsSection.mockReturnValue({
        items: [
          { id: 'a1', name: 'Core', artists: 'Stone Temple Pilots', provider: 'spotify', images: [] },
        ],
      });

      // #when
      renderView({ query: 'stone' });

      // #then — album appears even though the title "Core" doesn't match
      expect(screen.getByText('Albums')).toBeInTheDocument();
      expect(screen.getByText('Core')).toBeInTheDocument();
    });

    it('excludes an album when neither title nor artist matches the query', () => {
      // #given
      mockAlbumsSection.mockReturnValue({
        items: [
          { id: 'a1', name: 'Core', artists: 'Stone Temple Pilots', provider: 'spotify', images: [] },
        ],
      });

      // #when
      renderView({ query: 'nirvana' });

      // #then
      expect(screen.queryByText('Albums')).toBeNull();
      expect(screen.queryByText('Core')).toBeNull();
    });
  });

  describe('pinned items remain searchable in their type sections', () => {
    it('shows a pinned album in the Albums section when the query matches', () => {
      // #given — album is pinned; useAlbumsSection is called with excludePinned:false so it still appears
      mockAlbumsSection.mockReturnValue({
        items: [{ id: 'a-pinned', name: 'Pinned Album', artists: 'Artist', provider: 'spotify', images: [] }],
      });

      // #when
      renderView({ query: 'pinned' });

      // #then — the album appears under Albums, not just under Pinned
      expect(screen.getByText('Albums')).toBeInTheDocument();
      expect(screen.getByText('Pinned Album')).toBeInTheDocument();
    });

    it('shows a pinned playlist in the Playlists section when the query matches', () => {
      // #given — playlist is pinned; usePlaylistsSection is called with excludePinned:false
      mockPlaylistsSection.mockReturnValue({
        items: [{ id: 'p-pinned', name: 'Pinned Playlist', provider: 'spotify' }],
      });

      // #when
      renderView({ query: 'pinned' });

      // #then
      expect(screen.getByText('Playlists')).toBeInTheDocument();
      expect(screen.getByText('Pinned Playlist')).toBeInTheDocument();
    });
  });

  describe('onContextMenuRequest forwarding', () => {
    it('forwards onContextMenuRequest to LibraryCard via right-click → menu request', () => {
      // #given
      mockPlaylistsSection.mockReturnValue({
        items: [{ id: 'p1', name: 'Forwarded', provider: 'spotify' }],
      });
      const onContextMenuRequest = vi.fn();

      // #when
      renderView({ query: 'forwarded' }, onContextMenuRequest);
      const card = screen.getByText('Forwarded').closest('button');
      expect(card).not.toBeNull();
      fireEvent.contextMenu(card!);

      // #then
      expect(onContextMenuRequest).toHaveBeenCalledTimes(1);
      const arg = onContextMenuRequest.mock.calls[0][0];
      expect(arg.kind).toBe('playlist');
      expect(arg.id).toBe('p1');
      expect(arg.name).toBe('Forwarded');
    });
  });
});
