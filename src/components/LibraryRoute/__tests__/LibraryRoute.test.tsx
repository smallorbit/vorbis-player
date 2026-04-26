import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LibraryRoute from '../index';

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: vi.fn(),
}));

import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';

const baseProps = {
  onPlaylistSelect: vi.fn(),
  onOpenSettings: vi.fn(),
  hasResumableSession: false,
};

describe('LibraryRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('layout selection', () => {
    it('renders mobile shell when isMobile is true', () => {
      // #given
      vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: true } as ReturnType<typeof usePlayerSizingContext>);

      // #when
      render(<LibraryRoute {...baseProps} />);

      // #then
      expect(screen.getByTestId('library-route-mobile')).toBeInTheDocument();
      expect(screen.queryByTestId('library-route-desktop')).not.toBeInTheDocument();
    });

    it('renders desktop shell when isMobile is false', () => {
      // #given
      vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);

      // #when
      render(<LibraryRoute {...baseProps} />);

      // #then
      expect(screen.getByTestId('library-route-desktop')).toBeInTheDocument();
      expect(screen.queryByTestId('library-route-mobile')).not.toBeInTheDocument();
    });
  });

  describe('session props', () => {
    it('renders with hasResumableSession true and callable onResume', () => {
      // #given
      const onResume = vi.fn();
      vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);

      // #when
      render(<LibraryRoute {...baseProps} hasResumableSession={true} onResume={onResume} />);

      // #then
      expect(screen.getByTestId('library-route-desktop')).toBeInTheDocument();
    });

    it('renders with hasResumableSession false without onResume', () => {
      // #given
      vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);

      // #when
      render(<LibraryRoute {...baseProps} hasResumableSession={false} />);

      // #then
      expect(screen.getByTestId('library-route-desktop')).toBeInTheDocument();
    });
  });

  describe('optional callback props', () => {
    it('accepts onAddToQueue as optional', () => {
      // #given
      const onAddToQueue = vi.fn().mockResolvedValue(null);
      vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);

      // #when / #then — no error on render
      expect(() => render(<LibraryRoute {...baseProps} onAddToQueue={onAddToQueue} />)).not.toThrow();
    });

    it('accepts onPlayLikedTracks as optional', () => {
      // #given
      const onPlayLikedTracks = vi.fn().mockResolvedValue(undefined);
      vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);

      // #when / #then — no error on render
      expect(() => render(<LibraryRoute {...baseProps} onPlayLikedTracks={onPlayLikedTracks} />)).not.toThrow();
    });

    it('accepts onQueueLikedTracks as optional', () => {
      // #given
      const onQueueLikedTracks = vi.fn();
      vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);

      // #when / #then — no error on render
      expect(() => render(<LibraryRoute {...baseProps} onQueueLikedTracks={onQueueLikedTracks} />)).not.toThrow();
    });
  });
});
