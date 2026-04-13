/**
 * Unit tests for the LibraryMiniPlayer component.
 *
 * LibraryMiniPlayer is a compact strip rendered at the bottom of the full-screen
 * library view when a track is already loaded. It shows the current track name
 * and artist and lets the user tap to navigate back to the player.
 *
 * The component is defined inline here so these tests document the expected
 * public API and behaviour before the real implementation is merged.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import type { MediaTrack } from '@/types/domain';
import { makeMediaTrack } from '@/test/fixtures';

// ---------------------------------------------------------------------------
// Minimal reference implementation used by all tests below.
// Replace this import with the real module path once the component is shipped:
//   import LibraryMiniPlayer from '../LibraryMiniPlayer';
// ---------------------------------------------------------------------------

interface LibraryMiniPlayerProps {
  currentTrack: MediaTrack | null;
  onNavigateToPlayer: () => void;
}

function LibraryMiniPlayer({ currentTrack, onNavigateToPlayer }: LibraryMiniPlayerProps): React.ReactElement | null {
  if (!currentTrack) return null;
  return (
    <div
      role="button"
      aria-label={`Now playing: ${currentTrack.name} by ${currentTrack.artists}`}
      onClick={onNavigateToPlayer}
      style={{ cursor: 'pointer' }}
    >
      <span data-testid="mini-player-track-name">{currentTrack.name}</span>
      <span data-testid="mini-player-artist">{currentTrack.artists}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------

describe('LibraryMiniPlayer', () => {
  it('renders track name and artist when a track is loaded', () => {
    // #given
    const track = makeMediaTrack({ name: 'Bohemian Rhapsody', artists: 'Queen' });
    const onNavigateToPlayer = vi.fn();

    // #when
    render(<LibraryMiniPlayer currentTrack={track} onNavigateToPlayer={onNavigateToPlayer} />);

    // #then
    expect(screen.getByTestId('mini-player-track-name').textContent).toBe('Bohemian Rhapsody');
    expect(screen.getByTestId('mini-player-artist').textContent).toBe('Queen');
  });

  it('does not render when currentTrack is null', () => {
    // #given
    const onNavigateToPlayer = vi.fn();

    // #when
    const { container } = render(
      <LibraryMiniPlayer currentTrack={null} onNavigateToPlayer={onNavigateToPlayer} />
    );

    // #then
    expect(container.firstChild).toBeNull();
  });

  it('calls onNavigateToPlayer when the strip is clicked', () => {
    // #given
    const track = makeMediaTrack({ name: 'Stairway to Heaven', artists: 'Led Zeppelin' });
    const onNavigateToPlayer = vi.fn();

    render(<LibraryMiniPlayer currentTrack={track} onNavigateToPlayer={onNavigateToPlayer} />);

    // #when
    fireEvent.click(screen.getByRole('button'));

    // #then
    expect(onNavigateToPlayer).toHaveBeenCalledOnce();
  });
});
