/**
 * Spotify provider barrel export.
 * Importing this module registers the Spotify descriptor in the global registry.
 */

export { spotifyDescriptor } from './spotifyProvider';
export { SpotifyAuthAdapter } from './spotifyAuthAdapter';
export { SpotifyCatalogAdapter } from './spotifyCatalogAdapter';
export { SpotifyPlaybackAdapter } from './spotifyPlaybackAdapter';
export {
  spotifyTrackToMediaTrack,
  mediaTrackToSpotifyTrack,
  spotifyPlaylistToMediaCollection,
  spotifyAlbumToMediaCollection,
} from './spotifyCatalogAdapter';
