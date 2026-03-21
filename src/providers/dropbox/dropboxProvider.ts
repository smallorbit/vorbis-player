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
import { initLikesSync } from './dropboxLikesSync';
import { initPreferencesSync, getPreferencesSync } from './dropboxPreferencesSync';

const DROPBOX_CLIENT_ID = import.meta.env.VITE_DROPBOX_CLIENT_ID ?? '';

let dropboxDescriptor: ProviderDescriptor | null = null;

if (DROPBOX_CLIENT_ID) {
  const auth = new DropboxAuthAdapter();
  const catalog = new DropboxCatalogAdapter(auth);
  const playback = new DropboxPlaybackAdapter(catalog);

  initLikesSync(auth);
  initPreferencesSync(auth);

  // Trigger initial sync if already authenticated (returning user)
  if (auth.isAuthenticated()) {
    catalog.initializeSync().catch((err) => {
      console.warn('[DropboxProvider] Initial likes sync failed:', err);
    });
    getPreferencesSync()?.initialSync().catch((err) => {
      console.warn('[DropboxProvider] Initial preferences sync failed:', err);
    });
  }

  dropboxDescriptor = {
    id: 'dropbox',
    name: 'Dropbox',
    capabilities: {
      hasLikedCollection: true,
      hasSaveTrack: true,
      hasDeleteCollection: true,
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

