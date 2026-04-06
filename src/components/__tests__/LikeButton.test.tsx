import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import LikeButton from '../LikeButton';

const defaultProps = {
  trackId: 'track-1',
  isLiked: false,
  isLoading: false,
  accentColor: '#1db954',
  onToggleLike: vi.fn(),
};

function renderLikeButton(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, onToggleLike: vi.fn(), ...overrides };
  const result = render(<LikeButton {...props} />);
  return { ...result, props };
}

describe('LikeButton', () => {
  it('renders both outline and filled heart SVGs for cross-fade', () => {
    renderLikeButton({ isLiked: false });
    const button = screen.getByRole('button');
    const svgs = button.querySelectorAll('svg');
    expect(svgs).toHaveLength(2);
    expect(svgs[0]).toHaveClass('heart-outline');
    expect(svgs[1]).toHaveClass('heart-filled');
  });

  it('is disabled and shows heart icon when isLoading is true', () => {
    renderLikeButton({ isLoading: true });
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).toBeTruthy();
  });

  it('calls onToggleLike on click in normal state', () => {
    // #given
    const { props } = renderLikeButton();

    // #when
    fireEvent.click(screen.getByRole('button'));

    // #then
    expect(props.onToggleLike).toHaveBeenCalledOnce();
  });

  it('does not call onToggleLike when isLoading is true', () => {
    // #given
    const { props } = renderLikeButton({ isLoading: true });

    // #when
    fireEvent.click(screen.getByRole('button'));

    // #then
    expect(props.onToggleLike).not.toHaveBeenCalled();
  });

  it('does not call onToggleLike when trackId is undefined', () => {
    // #given
    const { props } = renderLikeButton({ trackId: undefined });

    // #when
    fireEvent.click(screen.getByRole('button'));

    // #then
    expect(props.onToggleLike).not.toHaveBeenCalled();
  });

  it('has correct aria-label for each state', () => {
    // #given
    const { rerender } = render(
      <LikeButton {...defaultProps} isLiked={false} />
    );

    // #then
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Add to Liked Songs'
    );

    // #when
    rerender(<LikeButton {...defaultProps} isLiked={true} />);

    // #then
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Remove from Liked Songs'
    );

    // #when
    rerender(<LikeButton {...defaultProps} isLoading={true} />);

    // #then
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Loading...'
    );

    // #when
    rerender(
      <LikeButton {...defaultProps} trackId={undefined} />
    );

    // #then
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'No track selected'
    );
  });
});
