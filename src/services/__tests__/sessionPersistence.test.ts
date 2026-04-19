import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveSession,
  loadSession,
  clearSession,
  isSessionStale,
  STALE_SESSION_MS,
} from '../sessionPersistence';
import type { SessionSnapshot } from '../sessionPersistence';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

const baseSnapshot: SessionSnapshot = {
  collectionId: 'col-1',
  collectionName: 'Test Album',
  trackIndex: 2,
  trackId: 'track-abc',
  trackTitle: 'My Track',
  trackArtist: 'Artist Name',
};

describe('sessionPersistence', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
    localStorageMock.clear();
  });

  describe('saveSession / loadSession', () => {
    it('persists and restores playbackPosition', () => {
      // #given
      const snapshot: SessionSnapshot = { ...baseSnapshot, playbackPosition: 42.5 };

      // #when
      saveSession(snapshot);
      const loaded = loadSession();

      // #then
      expect(loaded?.playbackPosition).toBe(42.5);
    });

    it('loads session with undefined playbackPosition when not saved', () => {
      // #given
      saveSession(baseSnapshot);

      // #when
      const loaded = loadSession();

      // #then
      expect(loaded?.playbackPosition).toBeUndefined();
    });

    it('persists zero playbackPosition', () => {
      // #given
      const snapshot: SessionSnapshot = { ...baseSnapshot, playbackPosition: 0 };

      // #when
      saveSession(snapshot);
      const loaded = loadSession();

      // #then
      expect(loaded?.playbackPosition).toBe(0);
    });

    it('sets savedAt timestamp on save', () => {
      // #given
      const before = Date.now();

      // #when
      saveSession(baseSnapshot);
      const loaded = loadSession();

      // #then
      expect(loaded?.savedAt).toBeGreaterThanOrEqual(before);
    });

    it('returns null when nothing is saved', () => {
      // #when
      const loaded = loadSession();

      // #then
      expect(loaded).toBeNull();
    });

    it('round-trips all core fields including playbackPosition', () => {
      // #given
      const snapshot: SessionSnapshot = {
        ...baseSnapshot,
        collectionProvider: 'spotify',
        playbackPosition: 123.456,
      };

      // #when
      saveSession(snapshot);
      const loaded = loadSession();

      // #then
      expect(loaded?.collectionId).toBe('col-1');
      expect(loaded?.trackIndex).toBe(2);
      expect(loaded?.collectionProvider).toBe('spotify');
      expect(loaded?.playbackPosition).toBe(123.456);
    });
  });

  describe('playbackPosition unit contract', () => {
    it('stores playbackPosition as milliseconds (not seconds)', () => {
      // #given — a typical position of 2 minutes 30 seconds = 150,000 ms
      const snapshot: SessionSnapshot = { ...baseSnapshot, playbackPosition: 150_000 };

      // #when
      saveSession(snapshot);
      const loaded = loadSession();

      // #then — value must come back unchanged (milliseconds, not multiplied/divided)
      expect(loaded?.playbackPosition).toBe(150_000);
    });

    it('stores sub-second playbackPosition accurately', () => {
      // #given — position at 500 ms
      const snapshot: SessionSnapshot = { ...baseSnapshot, playbackPosition: 500 };

      // #when
      saveSession(snapshot);
      const loaded = loadSession();

      // #then
      expect(loaded?.playbackPosition).toBe(500);
    });
  });

  describe('isSessionStale', () => {
    const now = 1_700_000_000_000;

    it('returns true for null session', () => {
      // #when / #then
      expect(isSessionStale(null, now)).toBe(true);
    });

    it('returns true for undefined session', () => {
      // #when / #then
      expect(isSessionStale(undefined, now)).toBe(true);
    });

    it('returns true when savedAt is missing', () => {
      // #given
      const session: SessionSnapshot = { ...baseSnapshot };

      // #when / #then
      expect(isSessionStale(session, now)).toBe(true);
    });

    it('returns true when savedAt is undefined explicitly', () => {
      // #given
      const session: SessionSnapshot = { ...baseSnapshot, savedAt: undefined };

      // #when / #then
      expect(isSessionStale(session, now)).toBe(true);
    });

    it('returns false when savedAt is exactly at the 30-day cutoff', () => {
      // #given — "older than 30 days" is strict, so exactly 30 days is still fresh
      const session: SessionSnapshot = { ...baseSnapshot, savedAt: now - STALE_SESSION_MS };

      // #when / #then
      expect(isSessionStale(session, now)).toBe(false);
    });

    it('returns true when savedAt is 1ms past the 30-day cutoff', () => {
      // #given
      const session: SessionSnapshot = { ...baseSnapshot, savedAt: now - STALE_SESSION_MS - 1 };

      // #when / #then
      expect(isSessionStale(session, now)).toBe(true);
    });

    it('returns false for a session saved just now', () => {
      // #given
      const session: SessionSnapshot = { ...baseSnapshot, savedAt: now };

      // #when / #then
      expect(isSessionStale(session, now)).toBe(false);
    });

    it('returns false for a session saved 1 day ago', () => {
      // #given
      const session: SessionSnapshot = {
        ...baseSnapshot,
        savedAt: now - 24 * 60 * 60 * 1000,
      };

      // #when / #then
      expect(isSessionStale(session, now)).toBe(false);
    });

    it('uses Date.now() when now is not provided', () => {
      // #given — savedAt 1 second ago relative to real clock
      const session: SessionSnapshot = { ...baseSnapshot, savedAt: Date.now() - 1000 };

      // #when / #then
      expect(isSessionStale(session)).toBe(false);
    });
  });

  describe('clearSession', () => {
    it('removes persisted session', () => {
      // #given
      saveSession({ ...baseSnapshot, playbackPosition: 10 });

      // #when
      clearSession();

      // #then
      expect(loadSession()).toBeNull();
    });
  });
});
