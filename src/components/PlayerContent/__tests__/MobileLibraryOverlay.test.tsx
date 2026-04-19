import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { theme } from '@/styles/theme';

vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}));

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

import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  MobileLibraryOverlay,
  MOBILE_LIBRARY_OVERLAY_DURATION_MS,
} from '../MobileLibraryOverlay';

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
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('mount lifecycle', () => {
    it('does not render the overlay when isOpen starts false', () => {
      // #given
      render(
        <Wrapper>
          <MobileLibraryOverlay {...baseProps} isOpen={false} />
        </Wrapper>,
      );

      // #then
      expect(screen.queryByTestId('mobile-library-overlay')).not.toBeInTheDocument();
    });

    it('renders the overlay in a hidden state immediately when opened', async () => {
      // #given
      const { rerender } = render(
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
      const overlay = await screen.findByTestId('mobile-library-overlay');
      expect(overlay).toHaveAttribute('data-state', 'closed');
    });

    it('flips to the open state on the next animation frame', async () => {
      // #given
      render(
        <Wrapper>
          <MobileLibraryOverlay {...baseProps} isOpen={true} />
        </Wrapper>,
      );

      // #then
      await waitFor(() => {
        expect(screen.getByTestId('mobile-library-overlay')).toHaveAttribute(
          'data-state',
          'open',
        );
      });
    });
  });

  describe('exit lifecycle', () => {
    it('keeps the overlay mounted while the exit transition runs', async () => {
      // #given
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { rerender } = render(
        <Wrapper>
          <MobileLibraryOverlay {...baseProps} isOpen={true} />
        </Wrapper>,
      );
      await waitFor(() => {
        expect(screen.getByTestId('mobile-library-overlay')).toHaveAttribute(
          'data-state',
          'open',
        );
      });

      // #when
      rerender(
        <Wrapper>
          <MobileLibraryOverlay {...baseProps} isOpen={false} />
        </Wrapper>,
      );

      // #then
      const overlay = screen.getByTestId('mobile-library-overlay');
      expect(overlay).toHaveAttribute('data-state', 'closed');
      expect(overlay).toBeInTheDocument();
    });

    it('unmounts the overlay after the exit transition duration', async () => {
      // #given
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { rerender } = render(
        <Wrapper>
          <MobileLibraryOverlay {...baseProps} isOpen={true} />
        </Wrapper>,
      );
      await waitFor(() => {
        expect(screen.getByTestId('mobile-library-overlay')).toBeInTheDocument();
      });

      // #when
      rerender(
        <Wrapper>
          <MobileLibraryOverlay {...baseProps} isOpen={false} />
        </Wrapper>,
      );
      act(() => {
        vi.advanceTimersByTime(MOBILE_LIBRARY_OVERLAY_DURATION_MS + 16);
      });

      // #then
      await waitFor(() => {
        expect(screen.queryByTestId('mobile-library-overlay')).not.toBeInTheDocument();
      });
    });
  });

  describe('reduced motion', () => {
    it('marks the overlay as reduced-motion when prefers-reduced-motion is reduce', async () => {
      // #given
      vi.mocked(useReducedMotion).mockReturnValue(true);
      render(
        <Wrapper>
          <MobileLibraryOverlay {...baseProps} isOpen={true} />
        </Wrapper>,
      );

      // #then
      const overlay = await screen.findByTestId('mobile-library-overlay');
      expect(overlay).toHaveAttribute('data-reduced-motion', 'true');
    });

    it('marks the overlay as not-reduced-motion when prefers-reduced-motion is not set', async () => {
      // #given
      vi.mocked(useReducedMotion).mockReturnValue(false);
      render(
        <Wrapper>
          <MobileLibraryOverlay {...baseProps} isOpen={true} />
        </Wrapper>,
      );

      // #then
      const overlay = await screen.findByTestId('mobile-library-overlay');
      expect(overlay).toHaveAttribute('data-reduced-motion', 'false');
    });

    it('unmounts immediately on close when reduced motion is enabled', async () => {
      // #given
      vi.mocked(useReducedMotion).mockReturnValue(true);
      const { rerender } = render(
        <Wrapper>
          <MobileLibraryOverlay {...baseProps} isOpen={true} />
        </Wrapper>,
      );
      await waitFor(() => {
        expect(screen.getByTestId('mobile-library-overlay')).toBeInTheDocument();
      });

      // #when
      rerender(
        <Wrapper>
          <MobileLibraryOverlay {...baseProps} isOpen={false} />
        </Wrapper>,
      );

      // #then
      await waitFor(() => {
        expect(screen.queryByTestId('mobile-library-overlay')).not.toBeInTheDocument();
      });
    });
  });
});
