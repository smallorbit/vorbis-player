import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MediaTrack } from '@/types/domain';

vi.mock('../dropboxArtCache', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '../dropboxArtCache';
import {
  getLikedTracks,
  getLikedCount,
  isTrackLiked,
  setTrackLiked,
  clearLikes,
  exportLikes,
  importLikes,
  refreshLikedTrackMetadata,
} from '../dropboxLikesCache';

const DB_NAME = 'vorbis-dropbox-likes-test';
const DB_VERSION = 3;

function openTestDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME + '-' + Math.random(), DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('art')) {
        db.createObjectStore('art', { keyPath: 'path' });
      }
      if (!db.objectStoreNames.contains('catalog')) {
        db.createObjectStore('catalog', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('likes')) {
        db.createObjectStore('likes', { keyPath: 'trackId' });
      }
    };
  });
}

function makeTrack(id: string, name?: string): MediaTrack {
  return {
    id,
    provider: 'dropbox',
    playbackRef: { provider: 'dropbox', ref: `/artist/album/${id}.mp3` },
    name: name ?? `Track ${id}`,
    artists: 'Test Artist',
    album: 'Test Album',
    albumId: '/artist/album',
    durationMs: 180000,
  };
}

let testDb: IDBDatabase;

beforeEach(async () => {
  testDb = await openTestDb();
  vi.mocked(getDb).mockResolvedValue(testDb);
});

describe('dropboxLikesCache', () => {
  describe('getLikedCount', () => {
    it('returns 0 when no likes', async () => {
      expect(await getLikedCount()).toBe(0);
    });
  });

  describe('isTrackLiked', () => {
    it('returns false for non-liked track', async () => {
      expect(await isTrackLiked('id:123')).toBe(false);
    });
  });

  describe('setTrackLiked / isTrackLiked / getLikedCount', () => {
    it('likes a track and reports it as liked', async () => {
      const track = makeTrack('id:1', 'Song One');

      await setTrackLiked('id:1', track, true);

      expect(await isTrackLiked('id:1')).toBe(true);
      expect(await getLikedCount()).toBe(1);
    });

    it('unlikes a track', async () => {
      const track = makeTrack('id:1', 'Song One');
      await setTrackLiked('id:1', track, true);

      await setTrackLiked('id:1', null, false);

      expect(await isTrackLiked('id:1')).toBe(false);
      expect(await getLikedCount()).toBe(0);
    });
  });

  describe('getLikedTracks', () => {
    it('returns liked tracks sorted by likedAt descending', async () => {
      const track1 = makeTrack('id:1', 'First');
      const track2 = makeTrack('id:2', 'Second');

      await setTrackLiked('id:1', track1, true);
      // Small delay so timestamps differ
      await new Promise((r) => setTimeout(r, 10));
      await setTrackLiked('id:2', track2, true);

      const tracks = await getLikedTracks();

      expect(tracks).toHaveLength(2);
      expect(tracks[0].name).toBe('Second');
      expect(tracks[1].name).toBe('First');
    });

    it('returns empty array when no likes', async () => {
      expect(await getLikedTracks()).toEqual([]);
    });
  });

  describe('clearLikes', () => {
    it('removes all liked tracks', async () => {
      await setTrackLiked('id:1', makeTrack('id:1'), true);
      await setTrackLiked('id:2', makeTrack('id:2'), true);

      await clearLikes();

      expect(await getLikedCount()).toBe(0);
      expect(await getLikedTracks()).toEqual([]);
    });
  });

  describe('exportLikes / importLikes', () => {
    it('round-trips liked tracks through export and import', async () => {
      await setTrackLiked('id:1', makeTrack('id:1', 'Song A'), true);
      await setTrackLiked('id:2', makeTrack('id:2', 'Song B'), true);

      const json = await exportLikes();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);

      // Clear and import
      await clearLikes();
      expect(await getLikedCount()).toBe(0);

      const count = await importLikes(json);
      expect(count).toBe(2);
      expect(await getLikedCount()).toBe(2);
      expect(await isTrackLiked('id:1')).toBe(true);
      expect(await isTrackLiked('id:2')).toBe(true);
    });

    it('importLikes returns 0 for invalid JSON', async () => {
      expect(await importLikes('not-json')).toBe(0);
    });

    it('importLikes returns 0 for non-array JSON', async () => {
      expect(await importLikes('{"foo": "bar"}')).toBe(0);
    });
  });

  describe('refreshLikedTrackMetadata', () => {
    it('updates metadata for liked tracks that exist in fresh scan', async () => {
      const oldTrack = makeTrack('id:1', 'Old Name');
      await setTrackLiked('id:1', oldTrack, true);

      const freshTrack = makeTrack('id:1', 'New Name');
      const result = await refreshLikedTrackMetadata([freshTrack]);

      expect(result.updated).toBe(1);
      expect(result.removed).toBe(0);

      const tracks = await getLikedTracks();
      expect(tracks[0].name).toBe('New Name');
    });

    it('removes liked tracks not found in fresh scan', async () => {
      await setTrackLiked('id:1', makeTrack('id:1'), true);
      await setTrackLiked('id:2', makeTrack('id:2'), true);

      // Fresh scan only has id:1
      const result = await refreshLikedTrackMetadata([makeTrack('id:1')]);

      expect(result.updated).toBe(1);
      expect(result.removed).toBe(1);
      expect(await isTrackLiked('id:1')).toBe(true);
      expect(await isTrackLiked('id:2')).toBe(false);
    });
  });

  describe('IDB unavailable', () => {
    it('getLikedTracks returns empty array when getDb returns null', async () => {
      vi.mocked(getDb).mockResolvedValue(null);
      expect(await getLikedTracks()).toEqual([]);
    });

    it('getLikedCount returns 0 when getDb returns null', async () => {
      vi.mocked(getDb).mockResolvedValue(null);
      expect(await getLikedCount()).toBe(0);
    });

    it('isTrackLiked returns false when getDb returns null', async () => {
      vi.mocked(getDb).mockResolvedValue(null);
      expect(await isTrackLiked('id:1')).toBe(false);
    });

    it('setTrackLiked does not throw when getDb returns null', async () => {
      vi.mocked(getDb).mockResolvedValue(null);
      await expect(setTrackLiked('id:1', makeTrack('id:1'), true)).resolves.toBeUndefined();
    });

    it('clearLikes does not throw when getDb returns null', async () => {
      vi.mocked(getDb).mockResolvedValue(null);
      await expect(clearLikes()).resolves.toBeUndefined();
    });

    it('exportLikes returns empty array JSON when getDb returns null', async () => {
      vi.mocked(getDb).mockResolvedValue(null);
      expect(await exportLikes()).toBe('[]');
    });

    it('importLikes returns 0 when getDb returns null', async () => {
      vi.mocked(getDb).mockResolvedValue(null);
      expect(await importLikes('[]')).toBe(0);
    });
  });
});
