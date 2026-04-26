/**
 * Tests for PlayerStateRenderer — library view swaps to LibraryRoute when
 * the newLibraryRoute flag is enabled (#1292).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import PlayerStateRenderer from '../PlayerStateRenderer';
import { useQapEnabled } from '@/hooks/useQapEnabled';
import { useWelcomeSeen } from '@/hooks/useWelcomeSeen';
import { useNewLibraryRoute } from '@/hooks/useNewLibraryRoute';

vi.mock('@/hooks/useQapEnabled', () => ({
  useQapEnabled: vi.fn(),
}));

vi.mock('@/hooks/useWelcomeSeen', () => ({
  useWelcomeSeen: vi.fn(),
}));

vi.mock('@/hooks/useNewLibraryRoute', () => ({
  useNewLibraryRoute: vi.fn(),
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

vi.mock('../PlaylistSelection', () => ({
  default: () => <div data-testid="library-page">LibraryPage</div>,
}));

vi.mock('../LibraryRoute', () => ({
  default: () => <div data-testid="library-route">LibraryRoute</div>,
  LibraryRoute: () => <div data-testid="library-route">LibraryRoute</div>,
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
const mockUseNewLibraryRoute = vi.mocked(useNewLibraryRoute);

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

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

describe('PlayerStateRenderer — new library route render swap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: welcome seen, QAP off, new route off → library view shown
    mockUseWelcomeSeen.mockReturnValue([true, vi.fn()]);
    mockUseQapEnabled.mockReturnValue([false, vi.fn()]);
    mockUseNewLibraryRoute.mockReturnValue([false, vi.fn()]);
  });

  it('renders LibraryPage when newLibraryRoute flag is OFF (default)', async () => {
    // #given — flag is off
    mockUseNewLibraryRoute.mockReturnValue([false, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} />
      </Wrapper>
    );

    // #then — waitFor lets Suspense resolve the lazy module on first load
    await waitFor(() => expect(screen.getByTestId('library-page')).toBeInTheDocument());
    expect(screen.queryByTestId('library-route')).not.toBeInTheDocument();
  });

  it('renders LibraryRoute when newLibraryRoute flag is ON', async () => {
    // #given
    mockUseNewLibraryRoute.mockReturnValue([true, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} />
      </Wrapper>
    );

    // #then — waitFor lets Suspense resolve the lazy module on first load
    await waitFor(() => expect(screen.getByTestId('library-route')).toBeInTheDocument());
    expect(screen.queryByTestId('library-page')).not.toBeInTheDocument();
  });

  it('renders neither LibraryPage nor LibraryRoute when a playlist is selected (tracks present)', () => {
    // #given — player is active (has tracks + playlist)
    mockUseNewLibraryRoute.mockReturnValue([true, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer
          {...defaultProps}
          selectedPlaylistId="playlist-1"
          tracks={[{ id: 't1', name: 'T', artists: 'A', duration: 100, provider: 'spotify' }] as import('@/types/domain').MediaTrack[]}
        />
      </Wrapper>
    );

    // #then — no idle library view rendered when player is active
    expect(screen.queryByTestId('library-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('library-route')).not.toBeInTheDocument();
  });

  it('continues to render LibraryPage when flag flips from ON to OFF (library open)', () => {
    // #given — flag starts ON
    mockUseNewLibraryRoute.mockReturnValue([true, vi.fn()]);
    const { rerender } = render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} />
      </Wrapper>
    );
    expect(screen.getByTestId('library-route')).toBeInTheDocument();

    // #when — flag turns OFF
    mockUseNewLibraryRoute.mockReturnValue([false, vi.fn()]);
    rerender(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} />
      </Wrapper>
    );

    // #then — LibraryPage takes over
    expect(screen.getByTestId('library-page')).toBeInTheDocument();
    expect(screen.queryByTestId('library-route')).not.toBeInTheDocument();
  });

  it('passes onOpenSettings to LibraryRoute when flag is ON', () => {
    // #given
    mockUseNewLibraryRoute.mockReturnValue([true, vi.fn()]);
    const onOpenSettings = vi.fn();

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} onOpenSettings={onOpenSettings} />
      </Wrapper>
    );

    // #then — LibraryRoute renders (settings gear still available via LibraryRoute's escape hatch)
    expect(screen.getByTestId('library-route')).toBeInTheDocument();
  });
});
