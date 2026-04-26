import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LibraryRoute from '../index';

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: vi.fn(),
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    hasMultipleProviders: false,
    enabledProviderIds: ['spotify'],
  })),
}));

vi.mock('@/hooks/useUnifiedLikedTracks', () => ({
  useUnifiedLikedTracks: vi.fn(() => ({
    unifiedTracks: [],
    isUnifiedLikedActive: false,
    totalCount: 0,
    isLoading: false,
  })),
}));

vi.mock('../hooks', () => ({
  useResumeSection: vi.fn(() => ({ session: null, hasResumable: false })),
  useRecentlyPlayedSection: vi.fn(() => ({ items: [], isLoading: false, isEmpty: true })),
  usePinnedSection: vi.fn(() => ({
    pinnedPlaylists: [],
    pinnedAlbums: [],
    combined: [],
    isLoading: false,
    isEmpty: true,
  })),
  usePlaylistsSection: vi.fn(() => ({ items: [], isLoading: false, isEmpty: true })),
  useAlbumsSection: vi.fn(() => ({ items: [], isLoading: false, isEmpty: true })),
  useLikedSection: vi.fn(() => ({
    totalCount: 0,
    perProvider: [],
    isUnified: false,
    isLoading: false,
  })),
  fetchLikedForProvider: vi.fn(async () => []),
}));

import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';

const baseProps = {
  onPlaylistSelect: vi.fn(),
  onOpenSettings: vi.fn(),
  lastSession: null,
};

describe('LibraryRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders mobile layout testid when isMobile is true', () => {
    // #given
    vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: true } as ReturnType<typeof usePlayerSizingContext>);

    // #when
    render(<LibraryRoute {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-route-mobile')).toBeInTheDocument();
    expect(screen.queryByTestId('library-route-desktop')).not.toBeInTheDocument();
  });

  it('renders desktop layout testid when isMobile is false', () => {
    // #given
    vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);

    // #when
    render(<LibraryRoute {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-route-desktop')).toBeInTheDocument();
    expect(screen.queryByTestId('library-route-mobile')).not.toBeInTheDocument();
  });

  it('renders HomeView at home view by default', () => {
    // #given
    vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);

    // #when
    render(<LibraryRoute {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-home')).toBeInTheDocument();
  });
});
