import React, { Suspense } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { theme } from '@/styles/theme';
import LibraryDrawer from '../LibraryDrawer';
import type { SessionSnapshot } from '@/services/sessionPersistence';

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('@/contexts/PlayerSizingContext', () => ({
  PlayerSizingProvider: ({ children }: { children: React.ReactNode }) => children,
  usePlayerSizingContext: vi.fn(() => ({
    viewport: { width: 1024, height: 768, ratio: 1024 / 768 },
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    hasPointerInput: true,
    dimensions: { width: 600, height: 600 },
  })),
}));

vi.mock('@/components/PlaylistSelection', () => ({
  default: ({ onPlaylistSelect }: { onPlaylistSelect: (id: string, name: string) => void }) => (
    <div data-testid="playlist-selection">
      <button onClick={() => onPlaylistSelect('pl-1', 'Mock Playlist')}>Mock Playlist</button>
    </div>
  ),
}));

vi.mock('@/hooks/useLibrarySync', () => ({
  useLibrarySync: vi.fn(() => ({
    playlists: [],
    albums: [],
    likedSongsCount: 0,
    likedSongsPerProvider: [],
    isInitialLoadComplete: true,
    isSyncing: false,
    lastSyncTimestamp: Date.now(),
    syncError: null,
    refreshNow: vi.fn(),
  })),
  LIBRARY_REFRESH_EVENT: 'vorbis-library-refresh',
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
    <Suspense fallback={<div>Loading...</div>}>
      {children}
    </Suspense>
  </ThemeProvider>
);

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onPlaylistSelect: vi.fn(),
};

describe('LibraryDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('header removal', () => {
    it('does not render a "Library" title text', () => {
      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} />
        </Wrapper>
      );

      // #then
      expect(screen.queryByText('Library')).toBeNull();
    });

    it('does not render a "Browse and select" subtitle', () => {
      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} />
        </Wrapper>
      );

      // #then
      expect(screen.queryByText(/browse and select/i)).toBeNull();
    });

    it('does not render a LibraryDrawerHeader element', () => {
      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} />
        </Wrapper>
      );

      // #then
      expect(document.querySelector('[data-testid="library-drawer-header"]')).toBeNull();
    });
  });

  describe('layout and content', () => {
    it('renders PlaylistSelection inside the drawer when open', () => {
      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} />
        </Wrapper>
      );

      // #then
      expect(screen.getByTestId('playlist-selection')).toBeTruthy();
    });

    it('renders the grip pill swipe handle when open', () => {
      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} />
        </Wrapper>
      );

      // #then
      expect(screen.getByRole('button', { name: /swipe up or tap to close library/i })).toBeTruthy();
    });

    it('renders as a dialog with aria-label "Library selection"', () => {
      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} />
        </Wrapper>
      );

      // #then
      expect(screen.getByRole('dialog', { name: /library selection/i })).toBeTruthy();
    });
  });

  describe('closed state', () => {
    it('does not render content when isOpen is false and drawer has never been opened', () => {
      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} isOpen={false} />
        </Wrapper>
      );

      // #then
      expect(screen.queryByTestId('playlist-selection')).toBeNull();
      expect(screen.queryByRole('button', { name: /swipe up or tap to close library/i })).toBeNull();
    });

    it('hides content (pointer-events none) when closed after previously being open', () => {
      // #given
      const { rerender } = render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} isOpen={true} />
        </Wrapper>
      );
      expect(screen.getByTestId('playlist-selection')).toBeTruthy();

      // #when
      rerender(
        <Wrapper>
          <LibraryDrawer {...defaultProps} isOpen={false} />
        </Wrapper>
      );

      // #then
      const dialog = screen.queryByRole('dialog', { name: /library selection/i });
      expect(dialog).toBeTruthy();
      expect(screen.queryByTestId('playlist-selection')).toBeNull();
    });
  });

  describe('ResumeCard integration', () => {
    const makeSession = (overrides?: Partial<SessionSnapshot>): SessionSnapshot => ({
      collectionId: 'col-1',
      collectionName: 'My Album',
      trackIndex: 0,
      trackTitle: 'Test Track',
      trackArtist: 'Test Artist',
      trackImage: undefined,
      savedAt: Date.now(),
      ...overrides,
    });

    it('renders ResumeCard when lastSession and onResume are both provided', () => {
      // #given
      const session = makeSession();
      const onResume = vi.fn();

      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} lastSession={session} onResume={onResume} />
        </Wrapper>
      );

      // #then
      expect(screen.getByRole('button', { name: /Resume: Test Track/i })).toBeTruthy();
    });

    it('does not render ResumeCard when lastSession is null', () => {
      // #given
      const onResume = vi.fn();

      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} lastSession={null} onResume={onResume} />
        </Wrapper>
      );

      // #then
      expect(screen.queryByRole('button', { name: /Resume:/i })).toBeNull();
    });

    it('does not render ResumeCard when lastSession is undefined', () => {
      // #given
      const onResume = vi.fn();

      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} onResume={onResume} />
        </Wrapper>
      );

      // #then
      expect(screen.queryByRole('button', { name: /Resume:/i })).toBeNull();
    });

    it('does not render ResumeCard when onResume is not provided', () => {
      // #given
      const session = makeSession();

      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} lastSession={session} />
        </Wrapper>
      );

      // #then
      expect(screen.queryByRole('button', { name: /Resume:/i })).toBeNull();
    });

    it('calls onResume when the ResumeCard is clicked', () => {
      // #given
      const session = makeSession();
      const onResume = vi.fn();
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} lastSession={session} onResume={onResume} />
        </Wrapper>
      );

      // #when
      fireEvent.click(screen.getByRole('button', { name: /Resume: Test Track/i }));

      // #then
      expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('falls back to collectionName in aria-label when trackTitle is absent', () => {
      // #given
      const session = makeSession({ trackTitle: undefined });
      const onResume = vi.fn();

      // #when
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} lastSession={session} onResume={onResume} />
        </Wrapper>
      );

      // #then
      expect(screen.getByRole('button', { name: /Resume: My Album/i })).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('calls onClose when the overlay is clicked', () => {
      // #given
      const onClose = vi.fn();
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} onClose={onClose} />
        </Wrapper>
      );

      // #when
      const overlay = document.body.querySelector('[aria-hidden="true"]');
      if (overlay) fireEvent.click(overlay);

      // #then
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when the swipe handle is clicked', () => {
      // #given
      const onClose = vi.fn();
      render(
        <Wrapper>
          <LibraryDrawer {...defaultProps} onClose={onClose} />
        </Wrapper>
      );

      // #when
      fireEvent.click(screen.getByRole('button', { name: /swipe up or tap to close library/i }));

      // #then
      expect(onClose).toHaveBeenCalled();
    });
  });
});
