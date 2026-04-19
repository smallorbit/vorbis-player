import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import PlayerStateRenderer from '../PlayerStateRenderer';
import { useQapEnabled } from '@/hooks/useQapEnabled';

vi.mock('@/hooks/useQapEnabled', () => ({
  useQapEnabled: vi.fn(),
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    activeDescriptor: {
      id: 'spotify',
      name: 'Spotify',
      capabilities: { hasSaveTrack: true, hasExternalLink: true },
    },
  })),
}));

vi.mock('../PlaylistSelection', () => ({
  default: () => <div data-testid="playlist-selection">PlaylistSelection</div>,
}));

vi.mock('../QuickAccessPanel', () => ({
  default: () => <div data-testid="quick-access-panel">QuickAccessPanel</div>,
}));

const mockUseQapEnabled = vi.mocked(useQapEnabled);

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
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('PlayerStateRenderer idle routing based on qapEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PlaylistSelection when qapEnabled is false (default)', async () => {
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
      expect(screen.getByTestId('playlist-selection')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('quick-access-panel')).not.toBeInTheDocument();
  });

  it('does not render QuickAccessPanel when qapEnabled is false (default)', async () => {
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
      expect(screen.queryByTestId('quick-access-panel')).not.toBeInTheDocument();
    });
  });

  it('renders QuickAccessPanel when qapEnabled is true', () => {
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
    expect(screen.queryByTestId('playlist-selection')).not.toBeInTheDocument();
  });

  it('does not render PlaylistSelection when qapEnabled is true', () => {
    // #given
    mockUseQapEnabled.mockReturnValue([true, vi.fn()]);

    // #when
    render(
      <Wrapper>
        <PlayerStateRenderer {...defaultProps} />
      </Wrapper>
    );

    // #then
    expect(screen.queryByTestId('playlist-selection')).not.toBeInTheDocument();
  });
});

describe('PlayerStateRenderer settings gear on idle views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(screen.getByTestId('playlist-selection')).toBeInTheDocument();
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
    expect(screen.queryByTestId('playlist-selection')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-access-panel')).not.toBeInTheDocument();
  });
});
