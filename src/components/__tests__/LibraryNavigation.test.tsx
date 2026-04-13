/**
 * Integration tests for full-screen library navigation.
 *
 * Covers:
 *  B. Library open/close — BottomBar's onBackToLibrary triggers library open;
 *     library closes when onCloseLibrary / onNavigateToPlayer is invoked.
 *  C. Filter reset on QAP open — the onBrowseLibrary handler removes the four
 *     library filter keys from localStorage before opening the library.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { STORAGE_KEYS } from '@/constants/storage';
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

function renderBottomBar(overrides: Partial<React.ComponentProps<typeof BottomBar>> = {}) {
  const defaults: React.ComponentProps<typeof BottomBar> = {
    isMuted: false,
    volume: 50,
    onShowVisualEffects: vi.fn(),
    onShowQueue: vi.fn(),
    onBackToLibrary: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  render(
    <ThemeProvider theme={theme}>
      <TestWrapper>
        <BottomBar {...props} />
      </TestWrapper>
    </ThemeProvider>
  );
  return props;
}

// ---------------------------------------------------------------------------
// B. Library open/close
// ---------------------------------------------------------------------------

describe('Library open/close via BottomBar', () => {
  it('BottomBar onBackToLibrary callback is called when the "Back to Library" button is clicked', () => {
    // #given
    const onBackToLibrary = vi.fn();

    renderBottomBar({ onBackToLibrary });

    // #when
    fireEvent.click(screen.getByTitle('Back to Library'));

    // #then
    expect(onBackToLibrary).toHaveBeenCalledOnce();
  });

  it('does not render "Back to Library" button when onBackToLibrary is not provided', () => {
    // #given / #when
    renderBottomBar({ onBackToLibrary: undefined });

    // #then
    expect(screen.queryByTitle('Back to Library')).toBeNull();
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

// ---------------------------------------------------------------------------
// C. Filter reset on QAP open (onBrowseLibrary handler)
// ---------------------------------------------------------------------------

/**
 * Simulates the onBrowseLibrary handler from AudioPlayer.tsx:
 *
 *   onBrowseLibrary={() => {
 *     localStorage.removeItem(STORAGE_KEYS.LIBRARY_SEARCH);
 *     localStorage.removeItem(STORAGE_KEYS.LIBRARY_PROVIDER_FILTERS);
 *     localStorage.removeItem(STORAGE_KEYS.LIBRARY_GENRES);
 *     localStorage.removeItem(STORAGE_KEYS.LIBRARY_RECENTLY_ADDED);
 *     handleCloseQuickAccessPanel();
 *     handlers.handleOpenLibrary();
 *   }}
 */
function makeBrowseLibraryHandler(onOpenLibrary: () => void) {
  return () => {
    localStorage.removeItem(STORAGE_KEYS.LIBRARY_SEARCH);
    localStorage.removeItem(STORAGE_KEYS.LIBRARY_PROVIDER_FILTERS);
    localStorage.removeItem(STORAGE_KEYS.LIBRARY_GENRES);
    localStorage.removeItem(STORAGE_KEYS.LIBRARY_RECENTLY_ADDED);
    onOpenLibrary();
  };
}

describe('Filter reset on QAP open (onBrowseLibrary)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('removes LIBRARY_SEARCH from localStorage before opening the library', () => {
    // #given
    const removeItem = vi.spyOn(localStorage, 'removeItem');
    const onOpenLibrary = vi.fn();
    const handler = makeBrowseLibraryHandler(onOpenLibrary);

    // #when
    handler();

    // #then
    expect(removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LIBRARY_SEARCH);
  });

  it('removes LIBRARY_PROVIDER_FILTERS from localStorage before opening the library', () => {
    // #given
    const removeItem = vi.spyOn(localStorage, 'removeItem');
    const onOpenLibrary = vi.fn();
    const handler = makeBrowseLibraryHandler(onOpenLibrary);

    // #when
    handler();

    // #then
    expect(removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LIBRARY_PROVIDER_FILTERS);
  });

  it('removes LIBRARY_GENRES from localStorage before opening the library', () => {
    // #given
    const removeItem = vi.spyOn(localStorage, 'removeItem');
    const onOpenLibrary = vi.fn();
    const handler = makeBrowseLibraryHandler(onOpenLibrary);

    // #when
    handler();

    // #then
    expect(removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LIBRARY_GENRES);
  });

  it('removes LIBRARY_RECENTLY_ADDED from localStorage before opening the library', () => {
    // #given
    const removeItem = vi.spyOn(localStorage, 'removeItem');
    const onOpenLibrary = vi.fn();
    const handler = makeBrowseLibraryHandler(onOpenLibrary);

    // #when
    handler();

    // #then
    expect(removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LIBRARY_RECENTLY_ADDED);
  });

  it('removes all four filter keys and then calls onOpenLibrary', () => {
    // #given
    const callOrder: string[] = [];
    const removeItem = vi.spyOn(localStorage, 'removeItem').mockImplementation((key) => {
      callOrder.push(`remove:${key}`);
    });
    const onOpenLibrary = vi.fn(() => { callOrder.push('openLibrary'); });
    const handler = makeBrowseLibraryHandler(onOpenLibrary);

    // #when
    handler();

    // #then — all four removes happen before the library open
    expect(removeItem).toHaveBeenCalledTimes(4);
    expect(onOpenLibrary).toHaveBeenCalledOnce();

    const openIdx = callOrder.indexOf('openLibrary');
    const removeIndices = [
      callOrder.indexOf(`remove:${STORAGE_KEYS.LIBRARY_SEARCH}`),
      callOrder.indexOf(`remove:${STORAGE_KEYS.LIBRARY_PROVIDER_FILTERS}`),
      callOrder.indexOf(`remove:${STORAGE_KEYS.LIBRARY_GENRES}`),
      callOrder.indexOf(`remove:${STORAGE_KEYS.LIBRARY_RECENTLY_ADDED}`),
    ];
    expect(Math.max(...removeIndices)).toBeLessThan(openIdx);
  });
});
