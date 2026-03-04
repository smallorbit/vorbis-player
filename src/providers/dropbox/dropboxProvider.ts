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
      hasExternalLink: false,
    },
    auth,
    catalog,
    playback,
  };

  providerRegistry.register(dropboxDescriptor);
}

export { dropboxDescriptor };
