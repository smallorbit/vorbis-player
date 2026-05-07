/**
 * Spotify provider descriptor: assembles auth, catalog, and playback adapters
 * into a single ProviderDescriptor and registers it with the global registry.
 */

import type { ProviderDescriptor } from '@/types/providers';
import type { MediaTrack } from '@/types/domain';
import { SpotifyAuthAdapter } from './spotifyAuthAdapter';
import { SpotifyCatalogAdapter } from './spotifyCatalogAdapter';
import { SpotifyPlaybackAdapter } from './spotifyPlaybackAdapter';
import { SpotifyIcon } from './SpotifyIcon';
import { providerRegistry } from '@/providers/registry';
import {
  spotifyAuth,
  getCurrentUserId,
  createPlaylist,
  addTracksToPlaylist,
} from '@/services/spotify';

const spotifyDescriptor: ProviderDescriptor = {
  id: 'spotify',
  name: 'Spotify',
  color: '#1db954',
  icon: SpotifyIcon,
  subscriptionNote: 'Requires Spotify Premium.',
  capabilities: {
    hasLikedCollection: true,
    hasSaveTrack: true,
    hasSaveAlbum: true,
    hasDeleteCollection: true,
    hasExternalLink: true,
    externalLinkLabel: 'Open in Spotify',
    hasTrackSearch: true,
    hasNativeQueueSync: true,
    hasContextPlaybackFallback: true,
  },
  auth: new SpotifyAuthAdapter(),
  catalog: new SpotifyCatalogAdapter(),
  playback: new SpotifyPlaybackAdapter(),

  async savePlaylist(name: string, tracks: MediaTrack[]) {
    if (!spotifyAuth.isAuthenticated()) return null;

    const spotifyTracks = tracks.filter(t => t.provider === 'spotify');
    const skippedTracks = tracks.length - spotifyTracks.length;

    if (spotifyTracks.length === 0) return null;

    const uris = spotifyTracks.map(t => t.playbackRef.ref);
    await getCurrentUserId();
    const playlist = await createPlaylist(name, {
      description: 'Created from Vorbis Player',
    });
    await addTracksToPlaylist(playlist.id, uris);

    return {
      url: playlist.url,
      totalTracks: spotifyTracks.length,
      skippedTracks,
    };
  },
};

// Self-register on import
providerRegistry.register(spotifyDescriptor);
