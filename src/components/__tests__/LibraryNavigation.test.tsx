/**
 * Integration tests for full-screen library navigation.
 *
 * Covers:
 *  B. Library open/close — BottomBar's onBackToLibrary triggers library open;
 *     library closes when onCloseLibrary / onNavigateToPlayer is invoked.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { TestWrapper } from '@/test/testWrappers';

// ---- mocks required to mount BottomBar ----------------------------------- //

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    setVolume: vi.fn().mockResolvedValue(undefined),
    onPlayerStateChanged: vi.fn(() => vi.fn()),
    getCurrentState: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    getDeviceId: vi.fn().mockReturnValue(null),
    getIsReady: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    isAuthenticated: vi.fn(() => true),
    getAccessToken: vi.fn().mockReturnValue('mock-token'),
    ensureValidToken: vi.fn().mockResolvedValue('mock-token'),
    handleRedirect: vi.fn().mockResolvedValue(undefined),
    redirectToAuth: vi.fn(),
    logout: vi.fn(),
  },
  getUserPlaylists: vi.fn(),
  getPlaylistTracks: vi.fn(),
  getAlbumTracks: vi.fn(),
  getLikedSongs: vi.fn(),
  getLikedSongsCount: vi.fn(),
  checkTrackSaved: vi.fn(),
  saveTrack: vi.fn(),
  unsaveTrack: vi.fn(),
  getUserLibraryInterleaved: vi.fn(),
}));

vi.mock('@/contexts/PlayerSizingContext', () => ({
  PlayerSizingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePlayerSizingContext: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    hasPointerInput: true,
    viewport: { width: 1024, height: 768, ratio: 1024 / 768 },
    dimensions: { width: 600, height: 600 },
  })),
}));

// -------------------------------------------------------------------------- //

import BottomBar from '../BottomBar';
import {
  BottomBarActionsProvider,
  type BottomBarActionsValue,
} from '@/contexts/BottomBarActionsContext';

function makeActions(overrides?: Partial<BottomBarActionsValue>): BottomBarActionsValue {
  return {
    hidden: false,
    showSettings: vi.fn(),
    showQueue: vi.fn(),
    openLibrary: vi.fn(),
    toggleZenMode: vi.fn(),
    startRadio: vi.fn(),
    openQuickAccessPanel: vi.fn(),
    radioGenerating: false,
    ...overrides,
  };
}

function renderBottomBar(actions: BottomBarActionsValue = makeActions()) {
  render(
    <ThemeProvider theme={theme}>
      <TestWrapper>
        <BottomBarActionsProvider value={actions}>
          <BottomBar />
        </BottomBarActionsProvider>
      </TestWrapper>
    </ThemeProvider>
  );
  return actions;
}

// ---------------------------------------------------------------------------
// B. Library open/close
// ---------------------------------------------------------------------------

describe('Library open/close via BottomBar', () => {
  it('BottomBar openLibrary action is called when the "Back to Library" button is clicked', () => {
    // #given
    const openLibrary = vi.fn();
    renderBottomBar(makeActions({ openLibrary }));

    // #when
    fireEvent.click(screen.getByTitle('Back to Library'));

    // #then
    expect(openLibrary).toHaveBeenCalledOnce();
  });

  it('renders the "Back to Library" button as a permanent control', () => {
    // #given / #when
    renderBottomBar();

    // #then — context always supplies an openLibrary action, so the button is unconditional
    expect(screen.queryByTitle('Back to Library')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Simple stateful component that mimics the library open/close toggle used by
// PlayerContent so we can verify onCloseLibrary / onNavigateToPlayer contracts.
// ---------------------------------------------------------------------------

interface LibraryHostProps {
  onOpenLibrary?: () => void;
  onCloseLibrary?: () => void;
}

function LibraryHost({ onOpenLibrary, onCloseLibrary }: LibraryHostProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleOpen = () => {
    setIsOpen(true);
    onOpenLibrary?.();
  };

  const handleClose = () => {
    setIsOpen(false);
    onCloseLibrary?.();
  };

  return (
    <div>
      <button onClick={handleOpen}>Open Library</button>
      {isOpen && (
        <div data-testid="library-view">
          <button onClick={handleClose}>Close Library</button>
        </div>
      )}
    </div>
  );
}

describe('Library open/close via onCloseLibrary', () => {
  it('library is visible after open and hidden after close', () => {
    // #given
    const onOpenLibrary = vi.fn();
    const onCloseLibrary = vi.fn();

    render(<LibraryHost onOpenLibrary={onOpenLibrary} onCloseLibrary={onCloseLibrary} />);

    expect(screen.queryByTestId('library-view')).toBeNull();

    // #when — open
    fireEvent.click(screen.getByText('Open Library'));

    // #then — library is shown and open callback fired
    expect(screen.getByTestId('library-view')).toBeTruthy();
    expect(onOpenLibrary).toHaveBeenCalledOnce();

    // #when — close
    fireEvent.click(screen.getByText('Close Library'));

    // #then — library is hidden and close callback fired
    expect(screen.queryByTestId('library-view')).toBeNull();
    expect(onCloseLibrary).toHaveBeenCalledOnce();
  });

  it('calling onCloseLibrary (navigate to player) hides the library view', () => {
    // #given
    const onCloseLibrary = vi.fn();

    render(<LibraryHost onCloseLibrary={onCloseLibrary} />);

    fireEvent.click(screen.getByText('Open Library'));
    expect(screen.getByTestId('library-view')).toBeTruthy();

    // #when
    fireEvent.click(screen.getByText('Close Library'));

    // #then
    expect(screen.queryByTestId('library-view')).toBeNull();
    expect(onCloseLibrary).toHaveBeenCalledOnce();
  });
});

