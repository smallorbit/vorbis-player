import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RemotePreferencesFile } from '../dropboxPreferencesSync';
import type { DropboxAuthAdapter } from '../dropboxAuthAdapter';

vi.mock('@/services/settings/pinnedItemsStorage', () => ({
  getPins: vi.fn(),
  setPins: vi.fn(),
  notifyPinsChanged: vi.fn(),
  UNIFIED_PROVIDER: '_unified',
}));

vi.mock('../dropboxSyncFolder', () => ({
  ensureVorbisFolder: vi.fn(),
}));

import { getPins, setPins } from '@/services/settings/pinnedItemsStorage';
import { ensureVorbisFolder } from '../dropboxSyncFolder';
import {
  DropboxPreferencesSyncService,
  buildPreferencesFromLocal,
  applyRemoteToLocal,
} from '../dropboxPreferencesSync';

function makeRemote(overrides?: Partial<RemotePreferencesFile>): RemotePreferencesFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    pins: { playlists: [], albums: [] },
    accent: { overrides: {}, customColors: {} },
    ...overrides,
  };
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
    reportUnauthorized: vi.fn(),
  } satisfies DropboxAuthAdapter;
}

describe('DropboxPreferencesSyncService', () => {
  let service: DropboxPreferencesSyncService;
  let mockAuth: ReturnType<typeof createMockAuth>;
  let localStorageStore: Record<string, string>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockAuth = createMockAuth();
    localStorageStore = {};
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => localStorageStore[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
      localStorageStore[key] = value;
    });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete localStorageStore[key];
    });
    vi.mocked(getPins).mockResolvedValue([]);
    vi.mocked(setPins).mockResolvedValue(undefined);
    vi.mocked(ensureVorbisFolder).mockResolvedValue(true);
    service = new DropboxPreferencesSyncService(mockAuth);
  });

  afterEach(() => {
    service.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('merge', () => {
    it('when remote is missing, shouldPushLocal is true', () => {
      const result = service.merge(null, null);
      expect(result.shouldApplyRemote).toBe(false);
      expect(result.shouldPushLocal).toBe(true);
    });

    it('when remote is newer than local, applies remote and does not push', () => {
      const remote = makeRemote({ updatedAt: '2025-03-17T12:00:00.000Z' });
      const result = service.merge(remote, '2025-03-16T12:00:00.000Z');
      expect(result.shouldApplyRemote).toBe(true);
      expect(result.shouldPushLocal).toBe(false);
    });

    it('when local is newer than remote, does not apply remote and pushes', () => {
      const remote = makeRemote({ updatedAt: '2025-03-16T12:00:00.000Z' });
      const result = service.merge(remote, '2025-03-17T12:00:00.000Z');
      expect(result.shouldApplyRemote).toBe(false);
      expect(result.shouldPushLocal).toBe(true);
    });

    it('when timestamps equal, no apply and no push', () => {
      const ts = '2025-03-17T12:00:00.000Z';
      const remote = makeRemote({ updatedAt: ts });
      const result = service.merge(remote, ts);
      expect(result.shouldApplyRemote).toBe(false);
      expect(result.shouldPushLocal).toBe(false);
    });

    it('when local has no updatedAt, remote wins', () => {
      const remote = makeRemote({ updatedAt: '2025-03-17T12:00:00.000Z' });
      const result = service.merge(remote, null);
      expect(result.shouldApplyRemote).toBe(true);
      expect(result.shouldPushLocal).toBe(false);
    });
  });

  describe('buildPreferencesFromLocal', () => {
    it('builds payload from getPins and localStorage accent keys', async () => {
      vi.mocked(getPins)
        .mockResolvedValueOnce(['pl1', 'pl2'])
        .mockResolvedValueOnce(['al1']);
      localStorageStore['vorbis-player-accent-color-overrides'] = JSON.stringify({ '/path/album': '#ff0000' });
      localStorageStore['vorbis-player-custom-accent-colors'] = JSON.stringify({ '/path/album': '#00ff00' });

      const result = await buildPreferencesFromLocal();

      expect(result.pins).toEqual({ playlists: ['pl1', 'pl2'], albums: ['al1'] });
      expect(result.accent.overrides).toEqual({ '/path/album': '#ff0000' });
      expect(result.accent.customColors).toEqual({ '/path/album': '#00ff00' });
    });

    it('handles missing or invalid localStorage gracefully', async () => {
      vi.mocked(getPins).mockResolvedValue([]);
      localStorageStore['vorbis-player-accent-color-overrides'] = 'not-json';

      const result = await buildPreferencesFromLocal();

      expect(result.accent.overrides).toEqual({});
      expect(result.accent.customColors).toEqual({});
    });
  });

  describe('applyRemoteToLocal', () => {
    it('writes pins and accent to storage', async () => {
      const remote = makeRemote({
        pins: { playlists: ['p1'], albums: ['a1'] },
        accent: { overrides: { id1: '#red' }, customColors: { id1: '#blue' } },
      });

      await applyRemoteToLocal(remote);

      expect(setPins).toHaveBeenCalledWith('_unified', 'playlists', ['p1']);
      expect(setPins).toHaveBeenCalledWith('_unified', 'albums', ['a1']);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'vorbis-player-accent-color-overrides',
        JSON.stringify({ id1: '#red' }),
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'vorbis-player-custom-accent-colors',
        JSON.stringify({ id1: '#blue' }),
      );
    });
  });

  describe('downloadPreferencesFile', () => {
    it('returns null when not authenticated', async () => {
      mockAuth.ensureValidToken.mockResolvedValue(null);
      const result = await service.downloadPreferencesFile();
      expect(result).toBeNull();
    });

    it('returns null on 409 (file not found)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 409, ok: false }));
      const result = await service.downloadPreferencesFile();
      expect(result).toBeNull();
    });

    it('parses remote file on success', async () => {
      const remoteData = makeRemote({ pins: { playlists: ['x'], albums: [] } });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve(remoteData),
      }));
      const result = await service.downloadPreferencesFile();
      expect(result).toEqual(remoteData);
    });

    it('retries with refreshed token on 401', async () => {
      const remoteData = makeRemote();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ status: 401, ok: false })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve(remoteData),
        });
      vi.stubGlobal('fetch', fetchMock);

      const result = await service.downloadPreferencesFile();
      expect(result).toEqual(remoteData);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(mockAuth.refreshAccessToken).toHaveBeenCalled();
    });
  });

  describe('uploadPreferencesFile', () => {
    it('returns false when not authenticated', async () => {
      mockAuth.ensureValidToken.mockResolvedValue(null);
      const result = await service.uploadPreferencesFile(makeRemote());
      expect(result).toBe(false);
    });

    it('returns true on successful upload', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true }));
      const result = await service.uploadPreferencesFile(makeRemote());
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('calls ensureVorbisFolder before upload', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true }));

      const result = await service.uploadPreferencesFile(makeRemote());
      expect(result).toBe(true);
      expect(ensureVorbisFolder).toHaveBeenCalled();
    });

    it('returns false when folder creation fails', async () => {
      vi.mocked(ensureVorbisFolder).mockResolvedValueOnce(false);

      const result = await service.uploadPreferencesFile(makeRemote());
      expect(result).toBe(false);
    });
  });

  describe('initialSync', () => {
    it('applies remote when remote is newer then pushes when local was winner', async () => {
      const remote = makeRemote({
        updatedAt: '2025-03-17T14:00:00.000Z',
        pins: { playlists: ['r1'], albums: [] },
      });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve(remote),
      }));

      await service.initialSync();

      expect(setPins).toHaveBeenCalledWith('_unified', 'playlists', ['r1']);
      expect(setPins).toHaveBeenCalledWith('_unified', 'albums', []);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'vorbis-player-preferences-sync-updatedAt',
        remote.updatedAt,
      );
    });

    it('pushes when no remote file (local wins)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ status: 409, ok: false }) // download → not_found
        .mockResolvedValueOnce({ status: 200, ok: true }); // upload
      vi.stubGlobal('fetch', fetchMock);

      await service.initialSync();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('handles download failure gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      await expect(service.initialSync()).resolves.not.toThrow();
    });
  });

  describe('schedulePush', () => {
    it('debounces push calls', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true });
      vi.stubGlobal('fetch', fetchMock);

      service.schedulePush();
      service.schedulePush();
      service.schedulePush();

      expect(fetchMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2500);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
