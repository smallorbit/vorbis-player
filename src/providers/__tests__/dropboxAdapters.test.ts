import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DropboxAuthAdapter } from '../dropbox/dropboxAuthAdapter';
import { DropboxPlaybackAdapter } from '../dropbox/dropboxPlaybackAdapter';
import { DropboxCatalogAdapter } from '../dropbox/dropboxCatalogAdapter';

// Mock import.meta.env values
vi.stubEnv('VITE_DROPBOX_CLIENT_ID', 'test-client-id');
vi.stubEnv('VITE_DROPBOX_REDIRECT_URI', 'http://127.0.0.1:3000/auth/dropbox/callback');

describe('DropboxAuthAdapter', () => {
  let auth: DropboxAuthAdapter;
  // Backing store for the mocked localStorage
  let store: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = {};
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => store[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, val: string) => { store[key] = val; });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => { delete store[key]; });
    vi.mocked(localStorage.clear).mockImplementation(() => { store = {}; });

    auth = new DropboxAuthAdapter();
  });

  it('isAuthenticated returns false when no token stored', () => {
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns true when token is in localStorage', () => {
    // #given
    store['vorbis-player-dropbox-token'] = 'test-token';
    auth = new DropboxAuthAdapter();

    // #when / #then
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('getAccessToken returns null when not authenticated', async () => {
    expect(await auth.getAccessToken()).toBeNull();
  });

  it('getAccessToken returns token when authenticated', async () => {
    // #given
    store['vorbis-player-dropbox-token'] = 'my-token';
    auth = new DropboxAuthAdapter();

    // #when / #then
    expect(await auth.getAccessToken()).toBe('my-token');
  });

  it('handleCallback returns false for non-dropbox paths', async () => {
    const url = new URL('http://localhost:3000/auth/spotify/callback?code=abc');
    expect(await auth.handleCallback(url)).toBe(false);
  });

  it('handleCallback throws on error parameter', async () => {
    const url = new URL('http://localhost:3000/auth/dropbox/callback?error=access_denied');
    await expect(auth.handleCallback(url)).rejects.toThrow('Dropbox auth error: access_denied');
  });

  it('handleCallback returns false if no code param', async () => {
    const url = new URL('http://localhost:3000/auth/dropbox/callback');
    expect(await auth.handleCallback(url)).toBe(false);
  });

  it('logout clears stored tokens', () => {
    // #given
    store['vorbis-player-dropbox-token'] = 'test';
    store['vorbis-player-dropbox-refresh-token'] = 'refresh';
    auth = new DropboxAuthAdapter();
    expect(auth.isAuthenticated()).toBe(true);

    // #when
    auth.logout();

    // #then
    expect(auth.isAuthenticated()).toBe(false);
    expect(store['vorbis-player-dropbox-token']).toBeUndefined();
    expect(store['vorbis-player-dropbox-refresh-token']).toBeUndefined();
  });
});

describe('DropboxPlaybackAdapter', () => {
  let playback: DropboxPlaybackAdapter;
  let catalog: DropboxCatalogAdapter;
  let mockAudio: Partial<HTMLAudioElement>;
  let audioListeners: Record<string, EventListener>;

  beforeEach(() => {
    vi.clearAllMocks();
    audioListeners = {};
    mockAudio = {
      preload: '',
      src: '',
      paused: true,
      ended: false,
      currentTime: 0,
      duration: 180,
      volume: 1,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        audioListeners[event] = handler;
      }),
    };

    vi.spyOn(window, 'Audio').mockImplementation(() => mockAudio as unknown as HTMLAudioElement);

    // Stub fetch so background metadata enrichment doesn't throw in tests
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const auth = new DropboxAuthAdapter();
    catalog = new DropboxCatalogAdapter(auth);
    vi.spyOn(catalog, 'getTemporaryLink').mockResolvedValue('https://dl.dropbox.com/temp/song.mp3');

    playback = new DropboxPlaybackAdapter(catalog);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initialize creates an Audio element', async () => {
    await playback.initialize();
    expect(window.Audio).toHaveBeenCalled();
  });

  it('playTrack sets src and calls play', async () => {
    // #when
    await playback.playTrack({
      id: 'test-id',
      provider: 'dropbox',
      playbackRef: { provider: 'dropbox', ref: '/music/song.mp3' },
      name: 'Test Song',
      artists: 'Test Artist',
      album: 'Test Album',
      durationMs: 0,
    });

    // #then
    expect(catalog.getTemporaryLink).toHaveBeenCalledWith('/music/song.mp3');
    expect(mockAudio.src).toBe('https://dl.dropbox.com/temp/song.mp3');
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('pause calls audio.pause', async () => {
    // #given
    await playback.initialize();

    // #when
    await playback.pause();

    // #then
    expect(mockAudio.pause).toHaveBeenCalled();
  });

  it('setVolume clamps to [0, 1]', async () => {
    // #given
    await playback.initialize();

    // #when / #then
    await playback.setVolume(0.5);
    expect(mockAudio.volume).toBe(0.5);

    await playback.setVolume(-0.5);
    expect(mockAudio.volume).toBe(0);

    await playback.setVolume(1.5);
    expect(mockAudio.volume).toBe(1);
  });

  it('getState returns null when no track is playing', async () => {
    await playback.initialize();
    expect(await playback.getState()).toBeNull();
  });

  it('subscribe returns unsubscribe function', async () => {
    // #given
    await playback.initialize();
    const listener = vi.fn();

    // #when
    const unsub = playback.subscribe(listener);

    // #then
    expect(typeof unsub).toBe('function');
    unsub();
  });
});

describe('DropboxCatalogAdapter - listCollections', () => {
  let auth: DropboxAuthAdapter;
  let adapter: DropboxCatalogAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    auth = new DropboxAuthAdapter();
    vi.spyOn(auth, 'ensureValidToken').mockResolvedValue('test-token');
    adapter = new DropboxCatalogAdapter(auth);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('propagates network errors instead of returning []', async () => {
    // #given
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    // #when / #then
    await expect(adapter.listCollections()).rejects.toThrow('Network failure');
  });

  it('propagates API error responses instead of returning []', async () => {
    // #given
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error_summary: 'too_many_requests' }),
    }));

    // #when / #then
    await expect(adapter.listCollections()).rejects.toThrow();
  });
});

describe('DropboxCatalogAdapter - listTracks', () => {
  let auth: DropboxAuthAdapter;
  let adapter: DropboxCatalogAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    auth = new DropboxAuthAdapter();
    vi.spyOn(auth, 'ensureValidToken').mockResolvedValue('test-token');
    adapter = new DropboxCatalogAdapter(auth);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets albumId to the parent directory path on each returned track', async () => {
    // #given — a folder with two audio files, no images
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        entries: [
          {
            '.tag': 'file',
            name: '01 - Song One.mp3',
            id: 'id:001',
            path_lower: '/artist/album/01 - song one.mp3',
            path_display: '/Artist/Album/01 - Song One.mp3',
            size: 5000000,
          },
          {
            '.tag': 'file',
            name: '02 - Song Two.mp3',
            id: 'id:002',
            path_lower: '/artist/album/02 - song two.mp3',
            path_display: '/Artist/Album/02 - Song Two.mp3',
            size: 5000000,
          },
        ],
        cursor: 'cursor-1',
        has_more: false,
      }),
    }));

    // #when
    const tracks = await adapter.listTracks({ provider: 'dropbox', kind: 'album', id: '/artist/album' });

    // #then — both tracks must carry the album directory as albumId
    expect(tracks).toHaveLength(2);
    expect(tracks[0].albumId).toBe('/artist/album');
    expect(tracks[1].albumId).toBe('/artist/album');
  });

  it('assigns distinct albumIds when tracks come from different sub-directories', async () => {
    // #given — an "All Music" folder scan with two sub-albums
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        entries: [
          {
            '.tag': 'file',
            name: 'track.mp3',
            id: 'id:a1',
            path_lower: '/artist/album-a/track.mp3',
            path_display: '/Artist/Album-A/track.mp3',
            size: 5000000,
          },
          {
            '.tag': 'file',
            name: 'track.mp3',
            id: 'id:b1',
            path_lower: '/artist/album-b/track.mp3',
            path_display: '/Artist/Album-B/track.mp3',
            size: 5000000,
          },
        ],
        cursor: 'cursor-1',
        has_more: false,
      }),
    }));

    // #when
    const tracks = await adapter.listTracks({ provider: 'dropbox', kind: 'folder', id: '/artist' });

    // #then — each track carries its own album's directory as albumId
    const albumIds = tracks.map(t => t.albumId);
    expect(albumIds).toContain('/artist/album-a');
    expect(albumIds).toContain('/artist/album-b');
    expect(new Set(albumIds).size).toBe(2);
  });

  it('propagates network errors instead of returning []', async () => {
    // #given
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    // #when / #then
    await expect(
      adapter.listTracks({ provider: 'dropbox', kind: 'album', id: '/artist/album' }),
    ).rejects.toThrow('Network failure');
  });

  it('propagates API error responses instead of returning []', async () => {
    // #given
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error_summary: 'invalid_access_token' }),
    }));

    // #when / #then
    await expect(
      adapter.listTracks({ provider: 'dropbox', kind: 'album', id: '/artist/album' }),
    ).rejects.toThrow();
  });
});
