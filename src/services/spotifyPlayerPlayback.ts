import { spotifyAuth } from './spotify';
import { logSpotify } from '@/lib/debugLog';

export async function apiPlayTrack(
  deviceId: string,
  uri: string,
  upcomingUris?: string[],
): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();
  const uris = upcomingUris?.length ? [uri, ...upcomingUris] : [uri];

  logSpotify('Web API play track deviceId=%s queueSize=%d', deviceId, uris.length);

  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ uris, position_ms: 0 }),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  logSpotify('Web API play track response status=%d ok=%s', response.status, response.ok);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[spotifyPlayer] Spotify API error response:', errorText);

    let errorReason = '';
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error?.reason) {
        errorReason = ` (${errorJson.error.reason})`;
      }
      if (errorJson.error?.message) {
        errorReason = ` - ${errorJson.error.message}${errorReason}`;
      }
    } catch {
      errorReason = errorText ? ` - ${errorText}` : '';
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) {
        errorReason += ` Retry-After: ${retryAfter}`;
      }
    }

    throw new Error(`Spotify API error: ${response.status}${errorReason}`);
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

  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[spotifyPlayer] Context playback error:', errorText);

    let errorReason = '';
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error?.message) {
        errorReason = ` - ${errorJson.error.message}`;
      }
    } catch {
      errorReason = errorText ? ` - ${errorText}` : '';
    }

    throw new Error(`Spotify API error: ${response.status}${errorReason}`);
  }
}

export async function apiPlayPlaylist(
  deviceId: string,
  uris: string[],
): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();

  logSpotify('Web API play URIs list length=%d deviceId=%s', uris.length, deviceId);

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
    const errorText = await response.text();
    console.error('[spotifyPlayer] Spotify API error response:', errorText);
    throw new Error(`Spotify API error: ${response.status} ${response.statusText} - ${errorText}`);
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

  for (let attempt = 0; attempt < 2; attempt++) {
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
        await new Promise(resolve => setTimeout(resolve, 500));
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
