/**
 * Dropbox provider barrel export.
 * Importing this module conditionally registers the Dropbox descriptor
 * if VITE_DROPBOX_CLIENT_ID is set.
 */

export { dropboxDescriptor } from './dropboxProvider';
export { DropboxAuthAdapter } from './dropboxAuthAdapter';
export { DropboxCatalogAdapter } from './dropboxCatalogAdapter';
export { DropboxPlaybackAdapter } from './dropboxPlaybackAdapter';
