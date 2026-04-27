/**
 * Tests for RecentlyPlayedSection — renders recently-played collection cards (#1294).
 * onSelect receives (kind, id, name, provider) derived from each entry's CollectionRef.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks', () => ({
  useRecentlyPlayedSection: vi.fn(),
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
    <div data-testid="section-recently-played">
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
    onSelect,
  }: {
    kind: string;
    id: string;
    name: string;
    onSelect: () => void;
  }) => (
    <button data-testid={`library-card-${kind}-${id}`} onClick={onSelect}>
      {name}
    </button>
  ),
}));

import { useRecentlyPlayedSection } from '../../hooks';
import RecentlyPlayedSection from '../RecentlyPlayedSection';

const mockUseRecentlyPlayedSection = vi.mocked(useRecentlyPlayedSection);

const baseProps = {
  layout: 'row' as const,
  onSelect: vi.fn(),
  onSeeAll: vi.fn(),
};

describe('RecentlyPlayedSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when isEmpty and not loading', () => {
    // #given
    mockUseRecentlyPlayedSection.mockReturnValue({ items: [], isLoading: false, isEmpty: true });

    // #when
    const { container } = render(<RecentlyPlayedSection {...baseProps} />);

    // #then
    expect(container).toBeEmptyDOMElement();
  });

  it('renders skeleton when loading with no items', () => {
    // #given
    mockUseRecentlyPlayedSection.mockReturnValue({ items: [], isLoading: true, isEmpty: true });

    // #when
    render(<RecentlyPlayedSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('section-skeleton')).toBeInTheDocument();
  });

  it('renders a card for a playlist entry using ref.id as card id', () => {
    // #given
    mockUseRecentlyPlayedSection.mockReturnValue({
      items: [{ ref: { kind: 'playlist', id: 'p1', provider: 'spotify' as const }, name: 'Chill Mix' }],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<RecentlyPlayedSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-card-playlist-p1')).toBeInTheDocument();
  });

  it('renders a card for an album entry using ref.id as card id', () => {
    // #given
    mockUseRecentlyPlayedSection.mockReturnValue({
      items: [{ ref: { kind: 'album', id: 'a1', provider: 'spotify' as const }, name: 'Dark Side' }],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<RecentlyPlayedSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-card-album-a1')).toBeInTheDocument();
  });

  it('renders a liked entry with kind=liked and id=liked', () => {
    // #given
    mockUseRecentlyPlayedSection.mockReturnValue({
      items: [{ ref: { kind: 'liked', provider: 'spotify' as const }, name: 'Liked Songs' }],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<RecentlyPlayedSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-card-liked-liked')).toBeInTheDocument();
  });

  it('shows See all when layout is row and items exceed 4', () => {
    // #given
    mockUseRecentlyPlayedSection.mockReturnValue({
      items: Array.from({ length: 5 }, (_, i) => ({
        ref: { kind: 'playlist' as const, id: `p${i}`, provider: 'spotify' as const },
        name: `Mix ${i}`,
      })),
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<RecentlyPlayedSection {...baseProps} layout="row" />);

    // #then
    expect(screen.getByRole('button', { name: 'See all' })).toBeInTheDocument();
  });

  it('calls onSelect with derived kind, id, name, provider when a card is clicked', () => {
    // #given
    const onSelect = vi.fn();
    mockUseRecentlyPlayedSection.mockReturnValue({
      items: [{ ref: { kind: 'album', id: 'a1', provider: 'spotify' as const }, name: 'Revolver' }],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<RecentlyPlayedSection {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('library-card-album-a1'));

    // #then
    expect(onSelect).toHaveBeenCalledWith('album', 'a1', 'Revolver', 'spotify');
  });
});
