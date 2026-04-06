import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MediaTrack } from '@/types/domain';
import type { LikedEntry, Tombstone } from '../dropboxLikesCache';
import type { RemoteLikesFile } from '../dropboxLikesSync';

vi.mock('../dropboxLikesCache', () => ({
  getLikedEntries: vi.fn(),
  replaceLikes: vi.fn(),
  getTombstones: vi.fn(),
  setTombstones: vi.fn(),
  clearTombstones: vi.fn(),
}));

vi.mock('../dropboxSyncFolder', () => ({
  ensureVorbisFolder: vi.fn(),
}));

import {
  getLikedEntries,
  replaceLikes,
  getTombstones,
  setTombstones,
} from '../dropboxLikesCache';
import { ensureVorbisFolder } from '../dropboxSyncFolder';

import { DropboxLikesSyncService } from '../dropboxLikesSync';

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

function makeLikedEntry(id: string, likedAt: number, name?: string): LikedEntry {
  return {
    trackId: id,
    track: makeTrack(id, name),
    likedAt,
  };
}

function makeTombstone(trackId: string, deletedAt: number): Tombstone {
  return { trackId, deletedAt };
}

function createMockAuth(token = 'test-token') {
  return {
    providerId: 'dropbox' as const,
    isAuthenticated: vi.fn().mockReturnValue(true),
    getAccessToken: vi.fn().mockResolvedValue(token),
    beginLogin: vi.fn(),
    handleCallback: vi.fn(),
    logout: vi.fn(),
    ensureValidToken: vi.fn().mockResolvedValue(token),
    refreshAccessToken: vi.fn().mockResolvedValue(token),
  };
}

describe('DropboxLikesSyncService', () => {
  let service: DropboxLikesSyncService;
  let mockAuth: ReturnType<typeof createMockAuth>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockAuth = createMockAuth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new DropboxLikesSyncService(mockAuth as any);
    vi.mocked(getLikedEntries).mockResolvedValue([]);
    vi.mocked(getTombstones).mockResolvedValue([]);
    vi.mocked(replaceLikes).mockResolvedValue(undefined);
    vi.mocked(setTombstones).mockResolvedValue(undefined);
    vi.mocked(ensureVorbisFolder).mockResolvedValue(true);
  });

  afterEach(() => {
    service.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('mergeLikes', () => {
    it('merges empty local and remote', () => {
      // #when
      const result = service.mergeLikes([], null, []);

      // #then
      expect(result.mergedLikes).toEqual([]);
      expect(result.mergedTombstones).toEqual([]);
      expect(result.changed).toBe(false);
    });

    it('keeps local likes when remote is empty', () => {
      // #given
      const local = [makeLikedEntry('a', 1000)];

      // #when
      const result = service.mergeLikes(local, null, []);

      // #then
      expect(result.mergedLikes).toHaveLength(1);
      expect(result.mergedLikes[0].trackId).toBe('a');
      expect(result.changed).toBe(false);
    });

    it('adds remote likes missing locally', () => {
      // #given
      const remote: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [makeLikedEntry('b', 2000)],
        tombstones: [],
      };

      // #when
      const result = service.mergeLikes([], remote, []);

      // #then
      expect(result.mergedLikes).toHaveLength(1);
      expect(result.mergedLikes[0].trackId).toBe('b');
      expect(result.changed).toBe(true);
    });

    it('merges overlapping likes keeping latest likedAt', () => {
      // #given
      const local = [makeLikedEntry('a', 3000, 'Local Name')];
      const remote: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [makeLikedEntry('a', 1000, 'Remote Name')],
        tombstones: [],
      };

      // #when
      const result = service.mergeLikes(local, remote, []);

      // #then
      expect(result.mergedLikes).toHaveLength(1);
      // Local entry is newer, should win
      expect(result.mergedLikes[0].likedAt).toBe(3000);
      expect(result.mergedLikes[0].track.name).toBe('Local Name');
      expect(result.changed).toBe(false);
      expect(result.remoteChanged).toBe(true);
    });

    it('tombstone wins over like when deletedAt > likedAt', () => {
      // #given
      const local = [makeLikedEntry('a', 1000)];
      const localTombstones = [makeTombstone('a', 2000)];

      // #when
      const result = service.mergeLikes(local, null, localTombstones);

      // #then
      expect(result.mergedLikes).toHaveLength(0);
      expect(result.changed).toBe(true);
    });

    it('like wins over tombstone when likedAt > deletedAt', () => {
      // #given
      const local = [makeLikedEntry('a', 3000)];
      const localTombstones = [makeTombstone('a', 2000)];

      // #when
      const result = service.mergeLikes(local, null, localTombstones);

      // #then
      expect(result.mergedLikes).toHaveLength(1);
      expect(result.mergedLikes[0].trackId).toBe('a');
    });

    it('remote tombstone removes local like', () => {
      // #given
      const local = [makeLikedEntry('a', 1000)];
      const remote: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [],
        tombstones: [makeTombstone('a', 2000)],
      };

      // #when
      const result = service.mergeLikes(local, remote, []);

      // #then
      expect(result.mergedLikes).toHaveLength(0);
      expect(result.changed).toBe(true);
    });

    it('prunes tombstones older than 30 days', () => {
      // #given
      const now = Date.now();
      const oldTombstone = makeTombstone('old', now - 31 * 24 * 60 * 60 * 1000);
      const recentTombstone = makeTombstone('recent', now - 1000);

      // #when
      const result = service.mergeLikes([], null, [oldTombstone, recentTombstone]);

      // #then
      expect(result.mergedTombstones).toHaveLength(1);
      expect(result.mergedTombstones[0].trackId).toBe('recent');
    });

    it('merges both local and remote likes and tombstones', () => {
      // #given
      const local = [makeLikedEntry('a', 1000), makeLikedEntry('c', 3000)];
      const remote: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [makeLikedEntry('a', 500), makeLikedEntry('b', 2000)],
        tombstones: [makeTombstone('c', 4000)],
      };
      const localTombstones: Tombstone[] = [];

      // #when
      const result = service.mergeLikes(local, remote, localTombstones);

      // #then
      const ids = result.mergedLikes.map((e) => e.trackId).sort();
      expect(ids).toEqual(['a', 'b']); // c removed by remote tombstone
      expect(result.mergedLikes.find((e) => e.trackId === 'a')?.likedAt).toBe(1000); // local wins
    });
  });

  describe('downloadLikesFile', () => {
    it('returns null when not authenticated', async () => {
      mockAuth.ensureValidToken.mockResolvedValue(null);
      const result = await service.downloadLikesFile();
      expect(result).toBeNull();
    });

    it('returns null on 409 (file not found)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 409, ok: false }));
      const result = await service.downloadLikesFile();
      expect(result).toBeNull();
    });

    it('parses remote file on success', async () => {
      // #given
      const remoteData: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [makeLikedEntry('a', 1000)],
        tombstones: [],
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          status: 200,
          ok: true,
          json: () => Promise.resolve(remoteData),
        }),
      );

      // #when
      const result = await service.downloadLikesFile();

      // #then
      expect(result).toEqual(remoteData);
    });

    it('retries with refreshed token on 401', async () => {
      // #given
      const remoteData: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [],
        tombstones: [],
      };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ status: 401, ok: false })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve(remoteData),
        });
      vi.stubGlobal('fetch', fetchMock);

      // #when
      const result = await service.downloadLikesFile();

      // #then
      expect(result).toEqual(remoteData);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(mockAuth.refreshAccessToken).toHaveBeenCalled();
    });
  });

  describe('uploadLikesFile', () => {
    it('returns false when not authenticated', async () => {
      mockAuth.ensureValidToken.mockResolvedValue(null);
      const data: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [],
        tombstones: [],
      };
      const result = await service.uploadLikesFile(data);
      expect(result).toBe(false);
    });

    it('returns true on successful upload', async () => {
      // #given
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ status: 200, ok: true }),
      );
      const data: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [makeLikedEntry('a', 1000)],
        tombstones: [],
      };

      // #when
      const result = await service.uploadLikesFile(data);

      // #then
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('calls ensureVorbisFolder before upload', async () => {
      // #given
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true }));

      const data: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [makeLikedEntry('a', 1000)],
        tombstones: [],
      };

      // #when
      const result = await service.uploadLikesFile(data);

      // #then
      expect(result).toBe(true);
      expect(ensureVorbisFolder).toHaveBeenCalled();
    });

    it('returns false when folder creation fails', async () => {
      // #given
      vi.mocked(ensureVorbisFolder).mockResolvedValueOnce(false);

      const data: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [],
        tombstones: [],
      };

      // #when
      const result = await service.uploadLikesFile(data);

      // #then
      expect(result).toBe(false);
    });
  });

  describe('initialSync', () => {
    it('merges remote and local then pushes', async () => {
      const localEntries = [makeLikedEntry('a', 1000)];
      const remoteData: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [makeLikedEntry('b', 2000)],
        tombstones: [],
      };

      vi.mocked(getLikedEntries).mockResolvedValue(localEntries);
      vi.mocked(getTombstones).mockResolvedValue([]);

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve(remoteData),
        })
        .mockResolvedValueOnce({ status: 200, ok: true }); // upload
      vi.stubGlobal('fetch', fetchMock);

      await service.initialSync();

      expect(replaceLikes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ trackId: 'a' }),
          expect.objectContaining({ trackId: 'b' }),
        ]),
      );
    });

    it('handles download failure gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error')),
      );

      // Should not throw
      await service.initialSync();
    });

    it('pushes when local likedAt is newer than remote for same track ids', async () => {
      const localEntries = [makeLikedEntry('a', 3000, 'Local Name')];
      const remoteData: RemoteLikesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        likes: [makeLikedEntry('a', 1000, 'Remote Name')],
        tombstones: [],
      };

      vi.mocked(getLikedEntries).mockResolvedValue(localEntries);
      vi.mocked(getTombstones).mockResolvedValue([]);

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve(remoteData),
        })
        .mockResolvedValueOnce({ status: 200, ok: true }); // upload
      vi.stubGlobal('fetch', fetchMock);

      await service.initialSync();

      // download + upload (folder ensured via shared utility)
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('schedulePush', () => {
    it('debounces push calls', async () => {
      // #given
      const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true });
      vi.stubGlobal('fetch', fetchMock);

      // #when
      service.schedulePush();
      service.schedulePush();
      service.schedulePush();

      // #then — nothing should have been called yet
      expect(fetchMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2500);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
