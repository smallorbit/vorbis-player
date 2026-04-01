import { spotifyApiRequest } from './api';
import { spotifyAuth } from './auth';

// =============================================================================
// Playlist Creation and Management
// =============================================================================

interface SpotifyUserProfile {
  id: string;
  display_name?: string;
}

interface SpotifyPlaylistResponse {
  id: string;
  uri: string;
  external_urls: { spotify: string };
}

/** Get the current user's Spotify ID. */
export async function getCurrentUserId(): Promise<string> {
  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<SpotifyUserProfile>(
    'https://api.spotify.com/v1/me',
    token,
  );
  return data.id;
}

/** Create a new playlist on the current user's Spotify account. */
export async function createPlaylist(
  name: string,
  options?: { description?: string; isPublic?: boolean },
): Promise<{ id: string; uri: string; url: string }> {
  const token = await spotifyAuth.ensureValidToken();
  const userId = await getCurrentUserId();

  const data = await spotifyApiRequest<SpotifyPlaylistResponse>(
    `https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        public: options?.isPublic ?? false,
        description: options?.description ?? '',
      }),
    },
  );

  return { id: data.id, uri: data.uri, url: data.external_urls.spotify };
}

/** Unfollow (remove) a playlist from the current user's library. */
export async function unfollowPlaylist(playlistId: string): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();
  await spotifyApiRequest<void>(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/followers`,
    token,
    { method: 'DELETE' },
  );
}

/** Add tracks to a Spotify playlist by URI. Handles batching (max 100 per request). */
export async function addTracksToPlaylist(
  playlistId: string,
  uris: string[],
): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();
  const BATCH_SIZE = 100;

  for (let i = 0; i < uris.length; i += BATCH_SIZE) {
    const batch = uris.slice(i, i + BATCH_SIZE);
    await spotifyApiRequest<{ snapshot_id: string }>(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: batch }),
      },
    );
  }
}
