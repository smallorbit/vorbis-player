/**
 * Shared utility for ensuring the /.vorbis sync folder exists in Dropbox.
 * Deduplicates concurrent calls and caches the result to avoid redundant API requests.
 */

import type { DropboxAuthAdapter } from './dropboxAuthAdapter';
import { contentApiRequest } from './dropboxContentApiClient';

const FOLDER_PATH = '/.vorbis';
const RETRY_DELAY_MS = 1500;

let folderConfirmed = false;
let inflightPromise: Promise<boolean> | null = null;

const MAX_RATE_LIMIT_RETRIES = 3;

async function doEnsureFolder(auth: DropboxAuthAdapter): Promise<boolean> {
  const createFolder = (token: string) =>
    fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: FOLDER_PATH, autorename: false }),
    });

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await contentApiRequest(auth, createFolder);

    if (!response) return false;

    if (response.status === 409) return true;

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfter = response.headers.get('Retry-After');
      const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : RETRY_DELAY_MS;
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    if (!response.ok) {
      console.warn('[DropboxSyncFolder] Failed to ensure /.vorbis folder:', response.status);
      return false;
    }

    return true;
  }

  return false;
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

