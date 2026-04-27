import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import LibraryRoute from '../index';
import type { MediaTrack } from '@/types/domain';

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

const { mockCurrentTrack } = vi.hoisted(() => ({
  mockCurrentTrack: vi.fn<[], { currentTrack: MediaTrack | null }>(),
}));

vi.mock('@/contexts/TrackContext', () => ({
  useCurrentTrackContext: () => mockCurrentTrack(),
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

import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';

const baseProps = {
  onPlaylistSelect: vi.fn(),
  onOpenSettings: vi.fn(),
  lastSession: null,
  isPlaying: false,
  onMiniPlay: vi.fn(),
  onMiniPause: vi.fn(),
  onMiniNext: vi.fn(),
  onMiniPrevious: vi.fn(),
  onMiniExpand: vi.fn(),
};

function renderRoute(propsOverrides: Partial<React.ComponentProps<typeof LibraryRoute>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <LibraryRoute {...baseProps} {...propsOverrides} />
    </ThemeProvider>,
  );
}

describe('LibraryRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentTrack.mockReturnValue({ currentTrack: null });
  });

  it('renders mobile layout testid when isMobile is true', () => {
    // #given
    vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: true } as ReturnType<typeof usePlayerSizingContext>);

    // #when
    renderRoute();

    // #then
    expect(screen.getByTestId('library-route-mobile')).toBeInTheDocument();
    expect(screen.queryByTestId('library-route-desktop')).not.toBeInTheDocument();
  });

  it('renders desktop layout testid when isMobile is false', () => {
    // #given
    vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);

    // #when
    renderRoute();

    // #then
    expect(screen.getByTestId('library-route-desktop')).toBeInTheDocument();
    expect(screen.queryByTestId('library-route-mobile')).not.toBeInTheDocument();
  });

  it('renders HomeView at home view by default', () => {
    // #given
    vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);

    // #when
    renderRoute();

    // #then
    expect(screen.getByTestId('library-home')).toBeInTheDocument();
  });

  it('does not mount mini-player when no current track', () => {
    // #given
    vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);
    mockCurrentTrack.mockReturnValue({ currentTrack: null });

    // #when
    renderRoute();

    // #then
    expect(screen.queryByTestId('library-mini-player')).toBeNull();
  });

  it('mounts mini-player when a current track is loaded', () => {
    // #given
    vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: true } as ReturnType<typeof usePlayerSizingContext>);
    mockCurrentTrack.mockReturnValue({
      currentTrack: {
        id: 't1',
        name: 'Song',
        artists: 'Artist',
      } as MediaTrack,
    });

    // #when
    renderRoute();

    // #then
    expect(screen.getByTestId('library-mini-player')).toBeInTheDocument();
    expect(screen.getByText('Song')).toBeInTheDocument();
  });

  it('forwards onMiniExpand from the mini-player tap region', () => {
    // #given
    vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: true } as ReturnType<typeof usePlayerSizingContext>);
    mockCurrentTrack.mockReturnValue({
      currentTrack: { id: 't1', name: 'Song', artists: 'Artist' } as MediaTrack,
    });
    const onMiniExpand = vi.fn();

    // #when
    renderRoute({ onMiniExpand });
    fireEvent.click(screen.getByTestId('mini-expand'));

    // #then
    expect(onMiniExpand).toHaveBeenCalledTimes(1);
  });

  describe('Escape key handling', () => {
    beforeEach(() => {
      vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);
    });

    it('calls onClose when Escape is pressed outside an input', () => {
      // #given
      const onClose = vi.fn();
      renderRoute({ onClose });

      // #when
      fireEvent.keyDown(document, { key: 'Escape' });

      // #then
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when Escape is pressed while focus is inside an input', () => {
      // #given
      const onClose = vi.fn();
      renderRoute({ onClose });
      const input = screen.getByTestId('library-search-input-desktop');

      // #when
      fireEvent.keyDown(input, { key: 'Escape' });

      // #then
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when onClose prop is not provided', () => {
      // #given — no onClose prop
      renderRoute();

      // #when
      fireEvent.keyDown(document, { key: 'Escape' });

      // #then — no error thrown, handler is a no-op
      expect(true).toBe(true);
    });
  });
});
