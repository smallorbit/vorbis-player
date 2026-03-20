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

/** Prefix used when encoding a saved Dropbox playlist path as a playlist selection ID */
export const SAVED_PLAYLIST_PREFIX = 'dbplaylist:';

/** Check whether a playlist selection ID represents a saved Dropbox playlist */
export function isSavedPlaylistId(playlistId: string): boolean {
  return playlistId.startsWith(SAVED_PLAYLIST_PREFIX);
}

/** Extract the playlist file path from a saved playlist selection ID */
export function extractPlaylistPath(playlistId: string): string {
  return playlistId.slice(SAVED_PLAYLIST_PREFIX.length);
}

/** Create a saved playlist selection ID from a Dropbox file path */
export function toSavedPlaylistId(path: string): string {
  return `${SAVED_PLAYLIST_PREFIX}${path}`;
}

/** Resolve a playlist selection ID to a collection ID and kind for catalog lookup. */
export function resolvePlaylistRef(
  playlistId: string,
  providerId: string,
): { id: string; kind: 'liked' | 'album' | 'playlist' | 'folder' } {
  if (playlistId === LIKED_SONGS_ID) return { id: '', kind: 'liked' };
  if (isAlbumId(playlistId)) return { id: extractAlbumId(playlistId), kind: 'album' };
  if (isSavedPlaylistId(playlistId)) return { id: extractPlaylistPath(playlistId), kind: 'playlist' };
  return { id: playlistId, kind: providerId === 'dropbox' ? 'folder' : 'playlist' };
}
