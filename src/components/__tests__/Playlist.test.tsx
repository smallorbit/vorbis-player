import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import Playlist from '../Playlist';
import type { Track } from '@/services/spotify';

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    name: 'Test Track',
    artists: 'Test Artist',
    album: 'Test Album',
    duration_ms: 180000,
    uri: '',
    ...overrides,
  };
}

function renderPlaylist(tracks: Track[], overrides: Partial<React.ComponentProps<typeof Playlist>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Playlist
        tracks={tracks}
        currentTrackIndex={0}
        accentColor="#1DB954"
        onTrackSelect={vi.fn()}
        {...overrides}
      />
    </ThemeProvider>
  );
}

describe('Playlist provider icons', () => {
  it('renders Spotify icon for a Spotify track when radioActive=true', () => {
    // #given
    const tracks = [makeTrack({ provider: 'spotify' })];

    // #when
    renderPlaylist(tracks, { radioActive: true });

    // #then
    const icon = screen.getByRole('img', { name: 'Spotify' });
    expect(icon).toBeTruthy();
  });

  it('renders Dropbox icon for a Dropbox track when radioActive=true', () => {
    // #given
    const tracks = [makeTrack({ provider: 'dropbox' })];

    // #when
    renderPlaylist(tracks, { radioActive: true });

    // #then
    const icon = screen.getByRole('img', { name: 'Dropbox' });
    expect(icon).toBeTruthy();
  });

  it('renders no provider icon when radioActive=false', () => {
    // #given
    const tracks = [makeTrack({ provider: 'spotify' }), makeTrack({ id: 'track-2', provider: 'dropbox' })];

    // #when
    renderPlaylist(tracks, { radioActive: false });

    // #then
    expect(screen.queryByRole('img', { name: 'Spotify' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Dropbox' })).toBeNull();
  });

  it('renders no provider icon when radioActive is not provided', () => {
    // #given
    const tracks = [makeTrack({ provider: 'spotify' })];

    // #when
    renderPlaylist(tracks);

    // #then
    expect(screen.queryByRole('img', { name: 'Spotify' })).toBeNull();
  });

  it('renders correct icons for mixed provider tracks when radioActive=true', () => {
    // #given
    const tracks = [
      makeTrack({ id: 'track-1', provider: 'spotify' }),
      makeTrack({ id: 'track-2', provider: 'dropbox' }),
    ];

    // #when
    renderPlaylist(tracks, { radioActive: true });

    // #then
    expect(screen.getByRole('img', { name: 'Spotify' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Dropbox' })).toBeTruthy();
  });
});
