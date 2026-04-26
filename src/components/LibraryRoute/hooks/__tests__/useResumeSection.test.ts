import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResumeSection } from '../useResumeSection';
import { STALE_SESSION_MS, type SessionSnapshot } from '@/services/sessionPersistence';

function makeSession(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    collectionId: 'playlist-1',
    collectionName: 'My Playlist',
    trackIndex: 0,
    savedAt: Date.now(),
    ...overrides,
  };
}

describe('useResumeSection', () => {
  it('returns no resumable when lastSession is null', () => {
    // #when
    const { result } = renderHook(() => useResumeSection({ lastSession: null }));

    // #then
    expect(result.current.session).toBeNull();
    expect(result.current.hasResumable).toBe(false);
  });

  it('returns no resumable when session is stale', () => {
    // #given
    const stale = makeSession({ savedAt: Date.now() - STALE_SESSION_MS - 1000 });

    // #when
    const { result } = renderHook(() => useResumeSection({ lastSession: stale }));

    // #then
    expect(result.current.session).toBeNull();
    expect(result.current.hasResumable).toBe(false);
  });

  it('surfaces session when fresh', () => {
    // #given
    const fresh = makeSession();

    // #when
    const { result } = renderHook(() => useResumeSection({ lastSession: fresh }));

    // #then
    expect(result.current.session).toBe(fresh);
    expect(result.current.hasResumable).toBe(true);
  });
});
