import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEYS, LEGACY_SPOTIFY_STORAGE_KEYS } from '@/constants/storage';
import {
  migrateLegacySpotifyStorageKeys,
  _resetSpotifyStorageMigrationFlag,
} from '@/utils/migrateSpotifyStorageKeys';

describe('migrateLegacySpotifyStorageKeys', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    _resetSpotifyStorageMigrationFlag();
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => store[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, val: string) => {
      store[key] = val;
    });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete store[key];
    });
  });

  it('copies legacy Spotify token to the prefixed key and removes the legacy entry', () => {
    // #given
    store[LEGACY_SPOTIFY_STORAGE_KEYS.TOKEN] = JSON.stringify({ access_token: 'tok' });

    // #when
    migrateLegacySpotifyStorageKeys();

    // #then
    expect(store[STORAGE_KEYS.SPOTIFY_TOKEN]).toBe(JSON.stringify({ access_token: 'tok' }));
    expect(store[LEGACY_SPOTIFY_STORAGE_KEYS.TOKEN]).toBeUndefined();
  });

  it('copies the code verifier as well', () => {
    // #given
    store[LEGACY_SPOTIFY_STORAGE_KEYS.CODE_VERIFIER] = 'pkce-verifier';

    // #when
    migrateLegacySpotifyStorageKeys();

    // #then
    expect(store[STORAGE_KEYS.SPOTIFY_CODE_VERIFIER]).toBe('pkce-verifier');
    expect(store[LEGACY_SPOTIFY_STORAGE_KEYS.CODE_VERIFIER]).toBeUndefined();
  });

  it('prefers an existing canonical key and drops the legacy leftover', () => {
    // #given
    store[STORAGE_KEYS.SPOTIFY_TOKEN] = JSON.stringify({ access_token: 'canonical' });
    store[LEGACY_SPOTIFY_STORAGE_KEYS.TOKEN] = JSON.stringify({ access_token: 'stale' });

    // #when
    migrateLegacySpotifyStorageKeys();

    // #then
    expect(store[STORAGE_KEYS.SPOTIFY_TOKEN]).toBe(JSON.stringify({ access_token: 'canonical' }));
    expect(store[LEGACY_SPOTIFY_STORAGE_KEYS.TOKEN]).toBeUndefined();
  });

  it('is a no-op when neither key is present', () => {
    // #when
    migrateLegacySpotifyStorageKeys();

    // #then
    expect(store).toEqual({});
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('runs only once per session (flag)', () => {
    // #given
    store[LEGACY_SPOTIFY_STORAGE_KEYS.TOKEN] = 'a';
    migrateLegacySpotifyStorageKeys();
    store[LEGACY_SPOTIFY_STORAGE_KEYS.TOKEN] = 'b';
    delete store[STORAGE_KEYS.SPOTIFY_TOKEN];

    // #when — second call is skipped
    migrateLegacySpotifyStorageKeys();

    // #then
    expect(store[STORAGE_KEYS.SPOTIFY_TOKEN]).toBeUndefined();
    expect(store[LEGACY_SPOTIFY_STORAGE_KEYS.TOKEN]).toBe('b');
  });
});
