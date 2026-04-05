import React, { Suspense } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { theme } from '@/styles/theme';
import { makeMediaTrack } from '@/test/fixtures';

vi.mock('@/hooks/useVerticalSwipeGesture', () => ({
  useVerticalSwipeGesture: vi.fn(() => ({
    ref: { current: null },
    isDragging: false,
    dragOffset: 0,
  })),
}));

vi.mock('@/components/QueueTrackList', () => ({
  default: ({ tracks, currentTrackIndex, onTrackSelect }: {
    tracks: { id: string; name: string }[];
    currentTrackIndex: number;
    onTrackSelect: (i: number) => void;
  }) => (
    <div data-testid="queue-track-list">
      {tracks.map((t, i) => (
        <div key={t.id} data-testid={`track-${i}`}>
          <span>{t.name}</span>
          <button onClick={() => onTrackSelect(i)}>select</button>
        </div>
      ))}
    </div>
  ),
}));

import QueueBottomSheet from '../QueueBottomSheet';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
    <Suspense fallback={<div>Loading...</div>}>
      {children}
    </Suspense>
  </ThemeProvider>
);

describe('QueueBottomSheet', () => {
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
    it('renders "Queue" title when not in radio mode', () => {
      // #given
      render(<Wrapper><QueueBottomSheet {...defaultProps} /></Wrapper>);

      // #then
      expect(screen.getByText('Queue')).toBeInTheDocument();
    });

    it('renders "Radio" title when radioActive is true', () => {
      // #given
      render(
        <Wrapper>
          <QueueBottomSheet {...defaultProps} radioActive radioSeedDescription="Based on Track A" />
        </Wrapper>
      );

      // #then
      expect(screen.getByText('Radio')).toBeInTheDocument();
    });

    it('renders seed description when radioActive and radioSeedDescription are set', () => {
      // #given
      render(
        <Wrapper>
          <QueueBottomSheet {...defaultProps} radioActive radioSeedDescription="Based on Track A" />
        </Wrapper>
      );

      // #then
      expect(screen.getByText('Based on Track A')).toBeInTheDocument();
    });

    it('renders track list when open', () => {
      // #given
      render(<Wrapper><QueueBottomSheet {...defaultProps} isOpen={true} /></Wrapper>);

      // #then
      expect(screen.getByTestId('queue-track-list')).toBeInTheDocument();
      expect(screen.getByText('Track A')).toBeInTheDocument();
      expect(screen.getByText('Track B')).toBeInTheDocument();
    });

    it('does not render track list when closed', () => {
      // #given
      render(<Wrapper><QueueBottomSheet {...defaultProps} isOpen={false} /></Wrapper>);

      // #then
      expect(screen.queryByTestId('queue-track-list')).not.toBeInTheDocument();
    });

    it('renders save button when canSaveQueue is true', () => {
      // #given
      render(
        <Wrapper>
          <QueueBottomSheet {...defaultProps} canSaveQueue onSaveQueue={vi.fn()} />
        </Wrapper>
      );

      // #then
      expect(screen.getByLabelText('Save queue as playlist')).toBeInTheDocument();
    });

    it('does not render save button when canSaveQueue is false', () => {
      // #given
      render(<Wrapper><QueueBottomSheet {...defaultProps} /></Wrapper>);

      // #then
      expect(screen.queryByLabelText('Save queue as playlist')).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClose when overlay is clicked', () => {
      // #given
      const onClose = vi.fn();
      render(<Wrapper><QueueBottomSheet {...defaultProps} onClose={onClose} /></Wrapper>);

      // #when — find the overlay by aria-hidden attribute
      const overlay = document.body.querySelector('[aria-hidden="true"]');
      if (overlay) fireEvent.click(overlay);

      // #then
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onTrackSelect and onClose when a track is selected', () => {
      // #given
      const onTrackSelect = vi.fn();
      const onClose = vi.fn();
      render(
        <Wrapper>
          <QueueBottomSheet {...defaultProps} onTrackSelect={onTrackSelect} onClose={onClose} />
        </Wrapper>
      );

      // #when
      fireEvent.click(screen.getAllByText('select')[1]);

      // #then
      expect(onTrackSelect).toHaveBeenCalledWith(1);
      expect(onClose).toHaveBeenCalled();
    });
  });
});
