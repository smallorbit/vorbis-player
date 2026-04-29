
import { describe, it, expect } from 'vitest';
import { hashId, createAnonymizationContext, SCRUBBED } from '../anonymize.ts';

const SEED = 'f3a1b2c4d5e6789a0bcdef0123456789';

describe('hashId', () => {
  it('returns a string with the given prefix', () => {
    const result = hashId(SEED, 'user', 'someUserId');
    expect(result).toMatch(/^user_[0-9a-f]{8}$/);
  });

  it('is deterministic — same inputs always produce the same hash', () => {
    const a = hashId(SEED, 'playlist', 'abc123');
    const b = hashId(SEED, 'playlist', 'abc123');
    expect(a).toBe(b);
  });

  it('produces different hashes for different values', () => {
    const a = hashId(SEED, 'playlist', 'playlist-1');
    const b = hashId(SEED, 'playlist', 'playlist-2');
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different seeds', () => {
    const a = hashId(SEED, 'user', 'user1');
    const b = hashId('different-seed', 'user', 'user1');
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different prefixes', () => {
    const a = hashId(SEED, 'user', 'id1');
    const b = hashId(SEED, 'owner', 'id1');
    expect(a).not.toBe(b);
  });

  it('hash portion is exactly 8 hex characters', () => {
    const result = hashId(SEED, 'playlist', 'test');
    const hashPart = result.split('_')[1];
    expect(hashPart).toHaveLength(8);
    expect(hashPart).toMatch(/^[0-9a-f]+$/);
  });
});

describe('createAnonymizationContext', () => {
  it('memoizes playlist ID anonymization', () => {
    const ctx = createAnonymizationContext(SEED);
    const first = ctx.anonymizePlaylistId('original-id');
    const second = ctx.anonymizePlaylistId('original-id');
    expect(first).toBe(second);
  });

  it('produces different anonymized IDs for different original IDs', () => {
    const ctx = createAnonymizationContext(SEED);
    const a = ctx.anonymizePlaylistId('playlist-a');
    const b = ctx.anonymizePlaylistId('playlist-b');
    expect(a).not.toBe(b);
  });

  it('nextPlaylistName returns 1-based sequential names', () => {
    const ctx = createAnonymizationContext(SEED);
    expect(ctx.nextPlaylistName()).toBe('My Playlist 1');
    expect(ctx.nextPlaylistName()).toBe('My Playlist 2');
    expect(ctx.nextPlaylistName()).toBe('My Playlist 3');
  });

  it('anonymized IDs have correct prefix format', () => {
    const ctx = createAnonymizationContext(SEED);
    const id = ctx.anonymizePlaylistId('test-id');
    expect(id).toMatch(/^playlist_[0-9a-f]{8}$/);
  });
});

describe('SCRUBBED constants', () => {
  it('has expected values', () => {
    expect(SCRUBBED.DISPLAY_NAME).toBe('Anonymous User');
    expect(SCRUBBED.EMAIL).toBe(null);
    expect(SCRUBBED.EMPTY_STRING).toBe('');
    expect(SCRUBBED.EMPTY_ARRAY).toEqual([]);
  });
});
