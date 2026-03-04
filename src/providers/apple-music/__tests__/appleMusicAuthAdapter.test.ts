import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppleMusicAuthAdapter } from '../appleMusicAuthAdapter';
import { appleMusicService } from '../appleMusicService';

vi.mock('../appleMusicService', () => ({
  appleMusicService: {
    ensureLoaded: vi.fn(),
    getInstance: vi.fn(),
    isAuthorized: vi.fn(),
    persistToken: vi.fn(),
    clearToken: vi.fn(),
  },
}));

describe('AppleMusicAuthAdapter', () => {
  let adapter: AppleMusicAuthAdapter;
  const mockInstance = {
    authorize: vi.fn().mockResolvedValue('user-token-abc'),
    unauthorize: vi.fn(),
    musicUserToken: 'existing-token',
    isAuthorized: true,
  };

  beforeEach(() => {
    adapter = new AppleMusicAuthAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has providerId "apple-music"', () => {
    expect(adapter.providerId).toBe('apple-music');
  });

  it('isAuthenticated delegates to appleMusicService', () => {
    vi.mocked(appleMusicService.isAuthorized).mockReturnValue(true);
    expect(adapter.isAuthenticated()).toBe(true);

    vi.mocked(appleMusicService.isAuthorized).mockReturnValue(false);
    expect(adapter.isAuthenticated()).toBe(false);
  });

  it('getAccessToken returns musicUserToken from instance', async () => {
    vi.mocked(appleMusicService.getInstance).mockReturnValue(mockInstance as never);
    const token = await adapter.getAccessToken();
    expect(token).toBe('existing-token');
  });

  it('getAccessToken returns null when no instance', async () => {
    vi.mocked(appleMusicService.getInstance).mockReturnValue(null);
    const token = await adapter.getAccessToken();
    expect(token).toBeNull();
  });

  it('beginLogin calls authorize and persists token', async () => {
    mockInstance.authorize.mockResolvedValue('user-token-abc');
    vi.mocked(appleMusicService.ensureLoaded).mockResolvedValue(mockInstance as never);
    await adapter.beginLogin();
    expect(mockInstance.authorize).toHaveBeenCalled();
    expect(appleMusicService.persistToken).toHaveBeenCalledWith('user-token-abc');
  });

  it('handleCallback always returns false (popup auth)', async () => {
    const result = await adapter.handleCallback(new URL('https://example.com/callback'));
    expect(result).toBe(false);
  });

  it('logout calls unauthorize and clears token', () => {
    vi.mocked(appleMusicService.getInstance).mockReturnValue(mockInstance as never);
    adapter.logout();
    expect(mockInstance.unauthorize).toHaveBeenCalled();
    expect(appleMusicService.clearToken).toHaveBeenCalled();
  });

  it('logout handles missing instance gracefully', () => {
    vi.mocked(appleMusicService.getInstance).mockReturnValue(null);
    expect(() => adapter.logout()).not.toThrow();
    expect(appleMusicService.clearToken).toHaveBeenCalled();
  });
});
