/**
 * Shared utility for ensuring the /.vorbis sync folder exists in Dropbox.
 * Deduplicates concurrent calls and caches the result to avoid redundant API requests.
 */

import type { DropboxAuthAdapter } from './dropboxAuthAdapter';

const FOLDER_PATH = '/.vorbis';
const RETRY_DELAY_MS = 1500;

let folderConfirmed = false;
let inflightPromise: Promise<boolean> | null = null;

async function doEnsureFolder(auth: DropboxAuthAdapter): Promise<boolean> {
  const token = await auth.ensureValidToken();
  if (!token) return false;

  let response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: FOLDER_PATH, autorename: false }),
  });

  if (response.status === 401) {
    const refreshed = await auth.refreshAccessToken();
    if (!refreshed) return false;
    response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refreshed}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: FOLDER_PATH, autorename: false }),
    });
  }

  if (response.status === 409) return true;

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : RETRY_DELAY_MS;
    await new Promise((r) => setTimeout(r, delayMs));
    return doEnsureFolder(auth);
  }

  if (!response.ok) {
    console.warn('[DropboxSyncFolder] Failed to ensure /.vorbis folder:', response.status);
    return false;
  }

  return true;
}

/**
 * Ensures the /.vorbis folder exists. Safe to call concurrently from multiple
 * sync services — only one API call will be in flight at a time, and the result
 * is cached for the session.
 */
export async function ensureVorbisFolder(auth: DropboxAuthAdapter): Promise<boolean> {
  if (folderConfirmed) return true;

  if (inflightPromise) return inflightPromise;

  inflightPromise = doEnsureFolder(auth).then((ok) => {
    inflightPromise = null;
    if (ok) folderConfirmed = true;
    return ok;
  });

  return inflightPromise;
}

/** Reset cached state (for logout or testing). */
export function resetVorbisFolderCache(): void {
  folderConfirmed = false;
  inflightPromise = null;
}
