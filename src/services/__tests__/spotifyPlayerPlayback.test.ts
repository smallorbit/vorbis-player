import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defined } from '@/test/defined';
import { TRANSFER_RETRY_DELAY_MS } from '@/constants/timing';
import { SPOTIFY_INITIAL_RETRY_DELAY_MS } from '@/constants/spotify';

const ensureValidToken = vi.fn().mockResolvedValue('test-token');

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    ensureValidToken: (...args: unknown[]) => ensureValidToken(...args),
  },
}));

function emptyResponse(status: number, init: ResponseInit = {}): Response {
  return new Response(null, { status, statusText: status === 204 ? 'No Content' : 'Error', ...init });
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

async function loadPlaybackModule() {
  vi.resetModules();
  ensureValidToken.mockResolvedValue('test-token');
  return await import('@/services/spotifyPlayerPlayback');
}

describe('spotifyPlayerPlayback — Web API boundary', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    ensureValidToken.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('apiPlayTrack disables shuffle once then plays with queue and position', async () => {
    // #given
    const mod = await loadPlaybackModule();
    fetchMock
      .mockResolvedValueOnce(emptyResponse(204))
      .mockResolvedValueOnce(emptyResponse(204));

    // #when
    await mod.apiPlayTrack('device-1', 'spotify:track:a', ['spotify:track:b'], 1_500);

    // #then
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const shuffleUrl = String(defined(fetchMock.mock.calls[0])[0]);
    expect(shuffleUrl).toContain('/me/player/shuffle?state=false');
    expect(shuffleUrl).toContain('device_id=device-1');

    const playInit = defined(defined(fetchMock.mock.calls[1])[1]);
    expect(playInit.method).toBe('PUT');
    expect(JSON.parse(String(playInit.body))).toEqual({
      uris: ['spotify:track:a', 'spotify:track:b'],
      position_ms: 1_500,
    });
  });

  it('apiPlayTrack skips duplicate shuffle PUTs in the same module session', async () => {
    // #given
    const mod = await loadPlaybackModule();
    fetchMock.mockResolvedValue(emptyResponse(204));

    // #when
    await mod.apiPlayTrack('device-1', 'spotify:track:1');
    await mod.apiPlayTrack('device-1', 'spotify:track:2');

    // #then — one shuffle + two play calls
    const shuffleCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/me/player/shuffle'),
    );
    expect(shuffleCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('apiPlayTrack throws SpotifyApiError with Retry-After on 429', async () => {
    // #given
    const mod = await loadPlaybackModule();
    fetchMock
      .mockResolvedValueOnce(emptyResponse(204))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'slow down' } }), {
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({ 'Retry-After': '12' }),
        }),
      );

    // #when / #then
    const promise = mod.apiPlayTrack('device-1', 'spotify:track:x');
    await expect(promise).rejects.toMatchObject({ status: 429, name: 'SpotifyApiError' });
    await expect(promise).rejects.toThrow('Retry-After: 12');
  });

  it('apiTransferPlayback returns true on 204 and does not retry', async () => {
    // #given
    const mod = await loadPlaybackModule();
    fetchMock.mockResolvedValueOnce(emptyResponse(204));

    // #when
    const ok = await mod.apiTransferPlayback('device-1', 'token-1');

    // #then
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(defined(defined(fetchMock.mock.calls[0])[1]).body));
    expect(body).toEqual({ device_ids: ['device-1'], play: false });
  });

  it('apiTransferPlayback retries once after a network error then succeeds', async () => {
    // #given
    vi.useFakeTimers();
    const mod = await loadPlaybackModule();
    fetchMock
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(emptyResponse(204));

    // #when
    const promise = mod.apiTransferPlayback('device-1', 'token-1');
    await vi.advanceTimersByTimeAsync(TRANSFER_RETRY_DELAY_MS);
    const ok = await promise;

    // #then
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('apiTransferPlayback rethrows when both transfer attempts fail at the network layer', async () => {
    // #given
    vi.useFakeTimers();
    const mod = await loadPlaybackModule();
    const err = new Error('offline');
    fetchMock.mockRejectedValueOnce(err).mockRejectedValueOnce(err);

    // #when
    const promise = mod.apiTransferPlayback('device-1', 'token-1');
    const rejection = expect(promise).rejects.toThrow('offline');
    await vi.advanceTimersByTimeAsync(TRANSFER_RETRY_DELAY_MS);

    // #then
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('apiEnsureDeviceActive polls with exponential backoff until the device is active', async () => {
    // #given
    vi.useFakeTimers();
    const mod = await loadPlaybackModule();
    fetchMock
      .mockResolvedValueOnce(emptyResponse(204))
      .mockResolvedValueOnce(
        jsonResponse({
          device: { id: 'device-1', is_active: true },
        }),
      );

    // #when
    const promise = mod.apiEnsureDeviceActive('device-1', 'token-1', 3, SPOTIFY_INITIAL_RETRY_DELAY_MS);
    await vi.advanceTimersByTimeAsync(SPOTIFY_INITIAL_RETRY_DELAY_MS);
    const active = await promise;

    // #then
    expect(active).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('apiEnsureDeviceActive returns false after exhausting retries', async () => {
    // #given
    vi.useFakeTimers();
    const mod = await loadPlaybackModule();
    fetchMock.mockResolvedValue(emptyResponse(204));

    // #when
    const promise = mod.apiEnsureDeviceActive('device-1', 'token-1', 2, 100);
    await vi.advanceTimersByTimeAsync(500);
    const active = await promise;

    // #then
    expect(active).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
