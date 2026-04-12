import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
