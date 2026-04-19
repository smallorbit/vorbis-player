import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { theme } from '@/styles/theme';

vi.mock('@/components/PlaylistSelection', () => ({
  default: ({ onNavigateToPlayer }: { onNavigateToPlayer?: () => void }) => (
    <div data-testid="library-page-stub">
      <button onClick={onNavigateToPlayer}>close</button>
    </div>
  ),
}));

vi.mock('@/components/ProfiledComponent', () => ({
  ProfiledComponent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { MobileLibraryOverlay } from '../MobileLibraryOverlay';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

const baseProps = {
  isPlaying: false,
  onPlaylistSelect: vi.fn(),
  onAddToQueue: vi.fn(),
  onPlayLikedTracks: vi.fn(),
  onQueueLikedTracks: vi.fn(),
  onCloseLibrary: vi.fn(),
};

describe('MobileLibraryOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render the overlay before it has ever been opened', () => {
    // #given
    render(
      <Wrapper>
        <MobileLibraryOverlay {...baseProps} isOpen={false} />
      </Wrapper>,
    );

    // #then
    expect(screen.queryByTestId('mobile-library-overlay')).not.toBeInTheDocument();
  });

  it('renders the overlay in the open state when opened', async () => {
    // #given
    render(
      <Wrapper>
        <MobileLibraryOverlay {...baseProps} isOpen={true} />
      </Wrapper>,
    );

    // #then
    await screen.findByTestId('library-page-stub');
    expect(screen.getByTestId('mobile-library-overlay')).toHaveAttribute('data-state', 'open');
  });

  it('keeps the overlay mounted after closing so the CSS transition can run', async () => {
    // #given
    const { rerender } = render(
      <Wrapper>
        <MobileLibraryOverlay {...baseProps} isOpen={true} />
      </Wrapper>,
    );
    await screen.findByTestId('library-page-stub');

    // #when
    rerender(
      <Wrapper>
        <MobileLibraryOverlay {...baseProps} isOpen={false} />
      </Wrapper>,
    );

    // #then
    expect(screen.getByTestId('mobile-library-overlay')).toHaveAttribute('data-state', 'closed');
  });

  it('returns to the open state when re-opened after a close', async () => {
    // #given
    const { rerender } = render(
      <Wrapper>
        <MobileLibraryOverlay {...baseProps} isOpen={true} />
      </Wrapper>,
    );
    await screen.findByTestId('library-page-stub');
    rerender(
      <Wrapper>
        <MobileLibraryOverlay {...baseProps} isOpen={false} />
      </Wrapper>,
    );

    // #when
    rerender(
      <Wrapper>
        <MobileLibraryOverlay {...baseProps} isOpen={true} />
      </Wrapper>,
    );

    // #then
    expect(screen.getByTestId('mobile-library-overlay')).toHaveAttribute('data-state', 'open');
  });
});
