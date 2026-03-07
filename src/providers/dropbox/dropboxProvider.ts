/**
 * Dropbox provider descriptor: assembles auth, catalog, and playback adapters
 * into a single ProviderDescriptor and registers with the global registry.
 *
 * Only registered when VITE_DROPBOX_CLIENT_ID is configured.
 */

import type { ProviderDescriptor } from '@/types/providers';
import { DropboxAuthAdapter } from './dropboxAuthAdapter';
import { DropboxCatalogAdapter } from './dropboxCatalogAdapter';
import { DropboxPlaybackAdapter } from './dropboxPlaybackAdapter';
import { providerRegistry } from '@/providers/registry';

const DROPBOX_CLIENT_ID = import.meta.env.VITE_DROPBOX_CLIENT_ID ?? '';

let dropboxDescriptor: ProviderDescriptor | null = null;

if (DROPBOX_CLIENT_ID) {
  const auth = new DropboxAuthAdapter();
  const catalog = new DropboxCatalogAdapter(auth);
  const playback = new DropboxPlaybackAdapter(catalog);

  dropboxDescriptor = {
    id: 'dropbox',
    name: 'Dropbox',
    capabilities: {
      hasLikedCollection: true,
      hasSaveTrack: true,
      hasExternalLink: true,
      externalLinkLabel: 'Search Discogs',
    },
    auth,
    catalog,
    playback,
    getExternalUrls({ type, name, artistName }) {
      const isArtist = type === 'artist';
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
  };

  providerRegistry.register(dropboxDescriptor);
}

