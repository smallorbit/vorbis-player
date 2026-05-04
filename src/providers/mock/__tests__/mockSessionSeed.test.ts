import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SessionSnapshot } from '@/services/sessionPersistence';

const SESSION_KEY = 'vorbis-player-last-session';

describe('seedMockSession', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(window, 'location', {
      value: { href: 'http://127.0.0.1:3000/' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseSnap: SessionSnapshot = {
    collectionId: 'playlist-1',
    collectionName: 'Test Playlist',
    collectionProvider: 'spotify',
    trackIndex: 2,
    trackId: 'track-abc',
    playbackPosition: 45000,
  };

  function encodeSnap(snap: Partial<SessionSnapshot>): string {
    return btoa(JSON.stringify(snap));
  }

  it('returns null when mock-session param is absent', async () => {
    // #given no mock-session in URL
    const { seedMockSession } = await import('../mockSessionSeed');
    // #when seeding
    const result = seedMockSession();
    // #then returns null and does not write to storage
    expect(result).toBeNull();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('decodes a valid snapshot and saves it to localStorage', async () => {
    // #given a properly encoded SessionSnapshot in the URL
    Object.defineProperty(window, 'location', {
      value: { href: `http://127.0.0.1:3000/?mock-session=${encodeURIComponent(encodeSnap(baseSnap))}` },
      writable: true,
    });
    const { seedMockSession } = await import('../mockSessionSeed');
    // #when seeding
    const result = seedMockSession();
    // #then returns the decoded snapshot
    expect(result?.collectionId).toBe('playlist-1');
    expect(result?.playbackPosition).toBe(45000);
    expect(result?.trackId).toBe('track-abc');
    // #then persists to localStorage via saveSession
    expect(localStorage.setItem).toHaveBeenCalledWith(
      SESSION_KEY,
      expect.stringContaining('"collectionId":"playlist-1"'),
    );
  });

  it('includes positionMs in the saved snapshot', async () => {
    // #given a snapshot with a non-zero playback position
    const snap = { ...baseSnap, playbackPosition: 123456 };
    Object.defineProperty(window, 'location', {
      value: { href: `http://127.0.0.1:3000/?mock-session=${encodeURIComponent(encodeSnap(snap))}` },
      writable: true,
    });
    const { seedMockSession } = await import('../mockSessionSeed');
    // #when seeding
    const result = seedMockSession();
    // #then position is preserved in the returned snapshot
    expect(result?.playbackPosition).toBe(123456);
  });

  it('returns null when JSON content is not a valid SessionSnapshot', async () => {
    // #given base64 that decodes to JSON but lacks required fields
    const bad = encodeSnap({ foo: 'bar' } as unknown as SessionSnapshot);
    Object.defineProperty(window, 'location', {
      value: { href: `http://127.0.0.1:3000/?mock-session=${encodeURIComponent(bad)}` },
      writable: true,
    });
    const { seedMockSession } = await import('../mockSessionSeed');
    // #when seeding
    const result = seedMockSession();
    // #then ignores invalid shape
    expect(result).toBeNull();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('returns null when base64 content is not valid JSON', async () => {
    // #given base64 that decodes to a non-JSON string
    const notJson = btoa('{not:valid:json}');
    Object.defineProperty(window, 'location', {
      value: { href: `http://127.0.0.1:3000/?mock-session=${encodeURIComponent(notJson)}` },
      writable: true,
    });
    const { seedMockSession } = await import('../mockSessionSeed');
    // #when seeding
    const result = seedMockSession();
    // #then ignores parse failure
    expect(result).toBeNull();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('requires collectionId, collectionName, and trackIndex to be present', async () => {
    // #given a snapshot missing trackIndex
    const partial = { collectionId: 'p1', collectionName: 'P1' } as unknown as SessionSnapshot;
    Object.defineProperty(window, 'location', {
      value: { href: `http://127.0.0.1:3000/?mock-session=${encodeURIComponent(encodeSnap(partial))}` },
      writable: true,
    });
    const { seedMockSession } = await import('../mockSessionSeed');
    // #when seeding
    const result = seedMockSession();
    // #then rejects the snapshot
    expect(result).toBeNull();
  });
});
