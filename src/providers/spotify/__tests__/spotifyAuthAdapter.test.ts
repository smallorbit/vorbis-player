import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { STORAGE_KEYS } from '@/constants/storage';
import { writeLocalStorageJson, writeLocalStorageRaw } from '@/utils/persistedStorage';
import {
  remainingProviderLocalStorageKeys,
  SPOTIFY_PROCESSED_CODE_SESSION_KEY,
} from '@/services/cache/providerDataPurge';
import {
  clearAll,
  initCache,
  putPlaylist,
  getAllPlaylists,
} from '@/services/cache/libraryCache';
import { writeLikedCountSnapshot, readLikedCountSnapshots } from '@/services/cache/likedCountSnapshot';
import {
  trackSavedCache,
  setLikedSongsCountCache,
  getLikedSongsCountCache,
} from '@/services/spotify/cache';
import type { MediaCollection } from '@/types/domain';

const { mockSpotifyLogout, mockSpotifyIsAuthenticated } = vi.hoisted(() => ({
  mockSpotifyLogout: vi.fn(),
  mockSpotifyIsAuthenticated: vi.fn().mockReturnValue(true),
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

import { SpotifyAuthAdapter } from '@/providers/spotify/spotifyAuthAdapter';

function makePlaylist(id: string, provider: 'spotify' | 'dropbox'): MediaCollection {
  return { id, name: id, kind: 'playlist', provider, genres: [] };
}

describe('SpotifyAuthAdapter.logout', () => {
  let adapter: SpotifyAuthAdapter;
  let store: Record<string, string>;
  let sessionStore: Record<string, string>;

  beforeEach(async () => {
    adapter = new SpotifyAuthAdapter();
    vi.clearAllMocks();
    store = {};
    sessionStore = {};
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => store[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, val: string) => {
      store[key] = val;
    });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete store[key];
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      store = {};
    });
    vi.mocked(sessionStorage.getItem).mockImplementation((key: string) => sessionStore[key] ?? null);
    vi.mocked(sessionStorage.setItem).mockImplementation((key: string, val: string) => {
      sessionStore[key] = val;
    });
    vi.mocked(sessionStorage.removeItem).mockImplementation((key: string) => {
      delete sessionStore[key];
    });
    await initCache();
    await clearAll();
  });

  afterEach(async () => {
    await clearAll();
  });

  it('calls spotifyAuth.logout then leaves zero Spotify-scoped persisted data', async () => {
    // #given
    writeLocalStorageJson(STORAGE_KEYS.SPOTIFY_TOKEN, {
      access_token: 'tok',
      refresh_token: 'ref',
      expires_at: Date.now() + 60_000,
    });
    writeLocalStorageRaw(STORAGE_KEYS.SPOTIFY_CODE_VERIFIER, 'verifier');
    writeLocalStorageRaw(STORAGE_KEYS.VOLUME, '55');
    sessionStorage.setItem(SPOTIFY_PROCESSED_CODE_SESSION_KEY, 'processed');
    writeLikedCountSnapshot('spotify', 9);
    trackSavedCache.set('t1', { value: true, timestamp: Date.now() });
    setLikedSongsCountCache({ count: 9, timestamp: Date.now() });
    await putPlaylist(makePlaylist('sp-pl', 'spotify'));
    await putPlaylist(makePlaylist('db-pl', 'dropbox'));

    // #when
    await adapter.logout();

    // #then
    expect(mockSpotifyLogout).toHaveBeenCalledOnce();
    expect(remainingProviderLocalStorageKeys('spotify')).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.VOLUME)).toBe('55');
    expect(sessionStorage.getItem(SPOTIFY_PROCESSED_CODE_SESSION_KEY)).toBeNull();
    expect(readLikedCountSnapshots().spotify).toBeUndefined();
    expect(trackSavedCache.size).toBe(0);
    expect(getLikedSongsCountCache()).toBeNull();
    expect((await getAllPlaylists()).map((c) => c.id)).toEqual(['db-pl']);
  });
});
