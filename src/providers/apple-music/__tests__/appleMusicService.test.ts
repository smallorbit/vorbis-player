import { describe, it, expect, vi } from 'vitest';
import { appleMusicService } from '../appleMusicService';

vi.stubEnv('VITE_APPLE_MUSIC_DEVELOPER_TOKEN', 'test-developer-token');

describe('AppleMusicService', () => {
  it('persistToken calls localStorage.setItem with correct key', () => {
    appleMusicService.persistToken('test-token-123');
    expect(localStorage.setItem).toHaveBeenCalledWith('vorbis-player-apple-music-token', 'test-token-123');
  });

  it('clearToken calls localStorage.removeItem with correct key', () => {
    appleMusicService.clearToken();
    expect(localStorage.removeItem).toHaveBeenCalledWith('vorbis-player-apple-music-token');
  });

  it('isAuthorized checks localStorage when no instance is loaded', () => {
    appleMusicService.isAuthorized();
    expect(localStorage.getItem).toHaveBeenCalledWith('vorbis-player-apple-music-token');
  });

  it('exposes the expected public API', () => {
    expect(typeof appleMusicService.ensureLoaded).toBe('function');
    expect(typeof appleMusicService.getInstance).toBe('function');
    expect(typeof appleMusicService.isAuthorized).toBe('function');
    expect(typeof appleMusicService.persistToken).toBe('function');
    expect(typeof appleMusicService.clearToken).toBe('function');
  });
});
