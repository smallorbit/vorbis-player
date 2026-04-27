import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LibraryCard from '../LibraryCard';

vi.mock('@/components/ProviderIcon', () => ({
  default: ({ provider }: { provider: string }) => (
    <span data-testid={`provider-icon-${provider}`} />
  ),
}));

const baseProps = {
  kind: 'playlist' as const,
  id: 'p1',
  name: 'Sample Playlist',
  variant: 'row' as const,
  onSelect: vi.fn(),
};

describe('LibraryCard', () => {
  it('renders artwork image when imageUrl provided', () => {
    // #given
    render(<LibraryCard {...baseProps} imageUrl="https://example.com/x.png" />);

    // #then
    const img = document.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://example.com/x.png');
  });

  it('renders placeholder glyph when no imageUrl', () => {
    // #given
    render(<LibraryCard {...baseProps} />);

    // #then
    expect(screen.getByText('♪')).toBeInTheDocument();
  });

  it('shows provider icon only when showProviderBadge is true', () => {
    // #given
    const { rerender } = render(<LibraryCard {...baseProps} provider="spotify" />);
    expect(screen.queryByTestId('provider-icon-spotify')).not.toBeInTheDocument();

    // #when
    rerender(<LibraryCard {...baseProps} provider="spotify" showProviderBadge />);

    // #then
    expect(screen.getByTestId('provider-icon-spotify')).toBeInTheDocument();
  });

  it('fires onSelect on click when no onContextMenuRequest', () => {
    // #given
    const onSelect = vi.fn();
    render(<LibraryCard {...baseProps} onSelect={onSelect} />);

    // #when
    fireEvent.click(screen.getByTestId('library-card-playlist-p1'));

    // #then
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('fires onContextMenuRequest with click coords on right-click', () => {
    // #given
    const onContextMenuRequest = vi.fn();
    render(<LibraryCard {...baseProps} onContextMenuRequest={onContextMenuRequest} />);

    // #when
    fireEvent.contextMenu(screen.getByTestId('library-card-playlist-p1'), { clientX: 50, clientY: 75 });

    // #then
    expect(onContextMenuRequest).toHaveBeenCalledTimes(1);
    const req = onContextMenuRequest.mock.calls[0][0];
    expect(req.kind).toBe('playlist');
    expect(req.id).toBe('p1');
    expect(req.anchorRect.x).toBe(50);
    expect(req.anchorRect.y).toBe(75);
  });

  it('uses correct testid for different kinds', () => {
    // #given
    render(<LibraryCard {...baseProps} kind="album" id="a1" />);

    // #then
    expect(screen.getByTestId('library-card-album-a1')).toBeInTheDocument();
  });
});
