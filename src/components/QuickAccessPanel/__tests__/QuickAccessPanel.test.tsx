import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import QuickAccessPanel from '../index';
import type { ProviderId } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';

vi.mock('@/hooks/useLibrarySync', () => ({
  useLibrarySync: vi.fn(),
}));

vi.mock('@/hooks/useUnifiedLikedTracks', () => ({
  useUnifiedLikedTracks: vi.fn(),
}));

vi.mock('@/contexts/PinnedItemsContext', () => ({
  usePinnedItemsContext: vi.fn(),
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(),
}));

vi.mock('@/hooks/useLongPress', () => ({
  useLongPress: vi.fn(() => ({
    onPointerDown: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerCancel: vi.fn(),
  })),
}));

vi.mock('@/components/ProviderIcon', () => ({
  default: ({ provider }: { provider: string }) => <span data-testid={`provider-icon-${provider}`} />,
}));

import { useLibrarySync } from '@/hooks/useLibrarySync';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { usePinnedItemsContext } from '@/contexts/PinnedItemsContext';
import { useProviderContext } from '@/contexts/ProviderContext';

const mockUseLibrarySync = vi.mocked(useLibrarySync);
const mockUseUnifiedLikedTracks = vi.mocked(useUnifiedLikedTracks);
const mockUsePinnedItemsContext = vi.mocked(usePinnedItemsContext);
const mockUseProviderContext = vi.mocked(useProviderContext);

function setupProviderContext(connectedProviderIds: ProviderId[]) {
  mockUseProviderContext.mockReturnValue({
    connectedProviderIds,
    getDescriptor: (id: ProviderId) => ({
      id,
      name: id === 'spotify' ? 'Spotify' : 'Dropbox',
      capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true },
      auth: { providerId: id, isAuthenticated: vi.fn(() => true), getAccessToken: vi.fn(), beginLogin: vi.fn(), handleCallback: vi.fn(), logout: vi.fn() },
      catalog: { providerId: id, listCollections: vi.fn(), listTracks: vi.fn() },
      playback: { providerId: id, initialize: vi.fn(), playTrack: vi.fn(), pause: vi.fn(), resume: vi.fn(), seek: vi.fn(), next: vi.fn(), previous: vi.fn(), setVolume: vi.fn(), getState: vi.fn(), subscribe: vi.fn(() => vi.fn()), getLastPlayTime: vi.fn() },
    }),
    enabledProviderIds: connectedProviderIds,
    activeDescriptor: null,
    storedProviderId: null,
    setActiveProviderId: vi.fn(),
    toggleProvider: vi.fn(),
    isProviderEnabled: vi.fn(),
    allProviders: [],
    setProviderSwitchInterceptor: vi.fn(),
    needsProviderSelection: false,
    fallthroughNotification: null,
    dismissFallthroughNotification: vi.fn(),
    authRevision: 0,
  } as ReturnType<typeof useProviderContext>);
}

function setupLibrarySync(likedSongsPerProvider: { provider: ProviderId; count: number }[]) {
  mockUseLibrarySync.mockReturnValue({
    playlists: [],
    albums: [],
    likedSongsCount: likedSongsPerProvider.reduce((s, e) => s + e.count, 0),
    likedSongsPerProvider,
    isInitialLoadComplete: true,
    isSyncing: false,
    lastSyncTimestamp: null,
    syncError: null,
    refreshNow: vi.fn(),
    removeCollection: vi.fn(),
  } as ReturnType<typeof useLibrarySync>);
}

function setupUnifiedLiked(isUnifiedLikedActive: boolean, totalCount: number) {
  mockUseUnifiedLikedTracks.mockReturnValue({
    isUnifiedLikedActive,
    totalCount,
    unifiedTracks: [],
    isLoading: false,
  } as ReturnType<typeof useUnifiedLikedTracks>);
}

interface RenderPanelOptions {
  lastSession?: SessionSnapshot | null;
  onResume?: () => void;
}

function renderPanel(options: RenderPanelOptions = {}) {
  mockUsePinnedItemsContext.mockReturnValue({
    pinnedPlaylistIds: [],
    pinnedAlbumIds: [],
    togglePlaylistPin: vi.fn(),
    toggleAlbumPin: vi.fn(),
    isPlaylistPinned: vi.fn(() => false),
    isAlbumPinned: vi.fn(() => false),
    canPinMorePlaylists: true,
    canPinMoreAlbums: true,
  } as ReturnType<typeof usePinnedItemsContext>);

  return render(
    <ThemeProvider theme={theme}>
      <QuickAccessPanel
        onPlaylistSelect={vi.fn()}
        onAddToQueue={vi.fn()}
        onBrowseLibrary={vi.fn()}
        lastSession={options.lastSession ?? null}
        onResume={options.onResume ?? vi.fn()}
      />
    </ThemeProvider>
  );
}

function makeSession(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    collectionId: 'col-1',
    collectionName: 'My Playlist',
    trackIndex: 3,
    trackTitle: 'Track Title',
    trackArtist: 'Artist Name',
    ...overrides,
  };
}

function getLikedCount(): number {
  const el = screen.getByLabelText(/Liked Songs/);
  const match = el.getAttribute('aria-label')?.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

describe('QuickAccessPanel effectiveLikedCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('unified liked active + all providers visible (no filter chip selected)', () => {
    it('shows the unified total count', () => {
      // #given
      setupProviderContext(['spotify', 'dropbox']);
      setupLibrarySync([
        { provider: 'spotify', count: 100 },
        { provider: 'dropbox', count: 50 },
      ]);
      setupUnifiedLiked(true, 150);

      // #when
      renderPanel();

      // #then
      expect(getLikedCount()).toBe(150);
    });
  });

  describe('unified liked active + one provider filter chip selected', () => {
    it('shows the single-provider count (not unified) when filtered to one provider', () => {
      // #given
      setupProviderContext(['spotify', 'dropbox']);
      setupLibrarySync([
        { provider: 'spotify', count: 100 },
        { provider: 'dropbox', count: 50 },
      ]);
      setupUnifiedLiked(true, 150);

      // #when
      renderPanel();
      const spotifyChip = screen.getByText('Spotify');
      fireEvent.click(spotifyChip);

      // #then
      expect(getLikedCount()).toBe(100);
    });
  });

  describe('unified liked inactive + provider filter active', () => {
    it('shows the sum of filtered per-provider counts', () => {
      // #given
      setupProviderContext(['spotify', 'dropbox']);
      setupLibrarySync([
        { provider: 'spotify', count: 100 },
        { provider: 'dropbox', count: 50 },
      ]);
      setupUnifiedLiked(false, 0);

      // #when
      renderPanel();
      const dropboxChip = screen.getByText('Dropbox');
      fireEvent.click(dropboxChip);

      // #then
      expect(getLikedCount()).toBe(50);
    });

    it('shows the total count when no filter chip is active', () => {
      // #given
      setupProviderContext(['spotify', 'dropbox']);
      setupLibrarySync([
        { provider: 'spotify', count: 100 },
        { provider: 'dropbox', count: 50 },
      ]);
      setupUnifiedLiked(false, 0);

      // #when
      renderPanel();

      // #then
      expect(getLikedCount()).toBe(150);
    });
  });

  describe('no providers connected (single provider)', () => {
    it('shows the single provider count when only one provider is connected', () => {
      // #given
      setupProviderContext(['spotify']);
      setupLibrarySync([{ provider: 'spotify', count: 75 }]);
      setupUnifiedLiked(false, 0);

      // #when
      renderPanel();

      // #then — one provider, unified inactive: shows 75
      expect(getLikedCount()).toBe(75);
    });
  });

  describe('unified liked active + filter chip selects both providers', () => {
    it('shows unified count when both provider chips are individually toggled back on', () => {
      // #given
      setupProviderContext(['spotify', 'dropbox']);
      setupLibrarySync([
        { provider: 'spotify', count: 100 },
        { provider: 'dropbox', count: 50 },
      ]);
      setupUnifiedLiked(true, 150);

      // #when
      renderPanel();
      const spotifyChip = screen.getByText('Spotify');
      fireEvent.click(spotifyChip);
      fireEvent.click(spotifyChip);

      // #then
      expect(getLikedCount()).toBe(150);
    });
  });
});

describe('QuickAccessPanel Resume hero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupProviderContext(['spotify']);
    setupLibrarySync([{ provider: 'spotify', count: 10 }]);
    setupUnifiedLiked(false, 0);
  });

  it('renders the hero when a valid lastSession is provided', () => {
    // #given
    const session = makeSession({ trackTitle: 'Hero Track', collectionName: 'Hero Mix' });

    // #when
    renderPanel({ lastSession: session });

    // #then
    expect(screen.getByText('Pick up where you left off')).toBeInTheDocument();
    expect(screen.getByText('Hero Track')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume Hero Track/ })).toBeInTheDocument();
  });

  it('does not render the hero when lastSession is null', () => {
    // #when
    renderPanel({ lastSession: null });

    // #then
    expect(screen.queryByText('Pick up where you left off')).not.toBeInTheDocument();
  });

  it('does not render the hero when lastSession has an empty collectionId (stale/invalid)', () => {
    // #given
    const session = makeSession({ collectionId: '' });

    // #when
    renderPanel({ lastSession: session });

    // #then
    expect(screen.queryByText('Pick up where you left off')).not.toBeInTheDocument();
  });

  it('invokes onResume when the hero button is clicked', () => {
    // #given
    const onResume = vi.fn();
    const session = makeSession({ trackTitle: 'Click Me' });

    // #when
    renderPanel({ lastSession: session, onResume });
    fireEvent.click(screen.getByRole('button', { name: /Resume Click Me/ }));

    // #then
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('suppresses the footer ResumeCard when the hero is visible', () => {
    // #given
    const session = makeSession({ trackTitle: 'Only Hero' });

    // #when
    renderPanel({ lastSession: session });

    // #then — only one resume affordance, the hero button (matched by name)
    const resumeAffordances = screen.getAllByRole('button', { name: /Resume/ });
    expect(resumeAffordances).toHaveLength(1);
    expect(resumeAffordances[0]).toHaveAccessibleName('Resume Only Hero');
  });
});
