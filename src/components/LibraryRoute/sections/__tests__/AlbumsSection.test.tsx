/**
 * Tests for AlbumsSection — renders album cards with artist subtitle (#1294).
 * Threshold: 8 (same as PlaylistsSection).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks', () => ({
  useAlbumsSection: vi.fn(),
}));

vi.mock('../Section', () => ({
  default: ({
    children,
    onSeeAll,
  }: {
    title: string;
    children: React.ReactNode;
    onSeeAll?: () => void;
  }) => (
    <div data-testid="section-albums">
      {onSeeAll && <button onClick={onSeeAll}>See all</button>}
      {children}
    </div>
  ),
}));

vi.mock('../SectionSkeleton', () => ({
  default: () => <div data-testid="section-skeleton" />,
}));

vi.mock('../../card/LibraryCard', () => ({
  default: ({
    kind,
    id,
    name,
    subtitle,
    onSelect,
  }: {
    kind: string;
    id: string;
    name: string;
    subtitle?: string;
    onSelect: () => void;
  }) => (
    <button data-testid={`library-card-${kind}-${id}`} data-subtitle={subtitle} onClick={onSelect}>
      {name}
    </button>
  ),
}));

import { useAlbumsSection } from '../../hooks';
import AlbumsSection from '../AlbumsSection';

const mockUseAlbumsSection = vi.mocked(useAlbumsSection);

const baseProps = {
  layout: 'row' as const,
  onSelect: vi.fn(),
  onSeeAll: vi.fn(),
};

describe('AlbumsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when isEmpty and not loading', () => {
    // #given
    mockUseAlbumsSection.mockReturnValue({ items: [], isLoading: false, isEmpty: true });

    // #when
    const { container } = render(<AlbumsSection {...baseProps} />);

    // #then
    expect(container).toBeEmptyDOMElement();
  });

  it('renders skeleton when loading with no items', () => {
    // #given
    mockUseAlbumsSection.mockReturnValue({ items: [], isLoading: true, isEmpty: true });

    // #when
    render(<AlbumsSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('section-skeleton')).toBeInTheDocument();
  });

  it('renders a card for each album with artist subtitle', () => {
    // #given
    mockUseAlbumsSection.mockReturnValue({
      items: [
        { id: 'a1', name: 'Dark Side', artists: 'Pink Floyd', provider: 'spotify' as const, images: [] },
      ],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<AlbumsSection {...baseProps} />);

    // #then
    const card = screen.getByTestId('library-card-album-a1');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('data-subtitle', 'Pink Floyd');
  });

  it('shows See all when layout is row and items exceed 8', () => {
    // #given
    mockUseAlbumsSection.mockReturnValue({
      items: Array.from({ length: 9 }, (_, i) => ({
        id: `a${i}`,
        name: `Album ${i}`,
        artists: 'Artist',
        provider: 'spotify' as const,
        images: [],
      })),
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<AlbumsSection {...baseProps} layout="row" />);

    // #then
    expect(screen.getByRole('button', { name: 'See all' })).toBeInTheDocument();
  });

  it('calls onSelect with album kind, id, name, provider on card click', () => {
    // #given
    const onSelect = vi.fn();
    mockUseAlbumsSection.mockReturnValue({
      items: [{ id: 'a1', name: 'OK Computer', artists: 'Radiohead', provider: 'spotify' as const, images: [] }],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<AlbumsSection {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('library-card-album-a1'));

    // #then
    expect(onSelect).toHaveBeenCalledWith('album', 'a1', 'OK Computer', 'spotify');
  });
});
