import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LibraryRoute from '../index';

vi.mock('@/contexts/PlayerSizingContext', () => ({
  usePlayerSizingContext: vi.fn(),
}));

import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';

const baseProps = {
  onPlaylistSelect: vi.fn(),
  onOpenSettings: vi.fn(),
  hasResumableSession: false,
};

describe('LibraryRoute', () => {
  it('renders mobile shell when isMobile is true', () => {
    // #given
    vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: true } as ReturnType<typeof usePlayerSizingContext>);

    // #when
    render(<LibraryRoute {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-route-mobile')).toBeInTheDocument();
    expect(screen.queryByTestId('library-route-desktop')).not.toBeInTheDocument();
  });

  it('renders desktop shell when isMobile is false', () => {
    // #given
    vi.mocked(usePlayerSizingContext).mockReturnValue({ isMobile: false } as ReturnType<typeof usePlayerSizingContext>);

    // #when
    render(<LibraryRoute {...baseProps} />);

    // #then
    expect(screen.getByTestId('library-route-desktop')).toBeInTheDocument();
    expect(screen.queryByTestId('library-route-mobile')).not.toBeInTheDocument();
  });
});
