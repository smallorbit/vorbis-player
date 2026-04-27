/**
 * Tests for PinnedSection — renders pinned playlists + albums as library cards (#1294).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks', () => ({
  usePinnedSection: vi.fn(),
}));

vi.mock('../Section', () => ({
  default: ({
    title,
    children,
    onSeeAll,
  }: {
    title: string;
    children: React.ReactNode;
    onSeeAll?: () => void;
  }) => (
    <div data-testid={`section-${title.toLowerCase()}`}>
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
    provider,
    onSelect,
  }: {
    kind: string;
    id: string;
    name: string;
    subtitle?: string;
    provider?: string;
    onSelect: () => void;
  }) => (
    <button
      data-testid={`library-card-${kind}-${id}`}
      data-provider={provider}
      data-subtitle={subtitle}
      onClick={onSelect}
    >
      {name}
    </button>
  ),
}));

import { usePinnedSection } from '../../hooks';
import PinnedSection from '../PinnedSection';

const mockUsePinnedSection = vi.mocked(usePinnedSection);

const baseProps = {
  layout: 'row' as const,
  onSelect: vi.fn(),
  onSeeAll: vi.fn(),
};

describe('PinnedSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when isEmpty and not loading', () => {
    // #given
    mockUsePinnedSection.mockReturnValue({
      combined: [],
      pinnedPlaylists: [],
      pinnedAlbums: [],
      isLoading: false,
      isEmpty: true,
    });

    // #when
    const { container } = render(<PinnedSection {...baseProps} />);

    // #then
    expect(container).toBeEmptyDOMElement();
  });

  it('renders skeleton when loading with no items', () => {
    // #given
    mockUsePinnedSection.mockReturnValue({
      combined: [],
      pinnedPlaylists: [],
      pinnedAlbums: [],
      isLoading: true,
      isEmpty: true,
    });

    // #when
    render(<PinnedSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('section-skeleton')).toBeInTheDocument();
  });

  it('renders cards for each combined item', () => {
    // #given
    mockUsePinnedSection.mockReturnValue({
      combined: [
        { kind: 'playlist', id: 'p1', name: 'Alpha', provider: 'spotify' },
        { kind: 'album', id: 'a1', name: 'Beta', provider: 'spotify' },
      ],
      pinnedPlaylists: [],
      pinnedAlbums: [],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<PinnedSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-card-playlist-p1')).toBeInTheDocument();
    expect(screen.getByTestId('library-card-album-a1')).toBeInTheDocument();
  });

  it('shows See all when layout is row and items exceed 6', () => {
    // #given
    mockUsePinnedSection.mockReturnValue({
      combined: Array.from({ length: 7 }, (_, i) => ({
        kind: 'playlist' as const,
        id: `p${i}`,
        name: `Playlist ${i}`,
      })),
      pinnedPlaylists: [],
      pinnedAlbums: [],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<PinnedSection {...baseProps} layout="row" />);

    // #then
    expect(screen.getByRole('button', { name: 'See all' })).toBeInTheDocument();
  });

  it('does not show See all when layout is row and items are at or below 6', () => {
    // #given
    mockUsePinnedSection.mockReturnValue({
      combined: Array.from({ length: 6 }, (_, i) => ({
        kind: 'playlist' as const,
        id: `p${i}`,
        name: `Playlist ${i}`,
      })),
      pinnedPlaylists: [],
      pinnedAlbums: [],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<PinnedSection {...baseProps} layout="row" />);

    // #then
    expect(screen.queryByRole('button', { name: 'See all' })).not.toBeInTheDocument();
  });

  it('does not show See all when layout is grid even with many items', () => {
    // #given
    mockUsePinnedSection.mockReturnValue({
      combined: Array.from({ length: 10 }, (_, i) => ({
        kind: 'playlist' as const,
        id: `p${i}`,
        name: `Playlist ${i}`,
      })),
      pinnedPlaylists: [],
      pinnedAlbums: [],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<PinnedSection {...baseProps} layout="grid" />);

    // #then
    expect(screen.queryByRole('button', { name: 'See all' })).not.toBeInTheDocument();
  });

  it('calls onSelect with kind, id, name, provider when a card is clicked', () => {
    // #given
    const onSelect = vi.fn();
    mockUsePinnedSection.mockReturnValue({
      combined: [{ kind: 'album', id: 'a1', name: 'Dark Side', provider: 'spotify' as const }],
      pinnedPlaylists: [],
      pinnedAlbums: [],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<PinnedSection {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('library-card-album-a1'));

    // #then
    expect(onSelect).toHaveBeenCalledWith('album', 'a1', 'Dark Side', 'spotify');
  });

  it('renders a kind:liked card from combined', () => {
    // #given
    mockUsePinnedSection.mockReturnValue({
      combined: [{ kind: 'liked', id: 'liked-songs', name: 'Liked Songs', subtitle: '42 songs' }],
      pinnedPlaylists: [],
      pinnedAlbums: [],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<PinnedSection {...baseProps} />);

    // #then
    const card = screen.getByTestId('library-card-liked-liked-songs');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('data-subtitle', '42 songs');
  });

  it('calls onSelect with liked kind and id when a liked card is clicked', () => {
    // #given
    const onSelect = vi.fn();
    mockUsePinnedSection.mockReturnValue({
      combined: [{ kind: 'liked', id: 'liked-songs', name: 'Liked Songs', subtitle: '5 songs' }],
      pinnedPlaylists: [],
      pinnedAlbums: [],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<PinnedSection {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('library-card-liked-liked-songs'));

    // #then
    expect(onSelect).toHaveBeenCalledWith('liked', 'liked-songs', 'Liked Songs', undefined);
  });
});
