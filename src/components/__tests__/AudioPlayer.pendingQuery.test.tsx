/**
 * Integration tests for the pendingLibraryQueryRef / ref-clear-on-read cycle.
 *
 * AudioPlayer stores the artist-browse query in a ref and clears it immediately
 * when rendering LibraryRoute (ref-clear-on-read). This harness exercises that
 * contract end-to-end: the query seeds the search input on the first open, and
 * the input is empty on the second open (no query).
 */

import React, { useRef } from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: vi.fn(() => ({
    isMobile: false,
  })),
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

vi.mock('../LibraryRoute/hooks', () => ({
  useResumeSection: vi.fn(() => ({ session: null, hasResumable: false })),
  useRecentlyPlayedSection: vi.fn(() => ({ items: [], isLoading: false, isEmpty: true })),
  usePinnedSection: vi.fn(() => ({
    pinnedPlaylists: [],
    pinnedAlbums: [],
    combined: [],
    isLoading: false,
    isEmpty: true,
  })),
  usePlaylistsSection: vi.fn(() => ({ items: [], isLoading: false, isEmpty: true })),
  useAlbumsSection: vi.fn(() => ({ items: [], isLoading: false, isEmpty: true })),
  useLikedSection: vi.fn(() => ({
    totalCount: 0,
    perProvider: [],
    isUnified: false,
    isLoading: false,
  })),
  fetchLikedForProvider: vi.fn(async () => []),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useCurrentTrackContext: () => ({ currentTrack: null }),
}));

vi.mock('@/hooks/usePinnedItems', () => ({
  usePinnedItems: () => ({
    pinnedPlaylistIds: [],
    pinnedAlbumIds: [],
    isPlaylistPinned: () => false,
    isAlbumPinned: () => false,
    togglePinPlaylist: vi.fn(),
    togglePinAlbum: vi.fn(),
  }),
}));

vi.mock('@/hooks/useRecentlyPlayedCollections', () => ({
  useRecentlyPlayedCollections: () => ({ history: [], record: vi.fn(), remove: vi.fn() }),
}));

import LibraryRoute from '../LibraryRoute';

const baseProps = {
  onPlaylistSelect: vi.fn(),
  lastSession: null,
  isPlaying: false,
  onMiniPlay: vi.fn(),
  onMiniPause: vi.fn(),
  onMiniNext: vi.fn(),
  onMiniPrevious: vi.fn(),
  onMiniExpand: vi.fn(),
  onAddToQueue: vi.fn().mockResolvedValue(null),
};

/**
 * Harness that mirrors AudioPlayer's pendingLibraryQueryRef / ref-clear-on-read pattern:
 * - calling openLibraryWithQuery(q) stores q in the ref and shows the library
 * - calling openLibrary() shows the library without a query
 * - calling closeLibrary() unmounts LibraryRoute (clears its useState seed)
 * - the ref is cleared on read, exactly as AudioPlayer does at render time
 */
function PendingQueryHarness() {
  const pendingQueryRef = useRef<string | undefined>(undefined);
  const [open, setOpen] = React.useState(false);
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  const openLibraryWithQuery = (q: string) => {
    pendingQueryRef.current = q;
    setOpen(true);
  };

  const openLibrary = () => {
    setOpen(true);
    forceUpdate();
  };

  const closeLibrary = () => {
    setOpen(false);
  };

  // Ref-clear-on-read: capture and clear before render, matching AudioPlayer's pattern.
  const initialSearchQuery = pendingQueryRef.current;
  pendingQueryRef.current = undefined;

  return (
    <ThemeProvider theme={theme}>
      <button onClick={() => openLibraryWithQuery('Pink Floyd')}>Open with query</button>
      <button onClick={openLibrary}>Open without query</button>
      <button onClick={closeLibrary}>Close</button>
      {open && (
        <LibraryRoute
          key={String(open) + String(initialSearchQuery)}
          {...baseProps}
          initialSearchQuery={initialSearchQuery}
          onClose={closeLibrary}
        />
      )}
    </ThemeProvider>
  );
}

describe('pendingLibraryQueryRef ref-clear-on-read cycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('search input is populated on first open (with query) and empty on second open (without query)', () => {
    // #given
    render(<PendingQueryHarness />);

    // #when — open library with a query
    act(() => {
      screen.getByText('Open with query').click();
    });

    // #then — search input is seeded with the query
    expect(screen.getByTestId('library-search-input-desktop')).toHaveValue('Pink Floyd');

    // #when — navigate back to player
    act(() => {
      screen.getByText('Close').click();
    });

    // #then — library is unmounted
    expect(screen.queryByTestId('library-search-input-desktop')).not.toBeInTheDocument();

    // #when — open library without a query
    act(() => {
      screen.getByText('Open without query').click();
    });

    // #then — search input is empty (ref was cleared on the previous read)
    expect(screen.getByTestId('library-search-input-desktop')).toHaveValue('');
  });
});
