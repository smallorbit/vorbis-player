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
  it('renders outlined heart icon when isLiked is false', () => {
    renderLikeButton({ isLiked: false });
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).toBeTruthy();
    const path = svg!.querySelector('path');
    expect(path!.getAttribute('d')).toContain('16.5 3c-1.74');
  });

  it('renders filled heart icon when isLiked is true', () => {
    renderLikeButton({ isLiked: true });
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).toBeTruthy();
    const path = svg!.querySelector('path');
    expect(path!.getAttribute('d')).toContain('12 21.35l-1.45');
  });

  it('shows loading spinner when isLoading is true', () => {
    renderLikeButton({ isLoading: true });
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    expect(svg).toBeNull();
  });

  it('calls onToggleLike on click in normal state', () => {
    const { props } = renderLikeButton();
    fireEvent.click(screen.getByRole('button'));
    expect(props.onToggleLike).toHaveBeenCalledOnce();
  });

  it('does not call onToggleLike when isLoading is true', () => {
    const { props } = renderLikeButton({ isLoading: true });
    fireEvent.click(screen.getByRole('button'));
    expect(props.onToggleLike).not.toHaveBeenCalled();
  });

  it('does not call onToggleLike when trackId is undefined', () => {
    const { props } = renderLikeButton({ trackId: undefined });
    fireEvent.click(screen.getByRole('button'));
    expect(props.onToggleLike).not.toHaveBeenCalled();
  });

  it('has correct aria-label for each state', () => {
    const { rerender } = render(
      <LikeButton {...defaultProps} isLiked={false} />
    );
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Add to Liked Songs'
    );

    rerender(<LikeButton {...defaultProps} isLiked={true} />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Remove from Liked Songs'
    );

    rerender(<LikeButton {...defaultProps} isLoading={true} />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Loading...'
    );

    rerender(
      <LikeButton {...defaultProps} trackId={undefined} />
    );
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'No track selected'
    );
  });
});
