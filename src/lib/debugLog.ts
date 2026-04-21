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

/**
 * Focused trace for the fresh-load album-art race: every event that can flip
 * `currentTrackIndex` during a playTrack transition (guard set/clear,
 * prepareTrack emit, subscription accept/reject) is logged with an absolute
 * `performance.now()` timestamp so the ordering can be reconstructed
 * deterministically from a single console capture.
 *
 * Enable with: localStorage.debug = 'vorbis:art-race' (or 'vorbis:*').
 */
const _logArtRace = createDebug('vorbis:art-race');
export const logArtRace = (fmt: string, ...args: unknown[]) =>
  _logArtRace(`[t=%sms] ${fmt}`, performance.now().toFixed(1), ...args);
