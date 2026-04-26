import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResumeSection } from '../useResumeSection';
import { STALE_SESSION_MS } from '@/services/sessionPersistence';
import type { SessionSnapshot } from '@/services/sessionPersistence';

const makeSession = (overrides?: Partial<SessionSnapshot>): SessionSnapshot => ({
  collectionId: 'col-1',
  collectionName: 'Test Playlist',
  trackIndex: 0,
  savedAt: Date.now(),
  queueTracks: [],
  ...overrides,
});

describe('useResumeSection', () => {
  describe('with null session', () => {
    it('returns hasResumable false when lastSession is null', () => {
      // #when
      const { result } = renderHook(() => useResumeSection({ lastSession: null }));

      // #then
      expect(result.current.hasResumable).toBe(false);
    });

    it('returns session null when lastSession is null', () => {
      // #when
      const { result } = renderHook(() => useResumeSection({ lastSession: null }));

      // #then
      expect(result.current.session).toBeNull();
    });
  });

  describe('with fresh session', () => {
    it('returns hasResumable true for a recent session', () => {
      // #given
      const session = makeSession({ savedAt: Date.now() - 1000 });

      // #when
      const { result } = renderHook(() => useResumeSection({ lastSession: session }));

      // #then
      expect(result.current.hasResumable).toBe(true);
    });

    it('returns the session itself when hasResumable is true', () => {
      // #given
      const session = makeSession();

      // #when
      const { result } = renderHook(() => useResumeSection({ lastSession: session }));

      // #then
      expect(result.current.session).toBe(session);
    });
  });

  describe('with stale session', () => {
    it('returns hasResumable false when session is older than STALE_SESSION_MS', () => {
      // #given
      const session = makeSession({ savedAt: Date.now() - STALE_SESSION_MS - 1000 });

      // #when
      const { result } = renderHook(() => useResumeSection({ lastSession: session }));

      // #then
      expect(result.current.hasResumable).toBe(false);
    });

    it('returns session null when session is stale', () => {
      // #given
      const session = makeSession({ savedAt: Date.now() - STALE_SESSION_MS - 1000 });

      // #when
      const { result } = renderHook(() => useResumeSection({ lastSession: session }));

      // #then
      expect(result.current.session).toBeNull();
    });

    it('treats session saved exactly at STALE_SESSION_MS as stale', () => {
      // #given — boundary: exactly at the stale threshold
      const session = makeSession({ savedAt: Date.now() - STALE_SESSION_MS });

      // #when
      const { result } = renderHook(() => useResumeSection({ lastSession: session }));

      // #then
      expect(result.current.hasResumable).toBe(false);
    });
  });
});
