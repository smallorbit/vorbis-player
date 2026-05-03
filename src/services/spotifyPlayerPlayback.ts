import { spotifyAuth } from './spotify';
import { SPOTIFY_TRANSFER_RETRY_COUNT } from '@/constants/spotify';
import { logSpotify } from '@/lib/debugLog';
import { TRANSFER_RETRY_DELAY_MS } from '@/constants/timing';

async function parsePlayError(response: Response): Promise<string> {
  const errorText = await response.text();
  let reason = '';
  try {
    const json = JSON.parse(errorText);
    if (json.error?.message) reason = ` - ${json.error.message}`;
    if (json.error?.reason) reason += ` (${json.error.reason})`;
  } catch {
    reason = errorText ? ` - ${errorText}` : '';
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) reason += ` Retry-After: ${retryAfter}`;
  }
  return `Spotify API error: ${response.status}${reason}`;
}

/**
 * Force Spotify shuffle off so the queue we hand the SDK plays in our order.
 * If the user has shuffle on at the account level (set in another client),
 * Spotify shuffles our `uris` list and plays a random track first; the SDK
 * then auto-advances through the rest in shuffled order, breaking UI/audio
 * sync because our subscription expects the linear order.
 *
 * Shuffle state is account-level and persists across tracks; one PUT per
 * page session is enough to guarantee it stays off for the lifetime of our
 * playback session. The call is still best-effort (errors are swallowed)
 * because a 403 here usually means the user is on Spotify Free and the
 * subsequent play call will fail next with a clearer error.
 */
let shuffleOffFired = false;

async function apiSetShuffleOff(deviceId: string): Promise<void> {
  if (shuffleOffFired) return;
  shuffleOffFired = true;
  try {
    const token = await spotifyAuth.ensureValidToken();
    await fetch(
      `https://api.spotify.com/v1/me/player/shuffle?state=false&device_id=${deviceId}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  } catch (err) {
    shuffleOffFired = false;
    logSpotify('apiSetShuffleOff failed: %o', err);
  }
}

export async function apiPlayTrack(
  deviceId: string,
  uri: string,
  upcomingUris?: string[],
  positionMs?: number,
): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();
  const uris = upcomingUris?.length ? [uri, ...upcomingUris] : [uri];

  logSpotify('Web API play track deviceId=%s queueSize=%d positionMs=%s', deviceId, uris.length, positionMs ?? 0);

  await apiSetShuffleOff(deviceId);

  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ uris, position_ms: positionMs ?? 0 }),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  logSpotify('Web API play track response status=%d ok=%s', response.status, response.ok);

  if (!response.ok) {
    throw new Error(await parsePlayError(response));
  }
}

export async function apiPlayContext(
  deviceId: string,
  contextUri: string,
  offsetPosition?: number,
): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();

  const body: Record<string, unknown> = { context_uri: contextUri, position_ms: 0 };
  if (offsetPosition !== undefined) {
    body.offset = { position: offsetPosition };
  }

  logSpotify('Web API play context uri=%s offset=%s', contextUri, offsetPosition ?? '(none)');

  await apiSetShuffleOff(deviceId);

  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    throw new Error(await parsePlayError(response));
  }
}

export async function apiPlayPlaylist(
  deviceId: string,
  uris: string[],
): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();

  logSpotify('Web API play URIs list length=%d deviceId=%s', uris.length, deviceId);

  await apiSetShuffleOff(deviceId);

  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ uris, position_ms: 0 }),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  logSpotify('Web API play URIs response status=%d ok=%s', response.status, response.ok);

  if (!response.ok) {
    throw new Error(await parsePlayError(response));
  }
}

export async function apiSetVolume(
  deviceId: string,
  volumePercent: number,
): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)));
  const token = await spotifyAuth.ensureValidToken();
  const url = `https://api.spotify.com/v1/me/player/volume?device_id=${deviceId}&volume_percent=${clamped}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok && response.status !== 204) {
    console.warn('[spotifyPlayer] Web API setVolume failed:', response.status);
  }
}

export async function apiTransferPlayback(
  deviceId: string,
  token: string,
): Promise<boolean> {
  const body = JSON.stringify({ device_ids: [deviceId], play: false });
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  for (let attempt = 0; attempt < SPOTIFY_TRANSFER_RETRY_COUNT; attempt++) {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers,
        body,
      });

      if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        console.warn('[spotifyPlayer] Transfer playback response:', response.status, errorText);
      } else {
        logSpotify('transferred playback to device');
        return true;
      }
      return false;
    } catch (error) {
      if (attempt === 0) {
        console.warn('[spotifyPlayer] Transfer playback network error, retrying:', error);
        await new Promise(resolve => setTimeout(resolve, TRANSFER_RETRY_DELAY_MS));
      } else {
        console.error('[spotifyPlayer] Failed to transfer playback to device:', error);
        throw error;
      }
    }
  }
  return false;
}

export async function apiEnsureDeviceActive(
  deviceId: string,
  token: string,
  maxRetries: number,
  initialDelayMs: number,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 200) {
        const data = await response.json();
        if (data.device?.id === deviceId && data.device?.is_active) {
          logSpotify('device is active and ready');
          return true;
        }
      } else if (response.status === 204) {
        logSpotify('no active device yet, attempt %d/%d', i + 1, maxRetries);
      }

      if (i < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.warn(`[spotifyPlayer] Error checking device status (attempt ${i + 1}):`, error);
      if (i < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.warn('[spotifyPlayer] Device not confirmed active after polling, proceeding anyway');
  return false;
}
