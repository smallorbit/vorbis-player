/**
 * Composition root for real providers: importing this module registers every
 * available provider with the global registry. The mock provider, if active,
 * is loaded synchronously in main.tsx before render.
 *
 * This is the only neutral module that may import provider packages.
 */

import './spotify/spotifyProvider';
import './dropbox/dropboxProvider'; // conditionally registers if VITE_DROPBOX_CLIENT_ID is set
