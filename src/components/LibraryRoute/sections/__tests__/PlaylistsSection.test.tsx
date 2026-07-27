/**
 * Tests for PlaylistsSection — renders playlist cards, skeleton, and See-all (#1294).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks', () => ({
  usePlaylistsSection: vi.fn(),
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
    <div data-testid="section-playlists">
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

import { usePlaylistsSection } from '../../hooks';
import PlaylistsSection from '../PlaylistsSection';
import type { MediaCollection } from '@/types/domain';

const mockUsePlaylistsSection = vi.mocked(usePlaylistsSection);

const makePlaylist = (id: string, name: string): MediaCollection => ({
  id,
  provider: 'spotify',
  kind: 'playlist',
  name,
  genres: [],
});

const baseProps = {
  layout: 'row' as const,
  onSelect: vi.fn(),
  onSeeAll: vi.fn(),
};

describe('PlaylistsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when isEmpty and not loading', () => {
    // #given
    mockUsePlaylistsSection.mockReturnValue({ items: [], isLoading: false, isEmpty: true });

    // #when
    const { container } = render(<PlaylistsSection {...baseProps} />);

    // #then
    expect(container).toBeEmptyDOMElement();
  });

  it('renders skeleton when loading with no items', () => {
    // #given
    mockUsePlaylistsSection.mockReturnValue({ items: [], isLoading: true, isEmpty: true });

    // #when
    render(<PlaylistsSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('section-skeleton')).toBeInTheDocument();
  });

  it('renders a card for each playlist item', () => {
    // #given
    mockUsePlaylistsSection.mockReturnValue({
      items: [makePlaylist('p1', 'Chill Vibes'), makePlaylist('p2', 'Workout Mix')],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<PlaylistsSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-card-playlist-p1')).toBeInTheDocument();
    expect(screen.getByTestId('library-card-playlist-p2')).toBeInTheDocument();
  });

  it('shows See all when layout is row and items exceed 8', () => {
    // #given
    mockUsePlaylistsSection.mockReturnValue({
      items: Array.from({ length: 9 }, (_, i) => makePlaylist(`p${i}`, `Playlist ${i}`)),
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<PlaylistsSection {...baseProps} layout="row" />);

    // #then
    expect(screen.getByRole('button', { name: 'See all' })).toBeInTheDocument();
  });

  it('does not show See all when items are at or below 8', () => {
    // #given
    mockUsePlaylistsSection.mockReturnValue({
      items: Array.from({ length: 8 }, (_, i) => makePlaylist(`p${i}`, `Playlist ${i}`)),
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<PlaylistsSection {...baseProps} layout="row" />);

    // #then
    expect(screen.queryByRole('button', { name: 'See all' })).not.toBeInTheDocument();
  });

  it('calls onSelect with the typed playlist selection on card click', () => {
    // #given
    const onSelect = vi.fn();
    mockUsePlaylistsSection.mockReturnValue({
      items: [makePlaylist('p1', 'My Mix')],
      isLoading: false,
      isEmpty: false,
    });

    // #when
    render(<PlaylistsSection {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('library-card-playlist-p1'));

    // #then
    expect(onSelect).toHaveBeenCalledWith({
      type: 'collection',
      ref: { provider: 'spotify', kind: 'playlist', id: 'p1' },
      name: 'My Mix',
    });
  });
});
