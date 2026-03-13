import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import TrackInfo from '../TrackInfo';

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(() => ({
    activeDescriptor: {
      capabilities: {
        hasExternalLink: false,
        externalLinkLabel: 'Open in Spotify',
      },
      getExternalUrl: undefined,
      getExternalUrls: undefined,
    },
  })),
}));

const defaultTrack = {
  name: 'Test Track',
  artists: 'Test Artist',
  album: 'Test Album',
  album_id: undefined,
};

function renderTrackInfo(overrides: Partial<React.ComponentProps<typeof TrackInfo>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <TrackInfo
        track={defaultTrack}
        isMobile={false}
        isTablet={false}
        {...overrides}
      />
    </ThemeProvider>
  );
}

describe('TrackInfo provider badge', () => {
  it('shows Spotify icon when radioActive=true and currentProvider=spotify', () => {
    // #given
    renderTrackInfo({ radioActive: true, currentProvider: 'spotify' });

    // #when / #then
    const icon = screen.getByRole('img', { name: 'Spotify' });
    expect(icon).toBeTruthy();
  });

  it('shows Dropbox icon when radioActive=true and currentProvider=dropbox', () => {
    // #given
    renderTrackInfo({ radioActive: true, currentProvider: 'dropbox' });

    // #when / #then
    const icon = screen.getByRole('img', { name: 'Dropbox' });
    expect(icon).toBeTruthy();
  });

  it('shows no provider badge when radioActive=false', () => {
    // #given
    renderTrackInfo({ radioActive: false, currentProvider: 'spotify' });

    // #when / #then
    expect(screen.queryByRole('img', { name: 'Spotify' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Dropbox' })).toBeNull();
  });

  it('shows no provider badge when radioActive is not provided', () => {
    // #given
    renderTrackInfo({ currentProvider: 'spotify' });

    // #when / #then
    expect(screen.queryByRole('img', { name: 'Spotify' })).toBeNull();
  });
});
