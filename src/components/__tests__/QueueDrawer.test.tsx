import React, { Suspense } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { theme } from '@/styles/theme';
import { makeMediaTrack } from '@/test/fixtures';

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: vi.fn(() => ({
    viewport: { width: 1200, height: 800 },
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    transitionDuration: 300,
    transitionEasing: 'ease',
  })),
}));

vi.mock('@/components/QueueTrackList', () => ({
  default: ({ tracks, currentTrackIndex: _currentTrackIndex, onTrackSelect, onRemoveTrack }: {
    tracks: { id: string; name: string }[];
    currentTrackIndex: number;
    onTrackSelect: (i: number) => void;
    onRemoveTrack?: (i: number) => void;
  }) => (
    <div data-testid="queue-track-list">
      {tracks.map((t, i) => (
        <div key={t.id} data-testid={`track-${i}`}>
          <span>{t.name}</span>
          <button onClick={() => onTrackSelect(i)}>select</button>
          {onRemoveTrack && <button onClick={() => onRemoveTrack(i)}>remove</button>}
        </div>
      ))}
    </div>
  ),
}));

import QueueDrawer from '../QueueDrawer';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
    <Suspense fallback={<div>Loading...</div>}>
      {children}
    </Suspense>
  </ThemeProvider>
);

describe('QueueDrawer', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    tracks: [
      makeMediaTrack({ id: 'a', name: 'Track A' }),
      makeMediaTrack({ id: 'b', name: 'Track B' }),
    ],
    currentTrackIndex: 0,
    onTrackSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the drawer with an "Up Next" title when not in radio mode', () => {
      // #given
      render(<Wrapper><QueueDrawer {...defaultProps} /></Wrapper>);

      // #then
      expect(screen.getByText('Up Next')).toBeInTheDocument();
    });

    it('renders "Radio" title when radioActive is true', () => {
      // #given
      render(
        <Wrapper>
          <QueueDrawer {...defaultProps} radioActive radioSeedDescription="Based on Song X" />
        </Wrapper>
      );

      // #then
      expect(screen.getByText('Radio')).toBeInTheDocument();
      expect(screen.getByText('Based on Song X')).toBeInTheDocument();
    });

    it('renders the track list with provided tracks', () => {
      // #given
      render(<Wrapper><QueueDrawer {...defaultProps} /></Wrapper>);

      // #then
      expect(screen.getByTestId('queue-track-list')).toBeInTheDocument();
      expect(screen.getByText('Track A')).toBeInTheDocument();
      expect(screen.getByText('Track B')).toBeInTheDocument();
    });

    it('renders empty track list when no tracks are provided', () => {
      // #given
      render(
        <Wrapper>
          <QueueDrawer {...defaultProps} tracks={[]} />
        </Wrapper>
      );

      // #then
      expect(screen.getByTestId('queue-track-list')).toBeInTheDocument();
    });

    it('renders save button when canSaveQueue is true', () => {
      // #given
      render(
        <Wrapper>
          <QueueDrawer {...defaultProps} canSaveQueue onSaveQueue={vi.fn()} />
        </Wrapper>
      );

      // #then
      expect(screen.getByLabelText('Save as playlist')).toBeInTheDocument();
    });

    it('does not render save button when canSaveQueue is false', () => {
      // #given
      render(<Wrapper><QueueDrawer {...defaultProps} /></Wrapper>);

      // #then
      expect(screen.queryByLabelText('Save as playlist')).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClose when overlay is clicked', () => {
      // #given
      const onClose = vi.fn();
      const { container } = render(
        <Wrapper><QueueDrawer {...defaultProps} onClose={onClose} /></Wrapper>
      );

      // #when
      const overlay = container.ownerDocument.body.querySelector('[class]');
      if (overlay) fireEvent.click(overlay);

      // #then
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      // #given
      const onClose = vi.fn();
      render(<Wrapper><QueueDrawer {...defaultProps} onClose={onClose} /></Wrapper>);

      // #when
      fireEvent.click(screen.getByText('×'));

      // #then
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onTrackSelect and onClose when a track is selected', () => {
      // #given
      const onTrackSelect = vi.fn();
      const onClose = vi.fn();
      render(
        <Wrapper>
          <QueueDrawer {...defaultProps} onTrackSelect={onTrackSelect} onClose={onClose} />
        </Wrapper>
      );

      // #when
      fireEvent.click(screen.getAllByText('select')[1]);

      // #then
      expect(onTrackSelect).toHaveBeenCalledWith(1);
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onSaveQueue when save button is clicked', () => {
      // #given
      const onSaveQueue = vi.fn();
      render(
        <Wrapper>
          <QueueDrawer {...defaultProps} canSaveQueue onSaveQueue={onSaveQueue} />
        </Wrapper>
      );

      // #when
      fireEvent.click(screen.getByLabelText('Save as playlist'));

      // #then
      expect(onSaveQueue).toHaveBeenCalled();
    });

    it('calls onRemoveTrack when a track is removed', () => {
      // #given
      const onRemoveTrack = vi.fn();
      render(
        <Wrapper>
          <QueueDrawer {...defaultProps} onRemoveTrack={onRemoveTrack} />
        </Wrapper>
      );

      // #when
      fireEvent.click(screen.getAllByText('remove')[0]);

      // #then
      expect(onRemoveTrack).toHaveBeenCalledWith(0);
    });
  });
});
