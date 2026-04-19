import * as React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { AllMusicCard } from '../AllMusicCard';
import {
  LibraryActionsProvider,
  LibraryDataProvider,
  LibraryPinProvider,
  type LibraryActionsContextValue,
  type LibraryDataContextValue,
  type LibraryPinContextValue,
} from '../LibraryContext';
import { ALL_MUSIC_PIN_ID } from '@/constants/playlist';
import { PinnedItemsProvider, usePinnedItemsContext } from '@/contexts/PinnedItemsContext';
import { setPins, UNIFIED_PROVIDER } from '@/services/settings/pinnedItemsStorage';

interface HarnessOverrides {
  isPinned?: boolean;
  canPinMore?: boolean;
  onPlaylistContextMenu?: LibraryActionsContextValue['onPlaylistContextMenu'];
  onPinPlaylistClick?: LibraryPinContextValue['onPinPlaylistClick'];
}

function renderWithContext(
  layout: 'grid' | 'list',
  count: number,
  overrides: HarnessOverrides = {},
): { onPlaylistContextMenu: ReturnType<typeof vi.fn>; onPinPlaylistClick: ReturnType<typeof vi.fn> } {
  const onPlaylistContextMenu = vi.fn();
  const onPinPlaylistClick = vi.fn();

  const data: LibraryDataContextValue = {
    inDrawer: layout === 'grid',
    albums: [],
    isInitialLoadComplete: true,
    showProviderBadges: false,
    enabledProviderIds: ['dropbox'],
    likedSongsPerProvider: [],
    likedSongsCount: 0,
    isLikedSongsSyncing: false,
    isUnifiedLikedActive: false,
    unifiedLikedCount: 0,
    allMusicCount: count,
    activeDescriptor: null,
  };

  const pin: LibraryPinContextValue = {
    pinnedPlaylists: [],
    unpinnedPlaylists: [],
    pinnedAlbums: [],
    unpinnedAlbums: [],
    isPlaylistPinned: (id: string) => (overrides.isPinned ?? false) && id === ALL_MUSIC_PIN_ID,
    canPinMorePlaylists: overrides.canPinMore ?? true,
    isAlbumPinned: () => false,
    canPinMoreAlbums: true,
    onPinPlaylistClick: overrides.onPinPlaylistClick ?? onPinPlaylistClick,
    onPinAlbumClick: vi.fn(),
  };

  const actions: LibraryActionsContextValue = {
    onPlaylistClick: vi.fn(),
    onPlaylistContextMenu: overrides.onPlaylistContextMenu ?? onPlaylistContextMenu,
    onLikedSongsClick: vi.fn(),
    onAlbumClick: vi.fn(),
    onAlbumContextMenu: vi.fn(),
    onArtistClick: vi.fn(),
  };

  render(
    <ThemeProvider theme={theme}>
      <LibraryDataProvider value={data}>
        <LibraryPinProvider value={pin}>
          <LibraryActionsProvider value={actions}>
            <AllMusicCard layout={layout} count={count} />
          </LibraryActionsProvider>
        </LibraryPinProvider>
      </LibraryDataProvider>
    </ThemeProvider>,
  );

  return { onPlaylistContextMenu, onPinPlaylistClick };
}

describe('AllMusicCard', () => {
  describe('grid layout', () => {
    it('renders the title, "{N} tracks • Shuffled" subtitle, and shuffle glyph', () => {
      // #when
      renderWithContext('grid', 248);

      // #then
      expect(screen.getByText('All Music')).toBeInTheDocument();
      expect(screen.getByText('248 tracks • Shuffled')).toBeInTheDocument();
      expect(screen.getByTestId('all-music-shuffle-glyph')).toBeInTheDocument();
    });

    it('renders the branded art container with a linear-gradient background', () => {
      // #when
      renderWithContext('grid', 5);

      // #then
      const art = screen.getByTestId('all-music-art');
      const style = art.getAttribute('style') ?? '';
      expect(style.toLowerCase()).toContain('linear-gradient');
    });

    it('opens the playlist popover when the card is clicked', () => {
      // #when
      const { onPlaylistContextMenu } = renderWithContext('grid', 10);
      fireEvent.click(screen.getByText('All Music'));

      // #then
      expect(onPlaylistContextMenu).toHaveBeenCalledTimes(1);
      const playlistArg = onPlaylistContextMenu.mock.calls[0][0];
      expect(playlistArg).toMatchObject({ id: '', name: 'All Music', provider: 'dropbox' });
    });
  });

  describe('list layout', () => {
    it('renders the title, "{N} tracks • Shuffled" subtitle, and shuffle glyph', () => {
      // #when
      renderWithContext('list', 12);

      // #then
      expect(screen.getByText('All Music')).toBeInTheDocument();
      expect(screen.getByText('12 tracks • Shuffled')).toBeInTheDocument();
      expect(screen.getByTestId('all-music-shuffle-glyph')).toBeInTheDocument();
    });

    it('exposes a pin button labelled for All Music', () => {
      // #when
      renderWithContext('list', 12, { isPinned: false });

      // #then
      expect(screen.getByRole('button', { name: /pin all music to top/i })).toBeInTheDocument();
    });

    it('switches the pin button label to "Unpin All Music" when pinned', () => {
      // #when
      renderWithContext('list', 12, { isPinned: true });

      // #then
      expect(screen.getByRole('button', { name: /unpin all music/i })).toBeInTheDocument();
    });

    it('invokes onPinPlaylistClick with ALL_MUSIC_PIN_ID when the pin button is clicked', () => {
      // #when
      const { onPinPlaylistClick } = renderWithContext('list', 12);
      fireEvent.click(screen.getByRole('button', { name: /pin all music to top/i }));

      // #then
      expect(onPinPlaylistClick).toHaveBeenCalledTimes(1);
      expect(onPinPlaylistClick.mock.calls[0][0]).toBe(ALL_MUSIC_PIN_ID);
    });
  });
});

function PinHarness({ onState }: { onState: (state: { ids: string[]; togglePin: (id: string) => void }) => void }) {
  const { pinnedPlaylistIds, togglePinPlaylist } = usePinnedItemsContext();
  React.useEffect(() => {
    onState({ ids: pinnedPlaylistIds, togglePin: togglePinPlaylist });
  }, [pinnedPlaylistIds, togglePinPlaylist, onState]);
  return null;
}

describe('AllMusicCard pin persistence', () => {
  beforeEach(async () => {
    await setPins(UNIFIED_PROVIDER, 'playlists', []);
    await setPins(UNIFIED_PROVIDER, 'albums', []);
  });

  it('persists ALL_MUSIC_PIN_ID across remounts via the pinned-items store', async () => {
    // #given — simulate a previous session pinning All Music
    await setPins(UNIFIED_PROVIDER, 'playlists', [ALL_MUSIC_PIN_ID]);

    // #when — fresh provider mount reads the persisted state
    const states: Array<{ ids: string[]; togglePin: (id: string) => void }> = [];
    render(
      <PinnedItemsProvider>
        <PinHarness onState={(s) => states.push(s)} />
      </PinnedItemsProvider>,
    );

    // #then
    await waitFor(() => {
      expect(states.at(-1)?.ids).toContain(ALL_MUSIC_PIN_ID);
    });
  });

  it('toggling unpin removes ALL_MUSIC_PIN_ID from persisted state', async () => {
    // #given
    await setPins(UNIFIED_PROVIDER, 'playlists', [ALL_MUSIC_PIN_ID]);
    const states: Array<{ ids: string[]; togglePin: (id: string) => void }> = [];
    render(
      <PinnedItemsProvider>
        <PinHarness onState={(s) => states.push(s)} />
      </PinnedItemsProvider>,
    );
    await waitFor(() => {
      expect(states.at(-1)?.ids).toContain(ALL_MUSIC_PIN_ID);
    });

    // #when
    await act(async () => {
      states.at(-1)?.togglePin(ALL_MUSIC_PIN_ID);
    });

    // #then
    await waitFor(() => {
      expect(states.at(-1)?.ids).not.toContain(ALL_MUSIC_PIN_ID);
    });
  });
});
