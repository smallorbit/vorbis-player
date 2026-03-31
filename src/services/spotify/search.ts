import type { Track, SpotifyTrackItem, PaginatedResponse } from './types';
import { spotifyApiRequest } from './api';
import { spotifyAuth } from './auth';
import { transformTrackItem } from './tracks';

// =============================================================================
// Search Functions
// =============================================================================

/**
 * Search for a track on Spotify by artist and track name.
 * Returns the first valid match, or null if none found.
 */
export async function searchTrack(
  artist: string,
  trackName: string,
): Promise<Track | null> {
  const token = await spotifyAuth.ensureValidToken();
  const query = encodeURIComponent(`track:${trackName} artist:${artist}`);
  const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`;

  const data = await spotifyApiRequest<{ tracks: PaginatedResponse<SpotifyTrackItem> }>(url, token);

  if (!data.tracks?.items?.length) return null;

  for (const item of data.tracks.items) {
    const track = transformTrackItem(item);
    if (track) return track;
  }

  return null;
}
