import type { ProviderDescriptor } from '@/types/providers';
import { SpotifyIcon } from '@/providers/spotify/SpotifyIcon';
import { DropboxIcon } from '@/providers/dropbox/DropboxIcon';
import { providerRegistry } from '@/providers/registry';
import { MockAuthAdapter } from './mockAuthAdapter';
import { MockCatalogAdapter } from './mockCatalogAdapter';
import { MockPlaybackAdapter } from './mockPlaybackAdapter';
import { seedPinsFromSnapshots } from './pinSeeder';
import { shouldUseMockProvider } from './shouldUseMockProvider';
import { installMockTestApi } from './test-control';
import { seedSessionFromUrlParam } from './sessionSeed';
import { assertProviderSnapshot, type ProviderSnapshot } from '../../../playwright/fixtures/data/snapshot.types';
import spotifySnapshotJson from '../../../playwright/fixtures/data/spotify-snapshot.json' with { type: 'json' };
import dropboxSnapshotJson from '../../../playwright/fixtures/data/dropbox-snapshot.json' with { type: 'json' };

assertProviderSnapshot(spotifySnapshotJson, 'spotify');
assertProviderSnapshot(dropboxSnapshotJson, 'dropbox');

/**
 * A constructed mock provider, exposing both its `ProviderDescriptor` (for
 * registration) and the concrete adapter instances (for the test-control API
 * and session seeding). Returning both eliminates the previous need to cast
 * `descriptor.catalog as MockCatalogAdapter` etc. at every consumption site.
 */
interface MockProviderHandles {
  descriptor: ProviderDescriptor;
  auth: MockAuthAdapter;
  catalog: MockCatalogAdapter;
  playback: MockPlaybackAdapter;
}

function createMockProvider(
  base: Omit<ProviderDescriptor, 'auth' | 'catalog' | 'playback'>,
  snapshot: ProviderSnapshot,
): MockProviderHandles {
  const auth = new MockAuthAdapter(base.id);
  const catalog = new MockCatalogAdapter(snapshot);
  const playback = new MockPlaybackAdapter(base.id);
  const descriptor: ProviderDescriptor = { ...base, auth, catalog, playback };
  return { descriptor, auth, catalog, playback };
}

const spotify = createMockProvider(
  {
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
  },
  spotifySnapshotJson,
);

const dropbox = createMockProvider(
  {
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
    getExternalUrls(info) {
      const isArtist = info.type === 'artist';
      const name = info.name;
      const artistName = info.type === 'album' ? info.artistName : '';
      const query = isArtist ? name : (artistName ? `${artistName} ${name}` : name);
      const discogsType = isArtist ? 'artist' : 'release';
      const mbType = isArtist ? 'artist' : 'release';
      return [
        {
          label: 'Discogs',
          url: `https://www.discogs.com/search/?q=${encodeURIComponent(query)}&type=${discogsType}`,
          icon: 'discogs',
        },
        {
          label: 'MusicBrainz',
          url: `https://musicbrainz.org/search?query=${encodeURIComponent(query)}&type=${mbType}`,
          icon: 'musicbrainz',
        },
      ];
    },
  },
  dropboxSnapshotJson,
);

// `main.tsx` eager-imports this module in any dev build so `?provider=mock`
// activation works without a restart. Gate the registry mutation so the real
// Spotify/Dropbox descriptors survive in dev unless the user has actually
// opted in (VITE_MOCK_PROVIDER=true or ?provider=mock).
if (shouldUseMockProvider()) {
  providerRegistry.register(spotify.descriptor);
  providerRegistry.register(dropbox.descriptor);

  void seedPinsFromSnapshots(spotifySnapshotJson.pins, dropboxSnapshotJson.pins);

  seedSessionFromUrlParam(spotify.catalog, dropbox.catalog);

  installMockTestApi({
    spotifyCatalog: spotify.catalog,
    dropboxCatalog: dropbox.catalog,
    spotifyPlayback: spotify.playback,
    dropboxPlayback: dropbox.playback,
    spotifyAuth: spotify.auth,
    dropboxAuth: dropbox.auth,
  });
}
