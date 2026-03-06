/**
 * Spotify provider descriptor: assembles auth, catalog, and playback adapters
 * into a single ProviderDescriptor and registers it with the global registry.
 */

import type { ProviderDescriptor } from '@/types/providers';
import { SpotifyAuthAdapter } from './spotifyAuthAdapter';
import { SpotifyCatalogAdapter } from './spotifyCatalogAdapter';
import { SpotifyPlaybackAdapter } from './spotifyPlaybackAdapter';
import { providerRegistry } from '@/providers/registry';

const spotifyDescriptor: ProviderDescriptor = {
  id: 'spotify',
  name: 'Spotify',
  capabilities: {
    hasLikedCollection: true,
    hasSaveTrack: true,
    hasExternalLink: true,
    externalLinkLabel: 'Open in Spotify',
  },
  auth: new SpotifyAuthAdapter(),
  catalog: new SpotifyCatalogAdapter(),
  playback: new SpotifyPlaybackAdapter(),
};

// Self-register on import
providerRegistry.register(spotifyDescriptor);

