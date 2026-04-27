/**
 * Tests for LikedSection — single-card liked-songs section with unified/per-provider modes (#1294).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks', () => ({
  useLikedSection: vi.fn(),
}));

vi.mock('../Section', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="section-liked">{children}</div>
  ),
}));

vi.mock('../SectionSkeleton', () => ({
  default: () => <div data-testid="section-skeleton" />,
}));

vi.mock('../../card/LibraryCard', () => ({
  default: ({
    kind,
    id,
    subtitle,
    provider,
    onSelect,
  }: {
    kind: string;
    id: string;
    subtitle?: string;
    provider?: string;
    onSelect: () => void;
  }) => (
    <button
      data-testid={`library-card-${kind}-${id}`}
      data-subtitle={subtitle}
      data-provider={provider}
      onClick={onSelect}
    >
      liked
    </button>
  ),
}));

import { useLikedSection } from '../../hooks';
import LikedSection from '../LikedSection';

const mockUseLikedSection = vi.mocked(useLikedSection);

const baseProps = {
  layout: 'row' as const,
  onSelectLiked: vi.fn(),
};

describe('LikedSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when totalCount is 0 and not loading', () => {
    // #given
    mockUseLikedSection.mockReturnValue({
      totalCount: 0,
      perProvider: [],
      isUnified: false,
      isLoading: false,
    });

    // #when
    const { container } = render(<LikedSection {...baseProps} />);

    // #then
    expect(container).toBeEmptyDOMElement();
  });

  it('renders skeleton when loading with no items', () => {
    // #given
    mockUseLikedSection.mockReturnValue({
      totalCount: 0,
      perProvider: [],
      isUnified: false,
      isLoading: true,
    });

    // #when
    render(<LikedSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('section-skeleton')).toBeInTheDocument();
  });

  it('renders a single unified card with song count subtitle', () => {
    // #given
    mockUseLikedSection.mockReturnValue({
      totalCount: 42,
      perProvider: [{ provider: 'spotify', count: 42 }],
      isUnified: true,
      isLoading: false,
    });

    // #when
    render(<LikedSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-card-liked-liked')).toHaveAttribute('data-subtitle', '42 songs');
  });

  it('uses singular "song" when totalCount is 1', () => {
    // #given
    mockUseLikedSection.mockReturnValue({
      totalCount: 1,
      perProvider: [{ provider: 'spotify', count: 1 }],
      isUnified: true,
      isLoading: false,
    });

    // #when
    render(<LikedSection {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-card-liked-liked')).toHaveAttribute('data-subtitle', '1 song');
  });

  it('renders per-provider cards when !isUnified + showProviderBadges + multiple providers', () => {
    // #given
    mockUseLikedSection.mockReturnValue({
      totalCount: 80,
      perProvider: [
        { provider: 'spotify', count: 50 },
        { provider: 'dropbox', count: 30 },
      ],
      isUnified: false,
      isLoading: false,
    });

    // #when
    render(<LikedSection {...baseProps} showProviderBadges />);

    // #then
    expect(screen.getByTestId('library-card-liked-liked-spotify')).toBeInTheDocument();
    expect(screen.getByTestId('library-card-liked-liked-dropbox')).toBeInTheDocument();
  });

  it('calls onSelectLiked without provider when unified card clicked', () => {
    // #given
    const onSelectLiked = vi.fn();
    mockUseLikedSection.mockReturnValue({
      totalCount: 10,
      perProvider: [{ provider: 'spotify', count: 10 }],
      isUnified: true,
      isLoading: false,
    });

    // #when
    render(<LikedSection {...baseProps} onSelectLiked={onSelectLiked} />);
    fireEvent.click(screen.getByTestId('library-card-liked-liked'));

    // #then — called with no provider argument
    expect(onSelectLiked).toHaveBeenCalledTimes(1);
    expect(onSelectLiked.mock.calls[0]).toEqual([]);
  });

  it('calls onSelectLiked with provider when per-provider card clicked', () => {
    // #given
    const onSelectLiked = vi.fn();
    mockUseLikedSection.mockReturnValue({
      totalCount: 80,
      perProvider: [
        { provider: 'spotify', count: 50 },
        { provider: 'dropbox', count: 30 },
      ],
      isUnified: false,
      isLoading: false,
    });

    // #when
    render(<LikedSection {...baseProps} showProviderBadges onSelectLiked={onSelectLiked} />);
    fireEvent.click(screen.getByTestId('library-card-liked-liked-spotify'));

    // #then
    expect(onSelectLiked).toHaveBeenCalledWith('spotify');
  });

  it('renders single card when !isUnified but only one provider (no badge needed)', () => {
    // #given
    mockUseLikedSection.mockReturnValue({
      totalCount: 20,
      perProvider: [{ provider: 'spotify', count: 20 }],
      isUnified: false,
      isLoading: false,
    });

    // #when
    render(<LikedSection {...baseProps} showProviderBadges />);

    // #then
    expect(screen.getByTestId('library-card-liked-liked')).toBeInTheDocument();
    expect(screen.queryByTestId('library-card-liked-liked-spotify')).not.toBeInTheDocument();
  });
});
