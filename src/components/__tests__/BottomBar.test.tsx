import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import BottomBar from '../BottomBar';
import { TestWrapper } from '@/test/testWrappers';

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    setVolume: vi.fn().mockResolvedValue(undefined),
    onPlayerStateChanged: vi.fn(() => vi.fn()),
    getCurrentState: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    getDeviceId: vi.fn().mockReturnValue(null),
    getIsReady: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    isAuthenticated: vi.fn(() => true),
    getAccessToken: vi.fn().mockReturnValue('mock-token'),
    ensureValidToken: vi.fn().mockResolvedValue('mock-token'),
    handleRedirect: vi.fn().mockResolvedValue(undefined),
    redirectToAuth: vi.fn(),
    logout: vi.fn(),
  },
  getUserPlaylists: vi.fn(),
  getPlaylistTracks: vi.fn(),
  getAlbumTracks: vi.fn(),
  getLikedSongs: vi.fn(),
  getLikedSongsCount: vi.fn(),
  checkTrackSaved: vi.fn(),
  saveTrack: vi.fn(),
  unsaveTrack: vi.fn(),
  getUserLibraryInterleaved: vi.fn(),
}));

vi.mock('@/hooks/usePlayerSizing', () => ({
  usePlayerSizing: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    hasPointerInput: true,
    viewport: { width: 1024, height: 768, ratio: 1024 / 768 },
    dimensions: { width: 600, height: 600 },
  })),
}));

const defaultProps = {
  accentColor: '#1db954',
  zenModeEnabled: false,
  isMuted: false,
  volume: 50,
  onMuteToggle: vi.fn(),
  onVolumeChange: vi.fn(),
  onShowVisualEffects: vi.fn(),
  onBackToLibrary: vi.fn(),
  onShowPlaylist: vi.fn(),
  onZenModeToggle: vi.fn(),
  shuffleEnabled: false,
  onShuffleToggle: vi.fn(),
};

function renderBottomBar(overrides?: Partial<typeof defaultProps>) {
  const props = { ...defaultProps, ...overrides };
  Object.keys(props).forEach((key) => {
    const val = props[key as keyof typeof props];
    if (typeof val === 'function') {
      (val as ReturnType<typeof vi.fn>).mockClear();
    }
  });
  const result = render(
    <ThemeProvider theme={theme}>
      <TestWrapper>
        <BottomBar {...props} />
      </TestWrapper>
    </ThemeProvider>
  );
  return { ...result, props };
}

describe('BottomBar', () => {
  it('renders into document.body via portal', () => {
    renderBottomBar();
    const bar = document.body.querySelector('[title="App settings"]');
    expect(bar).toBeTruthy();
  });

  it('clicking the back-to-library button calls onBackToLibrary', () => {
    const { props } = renderBottomBar();
    const backButton = screen.getByTitle('Back to Library');
    fireEvent.click(backButton);
    expect(props.onBackToLibrary).toHaveBeenCalledOnce();
  });

  it('clicking back-to-library calls onBackToLibrary callback', () => {
    const onBackToLibrary = vi.fn();
    renderBottomBar({ onBackToLibrary });
    fireEvent.click(screen.getByTitle('Back to Library'));
    expect(onBackToLibrary).toHaveBeenCalledOnce();
  });

  it('zen mode button is visible when onZenModeToggle is provided', () => {
    renderBottomBar({ onZenModeToggle: vi.fn() });
    expect(screen.getByTitle(/zen mode/i)).toBeTruthy();
  });

  it('zen mode button is absent when onZenModeToggle is not provided', () => {
    renderBottomBar({ onZenModeToggle: undefined });
    expect(screen.queryByTitle(/zen mode/i)).toBeNull();
  });

  it('shuffle button shows active state when shuffle is enabled', () => {
    renderBottomBar({ shuffleEnabled: true });
    const shuffleButton = screen.getByTitle('Shuffle ON');
    expect(shuffleButton).toBeTruthy();
    expect(shuffleButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('visual effects button calls onShowVisualEffects when clicked', () => {
    const { props } = renderBottomBar();
    fireEvent.click(screen.getByTitle('App settings'));
    expect(props.onShowVisualEffects).toHaveBeenCalledOnce();
  });

  it('playlist button calls onShowPlaylist when clicked', () => {
    const { props } = renderBottomBar();
    fireEvent.click(screen.getByTitle('Show Playlist'));
    expect(props.onShowPlaylist).toHaveBeenCalledOnce();
  });

  it('zen mode button calls onZenModeToggle when clicked', () => {
    const { props } = renderBottomBar();
    fireEvent.click(screen.getByTitle(/zen mode/i));
    expect(props.onZenModeToggle).toHaveBeenCalledOnce();
  });
});
