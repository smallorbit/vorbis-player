import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('dropboxProvider conditional registration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function importProviderWithMocks() {
    vi.doMock('@/providers/dropbox/dropboxAuthAdapter', () => ({
      DropboxAuthAdapter: vi.fn().mockImplementation(() => ({
        isAuthenticated: vi.fn().mockReturnValue(false),
      })),
    }));
    vi.doMock('@/providers/dropbox/dropboxCatalogAdapter', () => ({
      DropboxCatalogAdapter: vi.fn().mockImplementation(() => ({})),
    }));
    vi.doMock('@/providers/dropbox/dropboxPlaybackAdapter', () => ({
      DropboxPlaybackAdapter: vi.fn().mockImplementation(() => ({})),
    }));
    vi.doMock('@/providers/dropbox/dropboxLikesSync', () => ({
      initLikesSync: vi.fn(),
    }));
    vi.doMock('@/providers/dropbox/dropboxPreferencesSync', () => ({
      initPreferencesSync: vi.fn(),
      getPreferencesSync: vi.fn().mockReturnValue(null),
    }));
    vi.doMock('@/providers/dropbox/dropboxPlaylistStorage', () => ({
      saveQueueAsPlaylist: vi.fn(),
    }));
    vi.doMock('@/providers/dropbox/DropboxIcon', () => ({
      DropboxIcon: vi.fn(),
    }));
    vi.doMock('@/providers/dropbox/dropboxLikesCache', () => ({
      LIKES_CHANGED_EVENT: 'dropbox-likes-changed',
    }));

    await import('@/providers/dropbox/dropboxProvider');
    const { providerRegistry } = await import('@/providers/registry');
    return providerRegistry;
  }

  it('does not register dropbox when VITE_DROPBOX_CLIENT_ID is empty', async () => {
    // #given
    vi.stubEnv('VITE_DROPBOX_CLIENT_ID', '');

    // #when
    const registry = await importProviderWithMocks();

    // #then
    expect(registry.has('dropbox')).toBe(false);
  });

  it('registers dropbox when VITE_DROPBOX_CLIENT_ID is set', async () => {
    // #given
    vi.stubEnv('VITE_DROPBOX_CLIENT_ID', 'test-client-id');

    // #when
    const registry = await importProviderWithMocks();

    // #then
    expect(registry.has('dropbox')).toBe(true);
  });
});
