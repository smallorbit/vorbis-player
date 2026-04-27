/**
 * Tests for LibraryCard open-state ring (Gap 4).
 *
 * Covers:
 *  - data-context-menu-open is present when the context key matches
 *  - data-context-menu-open is absent when the context key does not match
 *  - data-context-menu-open is absent when no Provider is present
 *  - Two cards with same id but different kinds: only the matching kind gets the attribute
 *    (regression guard for composite key `${kind}:${provider}:${id}`)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LibraryContextMenuOpenContext } from '../../contextMenu/LibraryContextMenuOpenContext';
import LibraryCard from '../LibraryCard';

vi.mock('@/components/ProviderIcon', () => ({
  default: ({ provider }: { provider: string }) => (
    <span data-testid={`provider-icon-${provider}`} />
  ),
}));

const baseProps = {
  id: 'a1',
  provider: 'spotify' as const,
  name: 'Test Item',
  variant: 'grid' as const,
  onSelect: vi.fn(),
  onContextMenuRequest: vi.fn(),
};

function renderCard(
  kind: 'playlist' | 'album' | 'liked' | 'recently-played',
  openKey: string | null,
) {
  return render(
    <LibraryContextMenuOpenContext.Provider value={openKey}>
      <LibraryCard {...baseProps} kind={kind} />
    </LibraryContextMenuOpenContext.Provider>,
  );
}

describe('LibraryCard — open-state (data-context-menu-open)', () => {
  it('sets data-context-menu-open when context key matches', () => {
    renderCard('album', 'album:spotify:a1');
    const btn = screen.getByTestId('library-card-album-a1');
    expect(btn).toHaveAttribute('data-context-menu-open');
  });

  it('does not set data-context-menu-open when context key does not match', () => {
    renderCard('album', 'album:spotify:other-id');
    const btn = screen.getByTestId('library-card-album-a1');
    expect(btn).not.toHaveAttribute('data-context-menu-open');
  });

  it('does not set data-context-menu-open when context is null', () => {
    renderCard('album', null);
    const btn = screen.getByTestId('library-card-album-a1');
    expect(btn).not.toHaveAttribute('data-context-menu-open');
  });

  it('does not light up a non-triggering card with the same id but different kind', () => {
    // #given a recently-played album with id 'a1' AND an albums-section album with id 'a1'
    // #when the open key targets the recently-played card
    const openKey = 'recently-played:spotify:a1';
    render(
      <LibraryContextMenuOpenContext.Provider value={openKey}>
        <LibraryCard {...baseProps} kind="recently-played" data-testid-override="recent" />
        <LibraryCard {...baseProps} kind="album" />
      </LibraryContextMenuOpenContext.Provider>,
    );

    // #then the recently-played card has the open attribute
    const recentCard = screen.getByTestId('library-card-recently-played-a1');
    expect(recentCard).toHaveAttribute('data-context-menu-open');

    // #then the album card does NOT have the attribute
    const albumCard = screen.getByTestId('library-card-album-a1');
    expect(albumCard).not.toHaveAttribute('data-context-menu-open');
  });
});
