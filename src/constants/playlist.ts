/** Prefix used when encoding an album ID as a playlist selection ID */
export const ALBUM_ID_PREFIX = 'album:';

/** Special playlist ID representing the user's Liked Songs */
export const LIKED_SONGS_ID = 'liked-songs';

/** Display name for the Liked Songs collection */
export const LIKED_SONGS_NAME = 'Liked Songs';

/** Check whether a playlist selection ID represents an album */
export function isAlbumId(playlistId: string): boolean {
  return playlistId.startsWith(ALBUM_ID_PREFIX);
}

/** Extract the Spotify album ID from an album playlist selection ID */
export function extractAlbumId(playlistId: string): string {
  return playlistId.slice(ALBUM_ID_PREFIX.length);
}

/** Create an album playlist selection ID from a Spotify album ID */
export function toAlbumPlaylistId(albumId: string): string {
  return `${ALBUM_ID_PREFIX}${albumId}`;
}
