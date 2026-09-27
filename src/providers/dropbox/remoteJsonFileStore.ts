/**
 * Shared Dropbox remote-JSON transport for `/.vorbis/*` sync files.
 *
 * Owns: path download/upload, version guard, debounced single-flight push.
 * Domain merge policy stays with the caller (likes / preferences / playlists
 * each have incompatible merge shapes).
 */

import type { DropboxAuthHandle } from './dropboxAuthHandle';
import { ensureVorbisFolder } from './dropboxSyncFolder';
import { contentApiRequest } from './dropboxContentApiClient';
import { logCaughtError } from '@/utils/logCaughtError';

const DEFAULT_UPLOAD_DEBOUNCE_MS = 2000;

/** Escape non-ASCII characters for use in HTTP headers (Dropbox-API-Arg). */
export function jsonToHttpHeader(json: string): string {
  return json.replace(/[\u0080-\uffff]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return `\\u${code.toString(16).padStart(4, '0')}`;
  });
}

export interface VersionedJson {
  version: number;
}

export interface RemoteJsonTransportOptions {
  auth: DropboxAuthHandle;
  path: string;
  expectedVersion: number;
  logLabel: string;
  /** Called before upload. Defaults to `ensureVorbisFolder`. Pass a no-op when the caller already ensured. */
  ensureFolder?: ((auth: DropboxAuthHandle) => Promise<boolean>) | undefined;
  /** Encode the Dropbox-API-Arg JSON string (e.g. `jsonToHttpHeader` for non-ASCII paths). */
  encodeApiArg?: ((json: string) => string) | undefined;
}

export async function downloadRemoteJson<T extends VersionedJson>(
  options: RemoteJsonTransportOptions,
): Promise<T | null> {
  const { auth, path, expectedVersion, logLabel } = options;
  const encode = options.encodeApiArg ?? ((s: string) => s);
  const apiArg = encode(JSON.stringify({ path }));

  const response = await contentApiRequest(auth, (token) =>
    fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': apiArg,
      },
    }),
  );

  if (!response) return null;

  if (response.status === 409) {
    // path/not_found — file doesn't exist yet
    return null;
  }

  if (!response.ok) {
    console.warn(`[${logLabel}] Download failed:`, response.status);
    return null;
  }

  try {
    const data: unknown = await response.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('version' in data) ||
      typeof (data as { version: unknown }).version !== 'number'
    ) {
      console.warn(`[${logLabel}] Failed to parse remote JSON file`);
      return null;
    }
    if ((data as { version: number }).version !== expectedVersion) {
      console.warn(`[${logLabel}] Unknown file version:`, (data as { version: number }).version);
      return null;
    }
    return data as T;
  } catch (err) {
    logCaughtError(`${logLabel}.download`, err);
    console.warn(`[${logLabel}] Failed to parse remote JSON file`);
    return null;
  }
}

export async function uploadRemoteJson<T>(
  options: RemoteJsonTransportOptions,
  data: T,
): Promise<boolean> {
  const { auth, path, logLabel } = options;
  const ensureFolder = options.ensureFolder ?? ensureVorbisFolder;
  const encode = options.encodeApiArg ?? ((s: string) => s);

  const folderReady = await ensureFolder(auth);
  if (!folderReady) return false;

  const apiArg = encode(JSON.stringify({ path, mode: 'overwrite' }));
  const body = JSON.stringify(data);

  const response = await contentApiRequest(auth, (accessToken) =>
    fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': apiArg,
        'Content-Type': 'application/octet-stream',
      },
      body,
    }),
  );

  if (!response) return false;

  if (!response.ok) {
    const errText = await response.text();
    let errMsg: string;
    try {
      const errJson: unknown = JSON.parse(errText);
      const summary =
        typeof errJson === 'object' &&
        errJson !== null &&
        'error_summary' in errJson &&
        typeof (errJson as { error_summary: unknown }).error_summary === 'string'
          ? (errJson as { error_summary: string }).error_summary
          : typeof errJson === 'object' &&
              errJson !== null &&
              'error' in errJson &&
              typeof (errJson as { error: unknown }).error === 'string'
            ? (errJson as { error: string }).error
            : errText;
      errMsg = summary || response.statusText;
    } catch (err) {
      logCaughtError(`${logLabel}.upload.parseError`, err);
      errMsg = errText || response.statusText;
    }
    console.warn(`[${logLabel}] Upload failed:`, response.status, errMsg);
    if (response.status === 400) console.error(`[${logLabel}] 400 response body:`, errText);
    return false;
  }

  return true;
}

export interface RemoteJsonFileStoreOptions<T extends VersionedJson>
  extends RemoteJsonTransportOptions {
  debounceMs?: number | undefined;
  /** Build the payload for a push. Required for `schedulePush` / `pushNow`. */
  buildPayload: () => Promise<T>;
  /** Invoked after a successful upload (e.g. persist pruned tombstones). */
  onUploadSuccess?: ((data: T) => void | Promise<void>) | undefined;
}

/**
 * Stateful wrapper: fixed path + debounced single-flight push.
 * Construct one per sync file (likes.json, preferences.json, …).
 */
export class RemoteJsonFileStore<T extends VersionedJson> {
  private readonly options: RemoteJsonFileStoreOptions<T>;
  private readonly debounceMs: number;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pushing = false;

  constructor(options: RemoteJsonFileStoreOptions<T>) {
    this.options = options;
    this.debounceMs = options.debounceMs ?? DEFAULT_UPLOAD_DEBOUNCE_MS;
  }

  download(): Promise<T | null> {
    return downloadRemoteJson<T>(this.options);
  }

  upload(data: T): Promise<boolean> {
    return uploadRemoteJson(this.options, data);
  }

  /**
   * Schedule a debounced push. Concurrent calls collapse onto one timer;
   * overlapping uploads are single-flighted (second call no-ops while first runs).
   */
  schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.pushNow().catch((err: unknown) => {
        console.warn(`[${this.options.logLabel}] Push failed:`, err);
      });
    }, this.debounceMs);
  }

  async pushNow(): Promise<boolean> {
    if (this.pushing) return false;
    this.pushing = true;
    try {
      const data = await this.options.buildPayload();
      const success = await this.upload(data);
      if (success && this.options.onUploadSuccess) {
        await this.options.onUploadSuccess(data);
      }
      return success;
    } finally {
      this.pushing = false;
    }
  }

  destroy(): void {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
  }
}
