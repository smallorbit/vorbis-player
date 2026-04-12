import { describe, it, expect, beforeEach } from 'vitest';
import { saveSession, loadSession, clearSession } from '../sessionPersistence';
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
