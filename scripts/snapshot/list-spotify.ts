import type { SpotifyApiClient } from './spotify-api.ts';

/**
 * Enumerates the user's Spotify library and prints a structured summary to stdout.
 * Read-only: no JSON is written, no art is downloaded.
 *
 * Stdout format:
 *   PLAYLISTS
 *   - <id>  <name>  (<N> tracks, <M> followers)
 *   ALBUMS (saved)
 *   - <id>  <name> — <artists>  (<N> tracks)
 *   RECENTLY PLAYED
 *   - track:<id>  <name> — <artists>
 *   LIKED-TRACKS COUNT: <N>
 */
export async function runListSpotify(client: SpotifyApiClient): Promise<void> {
  const [playlists, savedAlbums, recentlyPlayed, likedCount] = await Promise.all([
    client.listMyPlaylists(),
    client.listMySavedAlbums(),
    client.getRecentlyPlayed(20),
    client.getLikedTracksCount(),
  ]);

  const sortedPlaylists = [...playlists].sort((a, b) => a.name.localeCompare(b.name));
  const sortedAlbums = [...savedAlbums].sort((a, b) =>
    a.album.name.localeCompare(b.album.name),
  );

  console.log('PLAYLISTS');
  for (const pl of sortedPlaylists) {
    const followers = pl.followers ? `, ${pl.followers.total} followers` : '';
    console.log(`- ${pl.id}\t${pl.name}\t(${pl.tracks.total} tracks${followers})`);
  }

  console.log('\nALBUMS (saved)');
  for (const entry of sortedAlbums) {
    const { album } = entry;
    const artists = album.artists.map((a) => a.name).join(', ');
    console.log(`- ${album.id}\t${album.name} — ${artists}\t(${album.total_tracks} tracks)`);
  }

  console.log('\nRECENTLY PLAYED');
  for (const item of recentlyPlayed) {
    const artists = item.track.artists.map((a) => a.name).join(', ');
    console.log(`- track:${item.track.id}\t${item.track.name} — ${artists}`);
  }

  console.log(`\nLIKED-TRACKS COUNT: ${likedCount}`);
}
