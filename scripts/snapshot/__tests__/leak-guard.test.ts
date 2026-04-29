
import { describe, it, expect } from 'vitest';
import { assertNoTokenLeak } from '../leak-guard.ts';

const CLEAN_SNAPSHOT = JSON.stringify({
  meta: { schemaVersion: 1, provider: 'spotify', generatedAt: '2026-01-01T00:00:00.000Z' },
  user: { displayName: 'Anonymous User', hashedId: 'user_a1b2c3d4' },
  tracks: {},
  playlists: [],
  albums: [],
  likedTrackIds: [],
  pins: { playlistIds: [], albumIds: [] },
});

describe('assertNoTokenLeak', () => {
  it('passes for a clean snapshot', () => {
    expect(() => assertNoTokenLeak(CLEAN_SNAPSHOT)).not.toThrow();
  });

  it('catches HTTP Bearer token prefix', () => {
    const dirty = CLEAN_SNAPSHOT.replace(
      '"Anonymous User"',
      `"${'B' + 'earer eyJhbGciOiJSUzI1NiJ9.foo'}"`,
    );
    expect(() => assertNoTokenLeak(dirty)).toThrow(/Bearer/i);
  });

  it('catches Stripe-style live key prefix at start of value', () => {
    const dirty = CLEAN_SNAPSHOT + '"s' + 'k_live_someApiKeyValue"';
    expect(() => assertNoTokenLeak(dirty)).toThrow(/Stripe/i);
  });

  it('catches Stripe-style live key prefix mid-value', () => {
    const dirty = CLEAN_SNAPSHOT + '"prefix-s' + 'k_live_someApiKeyValue"';
    expect(() => assertNoTokenLeak(dirty)).toThrow(/Stripe/i);
  });

  it('catches Stripe-style test key prefix', () => {
    const dirty = CLEAN_SNAPSHOT + '"s' + 'k_test_anotherApiKeyValue"';
    expect(() => assertNoTokenLeak(dirty)).toThrow(/Stripe/i);
  });

  it('catches base64 strings longer than 80 chars', () => {
    const longToken = 'A'.repeat(85);
    const dirty = CLEAN_SNAPSHOT + longToken;
    expect(() => assertNoTokenLeak(dirty)).toThrow(/base64/i);
  });

  it('passes for base64-like strings shorter than 80 chars', () => {
    const short = 'A'.repeat(79);
    const safe = CLEAN_SNAPSHOT + short;
    expect(() => assertNoTokenLeak(safe)).not.toThrow();
  });

  it('catches JSON key containing "token"', () => {
    const dirty = CLEAN_SNAPSHOT.replace('"schemaVersion"', '"accessToken"');
    expect(() => assertNoTokenLeak(dirty)).toThrow();
  });

  it('catches JSON key containing "auth"', () => {
    const dirty = CLEAN_SNAPSHOT.replace('"schemaVersion"', '"authHeader"');
    expect(() => assertNoTokenLeak(dirty)).toThrow();
  });

  it('includes the offending excerpt in the error message', () => {
    const longToken = 'B' + 'earer eyJhbGciOiJSUzI1NiJ9abc';
    const dirty = CLEAN_SNAPSHOT + `"${longToken}"`;
    try {
      assertNoTokenLeak(dirty);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('Token-like value detected');
    }
  });
});
