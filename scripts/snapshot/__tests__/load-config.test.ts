
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSnapshotConfig, isSpotifyConfigEmpty, isDropboxConfigEmpty, EMPTY_CONFIG_HINT } from '../load-config.ts';

const TMP = join(tmpdir(), 'snapshot-test-load-config');

const VALID_CONFIG = {
  version: 1,
  spotify: {
    enabled: true,
    playlistIds: [],
    albumIds: [],
    likedTracks: { limit: 50 },
    playlistTrackLimit: 50,
    pins: { playlistIds: [], albumIds: [] },
  },
  dropbox: {
    enabled: true,
    folderPaths: [],
    trackLimitPerFolder: 30,
    savedPlaylistPaths: [],
    likesFilePath: '/.vorbis-player/likes.json',
    likedTracks: { limit: 25 },
    pins: { playlistIds: [], albumIds: [] },
  },
};

function writeTmp(filename: string, content: string): string {
  const fullPath = join(TMP, filename);
  writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('loadSnapshotConfig', () => {
  it('loads and returns a valid config', () => {
    const configPath = writeTmp('valid.json', JSON.stringify(VALID_CONFIG));
    const result = loadSnapshotConfig(configPath);
    expect(result.version).toBe(1);
    expect(result.spotify.enabled).toBe(true);
    expect(result.dropbox.likedTracks.limit).toBe(25);
  });

  it('throws if the file does not exist', () => {
    expect(() => loadSnapshotConfig(join(TMP, 'missing.json'))).toThrow();
  });

  it('throws if version does not match', () => {
    const bad = { ...VALID_CONFIG, version: 2 };
    const configPath = writeTmp('badversion.json', JSON.stringify(bad));
    expect(() => loadSnapshotConfig(configPath)).toThrow(/version 2 not supported/i);
  });

  it('throws on invalid JSON', () => {
    const configPath = writeTmp('invalid.json', '{ not valid json }');
    expect(() => loadSnapshotConfig(configPath)).toThrow(/invalid JSON/i);
  });
});

describe('isSpotifyConfigEmpty', () => {
  it('returns true when all curatable arrays are empty', () => {
    expect(isSpotifyConfigEmpty(VALID_CONFIG.spotify)).toBe(true);
  });

  it('returns false when playlistIds is non-empty', () => {
    const cfg = { ...VALID_CONFIG.spotify, playlistIds: ['abc'] };
    expect(isSpotifyConfigEmpty(cfg)).toBe(false);
  });

  it('returns false when albumIds is non-empty', () => {
    const cfg = { ...VALID_CONFIG.spotify, albumIds: ['xyz'] };
    expect(isSpotifyConfigEmpty(cfg)).toBe(false);
  });

  it('returns false when pins.playlistIds is non-empty', () => {
    const cfg = { ...VALID_CONFIG.spotify, pins: { playlistIds: ['p1'], albumIds: [] } };
    expect(isSpotifyConfigEmpty(cfg)).toBe(false);
  });

  it('returns false when pins.albumIds is non-empty', () => {
    const cfg = { ...VALID_CONFIG.spotify, pins: { playlistIds: [], albumIds: ['a1'] } };
    expect(isSpotifyConfigEmpty(cfg)).toBe(false);
  });
});

describe('isDropboxConfigEmpty', () => {
  it('returns true when all curatable arrays are empty', () => {
    expect(isDropboxConfigEmpty(VALID_CONFIG.dropbox)).toBe(true);
  });

  it('returns false when folderPaths is non-empty', () => {
    const cfg = { ...VALID_CONFIG.dropbox, folderPaths: ['/music'] };
    expect(isDropboxConfigEmpty(cfg)).toBe(false);
  });

  it('returns false when savedPlaylistPaths is non-empty', () => {
    const cfg = { ...VALID_CONFIG.dropbox, savedPlaylistPaths: ['/.vorbis-player/playlists/foo.json'] };
    expect(isDropboxConfigEmpty(cfg)).toBe(false);
  });
});

describe('EMPTY_CONFIG_HINT', () => {
  it('mentions --list flag', () => {
    expect(EMPTY_CONFIG_HINT).toContain('--list');
  });

  it('mentions snapshot.config.json', () => {
    expect(EMPTY_CONFIG_HINT).toContain('snapshot.config.json');
  });

  it('is a non-empty string', () => {
    expect(typeof EMPTY_CONFIG_HINT).toBe('string');
    expect(EMPTY_CONFIG_HINT.length).toBeGreaterThan(0);
  });
});
