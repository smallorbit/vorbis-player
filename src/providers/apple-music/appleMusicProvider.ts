/**
 * Apple Music provider descriptor: assembles auth, catalog, and playback adapters
 * into a single ProviderDescriptor and registers it with the global registry.
 */

import type { ProviderDescriptor } from '@/types/providers';
import { AppleMusicAuthAdapter } from './appleMusicAuthAdapter';
import { AppleMusicCatalogAdapter } from './appleMusicCatalogAdapter';
import { AppleMusicPlaybackAdapter } from './appleMusicPlaybackAdapter';
import { providerRegistry } from '@/providers/registry';

const appleMusicDescriptor: ProviderDescriptor = {
  id: 'apple-music',
  name: 'Apple Music',
  capabilities: {
    hasLikedCollection: true,
    hasSaveTrack: true,
    hasExternalLink: true,
    externalLinkLabel: 'Open in Apple Music',
  },
  auth: new AppleMusicAuthAdapter(),
  catalog: new AppleMusicCatalogAdapter(),
  playback: new AppleMusicPlaybackAdapter(),
};

// Self-register on import (always registered, like Spotify)
providerRegistry.register(appleMusicDescriptor);

export { appleMusicDescriptor };
