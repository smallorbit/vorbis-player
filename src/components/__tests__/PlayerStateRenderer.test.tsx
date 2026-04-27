import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import PlayerStateRenderer from '../PlayerStateRenderer';
import { useQapEnabled } from '@/hooks/useQapEnabled';
import { useWelcomeSeen } from '@/hooks/useWelcomeSeen';
import { STALE_SESSION_MS, type SessionSnapshot } from '@/services/sessionPersistence';
import { makeMediaTrack } from '@/test/fixtures';

vi.mock('@/hooks/useQapEnabled', () => ({
  useQapEnabled: vi.fn(),
}));

vi.mock('@/hooks/useWelcomeSeen', () => ({
  useWelcomeSeen: vi.fn(),
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    activeDescriptor: {
      id: 'spotify',
      name: 'Spotify',
      capabilities: { hasSaveTrack: true, hasExternalLink: true },
      auth: { beginLogin: vi.fn() },
    },
    enabledProviderIds: [],
    connectedProviderIds: [],
    getDescriptor: () => undefined,
  })),
}));

vi.mock('../LibraryRoute', () => ({
  default: () => <div data-testid="library-route">LibraryRoute</div>,
}));

vi.mock('../QuickAccessPanel', () => ({
  default: () => <div data-testid="quick-access-panel">QuickAccessPanel</div>,
}));

vi.mock('../WelcomeScreen', () => ({
  default: ({ onBrowseLibrary }: { onBrowseLibrary: () => void }) => (
    <div data-testid="welcome-screen">
      <button type="button" onClick={onBrowseLibrary}>browse</button>
    </div>
  ),
}));

const mockUseQapEnabled = vi.mocked(useQapEnabled);
const mockUseWelcomeSeen = vi.mocked(useWelcomeSeen);

const freshSession: SessionSnapshot = {
  collectionId: 'col-1',
  collectionName: 'Test',
  trackIndex: 0,
  savedAt: Date.now(),
  queueTracks: [],
};

const staleSession: SessionSnapshot = {
  collectionId: 'col-1',
  collectionName: 'Test',
  trackIndex: 0,
  savedAt: Date.now() - STALE_SESSION_MS - 1000,
  queueTracks: [],
};

const defaultProps = {
  isLoading: false,
  error: null,
  selectedPlaylistId: null,
  tracks: [],
  onPlaylistSelect: vi.fn(),
  onAddToQueue: vi.fn(),
  lastSession: null,
  onResume: vi.fn(),
  onOpenSettings: vi.fn(),
  onHydrate: vi.fn(async () => ({ track: null, skipped: false, totalFailure: false })),
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('PlayerStateRenderer idle routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
  });

  it('renders WelcomeScreen when welcomeSeen is false (supersedes session + qap)', () => {
    // #given — brand-new user even if they somehow had a valid session + qap on
    mockUseWelcomeSeen.mockReturnValue([false, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([true, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} lastSession={freshSession} />
      </Wrapper>,
    );

    // #then
    expect(screen.getByTestId('welcome-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-access-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('library-route')).not.toBeInTheDocument();
  });

  it('renders QuickAccessPanel when welcomeSeen + qapEnabled + valid session', () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([true, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} lastSession={freshSession} />
      </Wrapper>,
    );

    // #then
    expect(screen.getByTestId('quick-access-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('welcome-screen')).not.toBeInTheDocument();
  });

  it('renders QuickAccessPanel when welcomeSeen + qapEnabled + no session', () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([true, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} lastSession={null} />
      </Wrapper>,
    );

    // #then
    expect(screen.getByTestId('quick-access-panel')).toBeInTheDocument();
  });

  it('renders QuickAccessPanel when welcomeSeen + qapEnabled + stale session', () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([true, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} lastSession={staleSession} />
      </Wrapper>,
    );

    // #then
    expect(screen.getByTestId('quick-access-panel')).toBeInTheDocument();
  });

  it('calls onHydrate once on mount when welcomeSeen + !qapEnabled + valid session', async () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);
    const onHydrate = vi.fn(async () => ({ track: null, skipped: false, totalFailure: false }));

    // #when
    const { rerender } = render(
      <Wrapper>
        <PlayerStateRenderer
          {...defaultProps}
          onHydrate={onHydrate}
          lastSession={freshSession}
        />
      </Wrapper>,
    );

    // #then
    await waitFor(() => {
      expect(onHydrate).toHaveBeenCalledTimes(1);
    });
    expect(onHydrate).toHaveBeenCalledWith(freshSession);

    // #when — re-render shouldn't fire hydrate again
    rerender(
      <Wrapper>
        <PlayerStateRenderer
          {...defaultProps}
          onHydrate={onHydrate}
          lastSession={freshSession}
        />
      </Wrapper>,
    );

    // #then
    expect(onHydrate).toHaveBeenCalledTimes(1);
  });

  it('renders a restoring placeholder (not the library) in the hydrate branch', () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} lastSession={freshSession} />
      </Wrapper>,
    );

    // #then
    expect(screen.getByText(/Restoring Your Session/i)).toBeInTheDocument();
    expect(screen.queryByTestId('library-route')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-access-panel')).not.toBeInTheDocument();
  });

  it('renders LibraryPage when welcomeSeen + !qapEnabled + no session', async () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} lastSession={null} />
      </Wrapper>,
    );

    // #then
    await waitFor(() => {
      expect(screen.getByTestId('library-route')).toBeInTheDocument();
    });
  });

  it('renders LibraryPage when welcomeSeen + !qapEnabled + stale session', async () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} lastSession={staleSession} />
      </Wrapper>,
    );

    // #then
    await waitFor(() => {
      expect(screen.getByTestId('library-route')).toBeInTheDocument();
    });
  });

  it('calls onHydrateFired with the track returned by onHydrate', async () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);
    const resolvedTrack = makeMediaTrack({ id: 't2', name: 'Second' });
    const onHydrate = vi.fn(async () => ({ track: resolvedTrack, skipped: false, totalFailure: false }));
    const onHydrateFired = vi.fn();

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer
          {...defaultProps}
          onHydrate={onHydrate}
          lastSession={freshSession}
          onHydrateFired={onHydrateFired}
        />
      </Wrapper>,
    );

    // #then
    await waitFor(() => {
      expect(onHydrateFired).toHaveBeenCalledTimes(1);
    });
    expect(onHydrateFired).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't2', name: 'Second' }),
      false,
    );
  });

  it('routes to LibraryPage and calls onHydrateFailed when onHydrate returns totalFailure', async () => {
    // #given — the whole saved queue is unplayable. handleHydrate resolves with
    // totalFailure; the renderer must not remain on the "Restoring Your Session"
    // spinner even though `lastSession` prop is still valid for a tick.
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);
    const onHydrate = vi.fn(async () => ({ track: null, skipped: false, totalFailure: true }));
    const onHydrateFailed = vi.fn();
    const onHydrateFired = vi.fn();

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer
          {...defaultProps}
          onHydrate={onHydrate}
          onHydrateFailed={onHydrateFailed}
          onHydrateFired={onHydrateFired}
          lastSession={freshSession}
        />
      </Wrapper>,
    );

    // #then — totalFailure triggers the failed callback and unblocks the library view
    await waitFor(() => {
      expect(onHydrateFailed).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId('library-route')).toBeInTheDocument();
    });
    expect(onHydrateFired).not.toHaveBeenCalled();
    expect(screen.queryByText(/Restoring Your Session/i)).not.toBeInTheDocument();
  });

  it('does not call onHydrateFired for a stale session', async () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);
    const onHydrateFired = vi.fn();

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer
          {...defaultProps}
          lastSession={staleSession}
          onHydrateFired={onHydrateFired}
        />
      </Wrapper>,
    );

    // #then
    await waitFor(() => {
      expect(screen.getByTestId('library-route')).toBeInTheDocument();
    });
    expect(onHydrateFired).not.toHaveBeenCalled();
  });

  it('does not call onHydrate for a stale session', async () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);
    const onHydrate = vi.fn(async () => ({ track: null, skipped: false, totalFailure: false }));

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer
          {...defaultProps}
          onHydrate={onHydrate}
          lastSession={staleSession}
        />
      </Wrapper>,
    );

    // #then
    await waitFor(() => {
      expect(screen.getByTestId('library-route')).toBeInTheDocument();
    });
    expect(onHydrate).not.toHaveBeenCalled();
  });

  it('welcomeSeen=false supersedes a valid session and QAP setting', () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([false, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);
    const onHydrate = vi.fn(async () => ({ track: null, skipped: false, totalFailure: false }));

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer
          {...defaultProps}
          onHydrate={onHydrate}
          lastSession={freshSession}
        />
      </Wrapper>,
    );

    // #then
    expect(screen.getByTestId('welcome-screen')).toBeInTheDocument();
    expect(onHydrate).not.toHaveBeenCalled();
  });

  it('switches to LibraryPage when Browse Library is clicked from WelcomeScreen', async () => {
    // #given
    mockUseWelcomeSeen.mockReturnValue([false, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([true, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} />
      </Wrapper>,
    );
    act(() => {
      screen.getByText('browse').click();
    });

    // #then
    await waitFor(() => {
      expect(screen.getByTestId('library-route')).toBeInTheDocument();
    });
  });

});

describe('PlayerStateRenderer settings gear on idle views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
  });

  it('renders the settings gear on the idle Library landing', async () => {
    // #given
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} />
      </Wrapper>
    );

    // #then
    await waitFor(() => {
      expect(screen.getByTestId('library-route')).toBeInTheDocument();
    });
    expect(screen.getByTestId('settings-gear-button')).toBeInTheDocument();
  });

  it('renders the settings gear on the idle QuickAccessPanel landing', () => {
    // #given
    mockUseQapEnabled.mockReturnValue([true, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} />
      </Wrapper>
    );

    // #then
    expect(screen.getByTestId('quick-access-panel')).toBeInTheDocument();
    expect(screen.getByTestId('settings-gear-button')).toBeInTheDocument();
  });

  it('invokes onOpenSettings when the gear is clicked', async () => {
    // #given
    const onOpenSettings = vi.fn();
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} onOpenSettings={onOpenSettings} />
      </Wrapper>
    );

    // #when
    fireEvent.click(await screen.findByTestId('settings-gear-button'));

    // #then
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('does not render the settings gear while the library is loading', () => {
    // #given
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} isLoading />
      </Wrapper>
    );

    // #then
    expect(screen.queryByTestId('settings-gear-button')).not.toBeInTheDocument();
  });

  it('does not render the settings gear while an authentication error is shown', () => {
    // #given
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} error="No authentication token available" />
      </Wrapper>
    );

    // #then
    expect(screen.queryByTestId('settings-gear-button')).not.toBeInTheDocument();
  });

  it('does not render when a playlist is already loaded with tracks (player-active path)', () => {
    // #given — selectedPlaylistId present and tracks.length > 0 mimics the active player state
    // in which PlayerStateRenderer returns null and BottomBar owns the gear affordance instead.
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer
          {...defaultProps}
          selectedPlaylistId="pl1"
          tracks={[{ id: 't1', name: 'Song', artists: 'A', album: 'Al', image: '', duration: 1, uri: '', provider: 'spotify', playbackRef: 'spotify:track:t1' }]}
        />
      </Wrapper>
    );

    // #then
    expect(screen.queryByTestId('settings-gear-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('library-route')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-access-panel')).not.toBeInTheDocument();
  });
});
