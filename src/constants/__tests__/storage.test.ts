import { describe, it, expect } from 'vitest';
import { STORAGE_KEYS, LEGACY_SPOTIFY_STORAGE_KEYS } from '../storage';

describe('STORAGE_KEYS prefix convention', () => {
  it('every STORAGE_KEYS value uses the vorbis-player- prefix', () => {
    for (const [name, value] of Object.entries(STORAGE_KEYS)) {
      expect(value, name).toMatch(/^vorbis-player-/);
    }
  });

  it('legacy Spotify keys remain unprefixed for migration only', () => {
    expect(LEGACY_SPOTIFY_STORAGE_KEYS.TOKEN).toBe('spotify_token');
    expect(LEGACY_SPOTIFY_STORAGE_KEYS.CODE_VERIFIER).toBe('spotify_code_verifier');
  });
});
