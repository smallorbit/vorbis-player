import { vi } from 'vitest';

interface MockSpotifyPlayer {
  playTrack: ReturnType<typeof vi.fn>;
  playContext: ReturnType<typeof vi.fn>;
  playPlaylist: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  nextTrack: ReturnType<typeof vi.fn>;
  previousTrack: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  getCurrentState: ReturnType<typeof vi.fn>;
  onPlayerStateChanged: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  getDeviceId: ReturnType<typeof vi.fn>;
  getIsReady: ReturnType<typeof vi.fn>;
  transferPlaybackToDevice: ReturnType<typeof vi.fn>;
  ensureDeviceIsActive: ReturnType<typeof vi.fn>;
  initialize: ReturnType<typeof vi.fn>;
  lastPlayTrackTime: number;
}

export function createMockSpotifyPlayer(): MockSpotifyPlayer {
  return {
    playTrack: vi.fn().mockResolvedValue(undefined),
    playContext: vi.fn().mockResolvedValue(undefined),
    playPlaylist: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    nextTrack: vi.fn().mockResolvedValue(undefined),
    previousTrack: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn().mockResolvedValue(undefined),
    getCurrentState: vi.fn().mockResolvedValue(null),
    onPlayerStateChanged: vi.fn().mockReturnValue(vi.fn()),
    disconnect: vi.fn(),
    getDeviceId: vi.fn().mockReturnValue('mock-device-id'),
    getIsReady: vi.fn().mockReturnValue(true),
    transferPlaybackToDevice: vi.fn().mockResolvedValue(undefined),
    ensureDeviceIsActive: vi.fn().mockResolvedValue(true),
    initialize: vi.fn().mockResolvedValue(undefined),
    lastPlayTrackTime: 0,
  };
}

interface MockSpotifyAuth {
  isAuthenticated: ReturnType<typeof vi.fn>;
  ensureValidToken: ReturnType<typeof vi.fn>;
  getAccessToken: ReturnType<typeof vi.fn>;
  handleRedirect: ReturnType<typeof vi.fn>;
  redirectToAuth: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
}

export function createMockSpotifyAuth(): MockSpotifyAuth {
  return {
    isAuthenticated: vi.fn().mockReturnValue(true),
    ensureValidToken: vi.fn().mockResolvedValue('mock-token'),
    getAccessToken: vi.fn().mockReturnValue('mock-token'),
    handleRedirect: vi.fn().mockResolvedValue(undefined),
    redirectToAuth: vi.fn(),
    logout: vi.fn(),
  };
}
