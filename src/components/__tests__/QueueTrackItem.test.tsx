import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { theme } from '@/styles/theme';
import { makeMediaTrack } from '@/test/fixtures';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
}));

vi.mock('@/hooks/useHorizontalSwipeToRemove', () => ({
  useHorizontalSwipeToRemove: vi.fn(() => ({
    ref: { current: null },
    offsetX: 0,
    isSwiping: false,
    isRevealed: false,
    reset: vi.fn(),
  })),
}));

vi.mock('@/hooks/useLongPress', () => ({
  useLongPress: vi.fn(() => ({
    onPointerDown: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerCancel: vi.fn(),
    onPointerMove: vi.fn(),
  })),
}));

vi.mock('@/hooks/useLikeTrack', () => ({
  useLikeTrack: vi.fn(() => ({
    isLiked: false,
    isLikePending: false,
    handleLikeToggle: vi.fn(),
    canSaveTrack: false,
  })),
}));

vi.mock('@/components/ProviderIcon', () => ({
  default: () => <span data-testid="provider-icon" />,
}));

vi.mock('@/components/QueueContextMenu', () => ({
  QueueContextMenu: () => null,
}));

import { SortableQueueItem, SwipeableQueueItem } from '../QueueTrackItem';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('SortableQueueItem', () => {
  const defaultProps = {
    track: makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' }),
    index: 0,
    isSelected: false,
    onSelect: vi.fn(),
    onRemove: vi.fn(),
    isDragActive: false,
    isEditMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders track name and artist', () => {
    // #when
    render(<Wrapper><SortableQueueItem {...defaultProps} /></Wrapper>);

    // #then
    expect(screen.getByText('Test Track')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
  });

  it('calls onSelect when clicked and not in edit or drag mode', () => {
    // #given
    const onSelect = vi.fn();
    render(<Wrapper><SortableQueueItem {...defaultProps} onSelect={onSelect} /></Wrapper>);

    // #when
    fireEvent.click(screen.getByText('Test Track'));

    // #then
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('does not call onSelect when isDragActive is true', () => {
    // #given
    const onSelect = vi.fn();
    render(
      <Wrapper>
        <SortableQueueItem {...defaultProps} onSelect={onSelect} isDragActive={true} />
      </Wrapper>
    );

    // #when
    fireEvent.click(screen.getByText('Test Track'));

    // #then
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not call onSelect when isEditMode is true', () => {
    // #given
    const onSelect = vi.fn();
    render(
      <Wrapper>
        <SortableQueueItem {...defaultProps} onSelect={onSelect} isEditMode={true} />
      </Wrapper>
    );

    // #when
    fireEvent.click(screen.getByText('Test Track'));

    // #then
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows drag handle in edit mode', () => {
    // #given / #when
    render(
      <Wrapper>
        <SortableQueueItem {...defaultProps} isEditMode={true} />
      </Wrapper>
    );

    // #then — GripIcon renders 6 circles; drag handle container must exist in DOM
    // The DragHandle wraps the GripIcon SVG; assert at least one circle is present
    const svgCircles = document.querySelectorAll('circle');
    expect(svgCircles.length).toBeGreaterThan(0);
  });

  it('shows remove button in edit mode for non-selected track', () => {
    // #given / #when
    render(
      <Wrapper>
        <SortableQueueItem {...defaultProps} isEditMode={true} isSelected={false} />
      </Wrapper>
    );

    // #then
    expect(screen.getByLabelText('Remove Test Track')).toBeInTheDocument();
  });

  it('does not show remove button for selected track in edit mode', () => {
    // #given / #when
    render(
      <Wrapper>
        <SortableQueueItem {...defaultProps} isEditMode={true} isSelected={true} />
      </Wrapper>
    );

    // #then
    expect(screen.queryByLabelText('Remove Test Track')).not.toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked', () => {
    // #given
    const onRemove = vi.fn();
    render(
      <Wrapper>
        <SortableQueueItem {...defaultProps} onRemove={onRemove} isEditMode={true} isSelected={false} />
      </Wrapper>
    );

    // #when
    fireEvent.click(screen.getByLabelText('Remove Test Track'));

    // #then
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});

describe('SwipeableQueueItem', () => {
  const defaultProps = {
    track: makeMediaTrack({ id: 'track-2', name: 'Swipeable Track', artists: 'Swipe Artist' }),
    index: 1,
    isSelected: false,
    onSelect: vi.fn(),
    onRemove: vi.fn(),
    isEditMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders track name and artist', () => {
    // #when
    render(<Wrapper><SwipeableQueueItem {...defaultProps} /></Wrapper>);

    // #then
    expect(screen.getByText('Swipeable Track')).toBeInTheDocument();
    expect(screen.getByText('Swipe Artist')).toBeInTheDocument();
  });

  it('calls onSelect when clicked and not in edit mode', () => {
    // #given
    const onSelect = vi.fn();
    render(<Wrapper><SwipeableQueueItem {...defaultProps} onSelect={onSelect} /></Wrapper>);

    // #when
    fireEvent.click(screen.getByText('Swipeable Track'));

    // #then
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('does not render swipe UI when not in edit mode', () => {
    // #given / #when
    render(<Wrapper><SwipeableQueueItem {...defaultProps} isEditMode={false} /></Wrapper>);

    // #then — SwipeRemoveBackdrop "Remove" button should not be present
    expect(screen.queryByRole('button', { name: 'Remove Swipeable Track' })).not.toBeInTheDocument();
  });

  it('does not render swipe UI for the currently selected track even in edit mode', () => {
    // #given / #when
    render(
      <Wrapper>
        <SwipeableQueueItem {...defaultProps} isEditMode={true} isSelected={true} />
      </Wrapper>
    );

    // #then — selected track is not removable, so swipe UI should not appear
    expect(screen.queryByRole('button', { name: 'Remove Swipeable Track' })).not.toBeInTheDocument();
  });
});
