/**
 * SpotifyResolver — resolves unmatched Last.fm suggestions to Spotify MediaTracks.
 *
 * Takes UnmatchedSuggestion[] from the radio service and searches Spotify's catalog
 * to create playable MediaTrack objects. Enables cross-provider radio playlists.
 */

import type { MediaTrack } from '@/types/domain';
import type { UnmatchedSuggestion } from '@/types/radio';
import { searchTrack } from './spotify';
import type { Track } from './spotify';

const MAX_CONCURRENT_SEARCHES = 3;
const MAX_RESOLVED_TRACKS = 50;

/** Convert a Spotify Track (UI type) to a MediaTrack (domain type). */
function spotifyTrackToMediaTrack(track: Track): MediaTrack {
  return {
    id: track.id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: track.uri },
    name: track.name,
    artists: track.artists,
    artistsData: track.artistsData?.map((a) => ({ name: a.name, url: a.url })),
    album: track.album,
    albumId: track.album_id,
    trackNumber: track.track_number,
    durationMs: track.duration_ms,
    image: track.image,
  };
}

/**
 * Resolve unmatched Last.fm suggestions by searching Spotify.
 * Returns MediaTrack[] with provider='spotify' for each resolved track.
 */
export async function resolveViaSpotify(
  suggestions: UnmatchedSuggestion[],
): Promise<MediaTrack[]> {
  const resolved: MediaTrack[] = [];
  const seenIds = new Set<string>();

  // Limit input to avoid excessive API calls
  const toResolve = suggestions.slice(0, MAX_RESOLVED_TRACKS);

  // Process in chunks to respect rate limits
  const chunks = chunkArray(toResolve, MAX_CONCURRENT_SEARCHES);
  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map(async (suggestion) => {
        try {
          return await searchTrack(suggestion.artist, suggestion.name);
        } catch {
          return null;
        }
      }),
    );

    for (const track of results) {
      if (track && !seenIds.has(track.id)) {
        seenIds.add(track.id);
        resolved.push(spotifyTrackToMediaTrack(track));
      }
    }
  }

  return resolved;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
