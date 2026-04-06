import createDebug from 'debug';

/**
 * Namespaced debug loggers (TJ Holowaychuk’s `debug` — same style as Express, Mocha, etc.).
 *
 * No output until enabled in the browser devtools console:
 *   localStorage.debug = 'vorbis:*'
 * Or a subset:
 *   localStorage.debug = 'vorbis:queue,vorbis:spotify'
 *
 * Disable:
 *   localStorage.removeItem('debug'); location.reload()
 *
 * In Node (e.g. tests), set env: DEBUG=vorbis:*
 */
export const logQueue = createDebug('vorbis:queue');
export const logSpotify = createDebug('vorbis:spotify');
export const logRadio = createDebug('vorbis:radio');
export const logDropboxSync = createDebug('vorbis:dropbox-sync');
export const logApp = createDebug('vorbis:app');
export const logSw = createDebug('vorbis:sw');
export const logLibrary = createDebug('vorbis:library');
export const logSession = createDebug('vorbis:session');
