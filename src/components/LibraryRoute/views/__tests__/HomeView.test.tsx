/**
 * Tests for HomeView — renders 6 library sections and wires onNavigate (#1294).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({ hasMultipleProviders: false })),
}));

vi.mock('../../sections', () => ({
  ResumeSection: () => <div data-testid="stub-resume" />,
  RecentlyPlayedSection: ({ onSeeAll }: { onSeeAll?: () => void }) => (
    <div data-testid="stub-recently-played">
      {onSeeAll && <button onClick={onSeeAll}>see-all-rp</button>}
    </div>
  ),
  PinnedSection: ({ onSeeAll }: { onSeeAll?: () => void }) => (
    <div data-testid="stub-pinned">
      {onSeeAll && <button onClick={onSeeAll}>see-all-pinned</button>}
    </div>
  ),
  LikedSection: () => <div data-testid="stub-liked" />,
  PlaylistsSection: ({ onSeeAll }: { onSeeAll?: () => void }) => (
    <div data-testid="stub-playlists">
      {onSeeAll && <button onClick={onSeeAll}>see-all-playlists</button>}
    </div>
  ),
  AlbumsSection: ({ onSeeAll }: { onSeeAll?: () => void }) => (
    <div data-testid="stub-albums">
      {onSeeAll && <button onClick={onSeeAll}>see-all-albums</button>}
    </div>
  ),
}));

import HomeView from '../HomeView';

const baseProps = {
  layout: 'row' as const,
  lastSession: null,
  onSelectCollection: vi.fn(),
  onSelectLiked: vi.fn(),
  onNavigate: vi.fn(),
};

describe('HomeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with data-testid="library-home"', () => {
    // #given + #when
    render(<HomeView {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-home')).toBeInTheDocument();
  });

  it('renders all 6 section stubs', () => {
    // #given + #when
    render(<HomeView {...baseProps} />);

    // #then — all 6 sections appear
    expect(screen.getByTestId('stub-resume')).toBeInTheDocument();
    expect(screen.getByTestId('stub-recently-played')).toBeInTheDocument();
    expect(screen.getByTestId('stub-pinned')).toBeInTheDocument();
    expect(screen.getByTestId('stub-liked')).toBeInTheDocument();
    expect(screen.getByTestId('stub-playlists')).toBeInTheDocument();
    expect(screen.getByTestId('stub-albums')).toBeInTheDocument();
  });

  it('calls onNavigate with "recently-played" when RecentlyPlayedSection fires onSeeAll', () => {
    // #given
    const onNavigate = vi.fn();
    render(<HomeView {...baseProps} onNavigate={onNavigate} />);

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'see-all-rp' }));

    // #then
    expect(onNavigate).toHaveBeenCalledWith('recently-played');
  });

  it('calls onNavigate with "pinned" when PinnedSection fires onSeeAll', () => {
    // #given
    const onNavigate = vi.fn();
    render(<HomeView {...baseProps} onNavigate={onNavigate} />);

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'see-all-pinned' }));

    // #then
    expect(onNavigate).toHaveBeenCalledWith('pinned');
  });

  it('calls onNavigate with "playlists" when PlaylistsSection fires onSeeAll', () => {
    // #given
    const onNavigate = vi.fn();
    render(<HomeView {...baseProps} onNavigate={onNavigate} />);

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'see-all-playlists' }));

    // #then
    expect(onNavigate).toHaveBeenCalledWith('playlists');
  });

  it('calls onNavigate with "albums" when AlbumsSection fires onSeeAll', () => {
    // #given
    const onNavigate = vi.fn();
    render(<HomeView {...baseProps} onNavigate={onNavigate} />);

    // #when
    fireEvent.click(screen.getByRole('button', { name: 'see-all-albums' }));

    // #then
    expect(onNavigate).toHaveBeenCalledWith('albums');
  });
});
