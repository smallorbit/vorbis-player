import type { ProviderDescriptor } from '@/types/providers';
import { SpotifyIcon } from '@/providers/spotify/SpotifyIcon';
import { DropboxIcon } from '@/providers/dropbox/DropboxIcon';
import { providerRegistry } from '@/providers/registry';
import { MockAuthAdapter } from './mockAuthAdapter';
import { MockCatalogAdapter } from './mockCatalogAdapter';
import { MockPlaybackAdapter } from './mockPlaybackAdapter';
import { seedPinsFromSnapshots } from './pinSeeder';
import { shouldUseMockProvider } from './shouldUseMockProvider';
import { assertProviderSnapshot } from '../../../playwright/fixtures/data/snapshot.types';
import spotifySnapshotJson from '../../../playwright/fixtures/data/spotify-snapshot.json' with { type: 'json' };
import dropboxSnapshotJson from '../../../playwright/fixtures/data/dropbox-snapshot.json' with { type: 'json' };

if (shouldUseMockProvider()) {
  assertProviderSnapshot(spotifySnapshotJson, 'spotify');
  assertProviderSnapshot(dropboxSnapshotJson, 'dropbox');

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
      hasNativeQueueSync: false,
    },
    auth: new MockAuthAdapter('spotify'),
    catalog: new MockCatalogAdapter('spotify', spotifySnapshotJson),
    playback: new MockPlaybackAdapter('spotify'),
  };

  const dropboxDescriptor: ProviderDescriptor = {
    id: 'dropbox',
    name: 'Dropbox',
    color: '#0061FF',
    icon: DropboxIcon,
    likesChangedEvent: 'mock-dropbox-likes-changed',
    capabilities: {
      hasLikedCollection: true,
      hasSaveTrack: true,
      hasDeleteCollection: true,
      hasExternalLink: true,
      externalLinkLabel: 'Search Discogs',
    },
    auth: new MockAuthAdapter('dropbox'),
    catalog: new MockCatalogAdapter('dropbox', dropboxSnapshotJson),
    playback: new MockPlaybackAdapter('dropbox'),
  };

  providerRegistry.register(spotifyDescriptor);
  providerRegistry.register(dropboxDescriptor);

  void seedPinsFromSnapshots(spotifySnapshotJson.pins, dropboxSnapshotJson.pins);
}
