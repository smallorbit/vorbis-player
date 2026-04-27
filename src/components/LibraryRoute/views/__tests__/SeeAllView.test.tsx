/**
 * Tests for SeeAllView — full-grid view for a single section with a back button (#1294).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({ hasMultipleProviders: false })),
}));

vi.mock('../../sections', () => ({
  RecentlyPlayedSection: () => <div data-testid="stub-recently-played-section" />,
  PinnedSection: () => <div data-testid="stub-pinned-section" />,
  PlaylistsSection: () => <div data-testid="stub-playlists-section" />,
  AlbumsSection: () => <div data-testid="stub-albums-section" />,
}));

vi.mock('@/components/icons/QuickActionIcons', () => ({
  BackToLibraryIcon: () => <span>←</span>,
}));

import SeeAllView from '../SeeAllView';

const baseProps = {
  view: 'playlists' as const,
  onBack: vi.fn(),
  onSelectCollection: vi.fn(),
};

describe('SeeAllView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with data-testid matching the view', () => {
    // #given + #when
    render(<SeeAllView {...baseProps} view="playlists" />);

    // #then
    expect(screen.getByTestId('library-see-all-playlists')).toBeInTheDocument();
  });

  it('renders the back button with correct aria-label', () => {
    // #given + #when
    render(<SeeAllView {...baseProps} />);

    // #then
    expect(screen.getByRole('button', { name: 'Back to library home' })).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', () => {
    // #given
    const onBack = vi.fn();
    render(<SeeAllView {...baseProps} onBack={onBack} />);

    // #when
    fireEvent.click(screen.getByTestId('library-see-all-back'));

    // #then
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders PlaylistsSection for view="playlists"', () => {
    // #given + #when
    render(<SeeAllView {...baseProps} view="playlists" />);

    // #then
    expect(screen.getByTestId('stub-playlists-section')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-albums-section')).not.toBeInTheDocument();
  });

  it('renders AlbumsSection for view="albums"', () => {
    // #given + #when
    render(<SeeAllView {...baseProps} view="albums" />);

    // #then
    expect(screen.getByTestId('stub-albums-section')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-playlists-section')).not.toBeInTheDocument();
  });

  it('renders RecentlyPlayedSection for view="recently-played"', () => {
    // #given + #when
    render(<SeeAllView {...baseProps} view="recently-played" />);

    // #then
    expect(screen.getByTestId('stub-recently-played-section')).toBeInTheDocument();
  });

  it('renders PinnedSection for view="pinned"', () => {
    // #given + #when
    render(<SeeAllView {...baseProps} view="pinned" />);

    // #then
    expect(screen.getByTestId('stub-pinned-section')).toBeInTheDocument();
  });

  it('displays the correct title for each view', () => {
    const TITLES = {
      playlists: 'Playlists',
      albums: 'Albums',
      'recently-played': 'Recently Played',
      pinned: 'Pinned',
    } as const;

    for (const [view, title] of Object.entries(TITLES) as [keyof typeof TITLES, string][]) {
      const { unmount } = render(<SeeAllView {...baseProps} view={view} />);
      expect(screen.getByText(title)).toBeInTheDocument();
      unmount();
    }
  });
});
