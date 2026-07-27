import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSpotifyLogout,
  mockSpotifyIsAuthenticated,
  mockClearLikedCountSnapshot,
  mockClearAllSpotifyInMemoryCaches,
  mockClearProviderData,
} = vi.hoisted(() => ({
  mockSpotifyLogout: vi.fn(),
  mockSpotifyIsAuthenticated: vi.fn().mockReturnValue(true),
  mockClearLikedCountSnapshot: vi.fn(),
  mockClearAllSpotifyInMemoryCaches: vi.fn(),
  mockClearProviderData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    isAuthenticated: mockSpotifyIsAuthenticated,
    logout: mockSpotifyLogout,
    ensureValidToken: vi.fn().mockResolvedValue('tok'),
    getAccessToken: vi.fn().mockReturnValue('tok'),
    getAuthUrl: vi.fn().mockResolvedValue('https://accounts.spotify.com/authorize'),
    redirectToAuth: vi.fn().mockResolvedValue(undefined),
    handleRedirect: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/cache/likedCountSnapshot', () => ({
  clearLikedCountSnapshot: mockClearLikedCountSnapshot,
}));

vi.mock('@/services/spotify/cache', () => ({
  clearAllSpotifyInMemoryCaches: mockClearAllSpotifyInMemoryCaches,
}));

vi.mock('@/services/cache/libraryCache', () => ({
  clearProviderData: mockClearProviderData,
}));

import { SpotifyAuthAdapter } from '@/providers/spotify/spotifyAuthAdapter';

describe('SpotifyAuthAdapter.logout', () => {
  let adapter: SpotifyAuthAdapter;

  beforeEach(() => {
    adapter = new SpotifyAuthAdapter();
    vi.clearAllMocks();
    mockClearProviderData.mockResolvedValue(undefined);
  });

  it('calls spotifyAuth.logout', () => {
    // #when
    adapter.logout();

    // #then
    expect(mockSpotifyLogout).toHaveBeenCalledOnce();
  });

  it('clears liked count snapshot', () => {
    // #when
    adapter.logout();

    // #then
    expect(mockClearLikedCountSnapshot).toHaveBeenCalledWith('spotify');
  });

  it('clears all in-memory Spotify caches', () => {
    // #when
    adapter.logout();

    // #then
    expect(mockClearAllSpotifyInMemoryCaches).toHaveBeenCalledOnce();
  });

  it('clears only spotify rows from the IDB library cache', () => {
    // #when
    adapter.logout();

    // #then — provider-scoped: a Spotify disconnect must not wipe
    // other providers' cached collections/track lists
    expect(mockClearProviderData).toHaveBeenCalledExactlyOnceWith('spotify');
  });
});
