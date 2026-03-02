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
    store['vorbis-player-dropbox-token'] = 'test-token';
    auth = new DropboxAuthAdapter();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('getAccessToken returns null when not authenticated', async () => {
    expect(await auth.getAccessToken()).toBeNull();
  });

  it('getAccessToken returns token when authenticated', async () => {
    store['vorbis-player-dropbox-token'] = 'my-token';
    auth = new DropboxAuthAdapter();
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
    store['vorbis-player-dropbox-token'] = 'test';
    store['vorbis-player-dropbox-refresh-token'] = 'refresh';
    auth = new DropboxAuthAdapter();
    expect(auth.isAuthenticated()).toBe(true);

    auth.logout();
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
    await playback.playTrack({
      id: 'test-id',
      provider: 'dropbox',
      playbackRef: { provider: 'dropbox', ref: '/music/song.mp3' },
      name: 'Test Song',
      artists: 'Test Artist',
      album: 'Test Album',
      durationMs: 0,
    });

    expect(catalog.getTemporaryLink).toHaveBeenCalledWith('/music/song.mp3');
    expect(mockAudio.src).toBe('https://dl.dropbox.com/temp/song.mp3');
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('pause calls audio.pause', async () => {
    await playback.initialize();
    await playback.pause();
    expect(mockAudio.pause).toHaveBeenCalled();
  });

  it('setVolume clamps to [0, 1]', async () => {
    await playback.initialize();

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
    await playback.initialize();
    const listener = vi.fn();
    const unsub = playback.subscribe(listener);
    expect(typeof unsub).toBe('function');
    unsub();
  });
});
