/**
 * Syncs user preferences (pins + accent overrides/custom colors) to /.vorbis/preferences.json.
 * Merge: last-write-wins by updatedAt. Reuses /.vorbis folder; ensures folder on 409.
 */

import type { DropboxAuthAdapter } from './dropboxAuthAdapter';
import { getPins, setPins, UNIFIED_PROVIDER, notifyPinsChanged } from '@/services/settings/pinnedItemsStorage';
import { ensureVorbisFolder } from './dropboxSyncFolder';

// ── Types ───────────────────────────────────────────────────────────────────

export interface RemotePreferencesFile {
  version: 1;
  updatedAt: string;
  pins: {
    playlists: string[];
    albums: string[];
  };
  accent: {
    overrides: Record<string, string>;
    customColors: Record<string, string>;
  };
}

const PREFERENCES_FILE_PATH = '/.vorbis/preferences.json';
const UPLOAD_DEBOUNCE_MS = 2000;
const LS_UPDATED_AT = 'vorbis-player-preferences-sync-updatedAt';
const LS_ACCENT_OVERRIDES = 'vorbis-player-accent-color-overrides';
const LS_ACCENT_CUSTOM = 'vorbis-player-custom-accent-colors';

// ── Adapter: build from local / apply to local ───────────────────────────────

export async function buildPreferencesFromLocal(): Promise<Omit<RemotePreferencesFile, 'version' | 'updatedAt'>> {
  const [playlists, albums] = await Promise.all([
    getPins(UNIFIED_PROVIDER, 'playlists'),
    getPins(UNIFIED_PROVIDER, 'albums'),
  ]);
  const overridesRaw = localStorage.getItem(LS_ACCENT_OVERRIDES);
  const customRaw = localStorage.getItem(LS_ACCENT_CUSTOM);
  const overrides: Record<string, string> = overridesRaw ? (() => {
    try {
      const o = JSON.parse(overridesRaw);
      return typeof o === 'object' && o !== null ? o : {};
    } catch {
      return {};
    }
  })() : {};
  const customColors: Record<string, string> = customRaw ? (() => {
    try {
      const o = JSON.parse(customRaw);
      return typeof o === 'object' && o !== null ? o : {};
    } catch {
      return {};
    }
  })() : {};
  return {
    pins: { playlists, albums },
    accent: { overrides, customColors },
  };
}

export async function applyRemoteToLocal(data: RemotePreferencesFile): Promise<void> {
  await Promise.all([
    setPins(UNIFIED_PROVIDER, 'playlists', data.pins.playlists ?? []),
    setPins(UNIFIED_PROVIDER, 'albums', data.pins.albums ?? []),
  ]);
  notifyPinsChanged();
  const accent = data.accent ?? { overrides: {}, customColors: {} };
  localStorage.setItem(LS_ACCENT_OVERRIDES, JSON.stringify(accent.overrides ?? {}));
  localStorage.setItem(LS_ACCENT_CUSTOM, JSON.stringify(accent.customColors ?? {}));
}

function getLocalUpdatedAt(): string | null {
  return localStorage.getItem(LS_UPDATED_AT);
}

function setLocalUpdatedAt(updatedAt: string): void {
  localStorage.setItem(LS_UPDATED_AT, updatedAt);
}

// ── Sync service ────────────────────────────────────────────────────────────

export class DropboxPreferencesSyncService {
  private auth: DropboxAuthAdapter;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pushing = false;

  constructor(auth: DropboxAuthAdapter) {
    this.auth = auth;
  }

  async downloadPreferencesFile(): Promise<RemotePreferencesFile | null> {
    const token = await this.auth.ensureValidToken();
    if (!token) return null;

    const apiArg = JSON.stringify({ path: PREFERENCES_FILE_PATH });

    let response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': apiArg,
      },
    });

    if (response.status === 401) {
      const refreshed = await this.auth.refreshAccessToken();
      if (!refreshed) return null;
      response = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${refreshed}`,
          'Dropbox-API-Arg': apiArg,
        },
      });
    }

    if (response.status === 409) return null; // path/not_found

    if (!response.ok) {
      console.warn('[DropboxPreferencesSync] Download failed:', response.status);
      return null;
    }

    try {
      const data: RemotePreferencesFile = await response.json();
      if (data.version !== 1) {
        console.warn('[DropboxPreferencesSync] Unknown file version:', data.version);
        return null;
      }
      return data;
    } catch {
      console.warn('[DropboxPreferencesSync] Failed to parse remote preferences file');
      return null;
    }
  }

  async uploadPreferencesFile(data: RemotePreferencesFile): Promise<boolean> {
    let token = await this.auth.ensureValidToken();
    if (!token) return false;

    const folderReady = await ensureVorbisFolder(this.auth);
    if (!folderReady) return false;

    const apiArg = JSON.stringify({
      path: PREFERENCES_FILE_PATH,
      mode: 'overwrite',
    });

    const upload = (accessToken: string) =>
      fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Dropbox-API-Arg': apiArg,
          'Content-Type': 'application/octet-stream',
        },
        body: JSON.stringify(data),
      });

    let response = await upload(token);

    if (response.status === 401) {
      const refreshed = await this.auth.refreshAccessToken();
      if (!refreshed) return false;
      token = refreshed;
      response = await upload(token);
    }

    if (!response.ok) {
      const errText = await response.text();
      let errMsg: string;
      try {
        const errJson = JSON.parse(errText);
        errMsg = (errJson?.error_summary ?? errJson?.error ?? errText) || response.statusText;
      } catch {
        errMsg = errText || response.statusText;
      }
      console.warn('[DropboxPreferencesSync] Upload failed:', response.status, errMsg);
      if (response.status === 400) console.error('[DropboxPreferencesSync] 400 response body:', errText);
      return false;
    }
    return true;
  }

  /**
   * Merge: compare remote updatedAt vs local (stored in localStorage).
   * Returns: shouldApplyRemote, shouldPushLocal.
   */
  merge(
    remote: RemotePreferencesFile | null,
    localUpdatedAt: string | null,
  ): { shouldApplyRemote: boolean; shouldPushLocal: boolean } {
    if (!remote) return { shouldApplyRemote: false, shouldPushLocal: true };
    const remoteTime = new Date(remote.updatedAt).getTime();
    const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;
    if (remoteTime > localTime) return { shouldApplyRemote: true, shouldPushLocal: false };
    if (localTime > remoteTime) return { shouldApplyRemote: false, shouldPushLocal: true };
    return { shouldApplyRemote: false, shouldPushLocal: false };
  }

  async initialSync(): Promise<void> {
    try {
      const remote = await this.downloadPreferencesFile();
      const localUpdatedAt = getLocalUpdatedAt();
      const { shouldApplyRemote, shouldPushLocal } = this.merge(remote, localUpdatedAt);

      if (shouldApplyRemote && remote) {
        await applyRemoteToLocal(remote);
        setLocalUpdatedAt(remote.updatedAt);
      }

      if (shouldPushLocal) {
        await this.doPush();
      }
    } catch (error) {
      console.warn('[DropboxPreferencesSync] Initial sync failed:', error);
    }
  }

  schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      this.doPush().catch((err) => {
        console.warn('[DropboxPreferencesSync] Push failed:', err);
      });
    }, UPLOAD_DEBOUNCE_MS);
  }

  private async doPush(): Promise<void> {
    if (this.pushing) return;
    this.pushing = true;
    try {
      const payload = await buildPreferencesFromLocal();
      const data: RemotePreferencesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        ...payload,
      };
      const success = await this.uploadPreferencesFile(data);
      if (success) setLocalUpdatedAt(data.updatedAt);
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

// ── Singleton ────────────────────────────────────────────────────────────────

let preferencesSyncInstance: DropboxPreferencesSyncService | null = null;

export function initPreferencesSync(auth: DropboxAuthAdapter): DropboxPreferencesSyncService {
  if (preferencesSyncInstance) {
    preferencesSyncInstance.destroy();
  }
  preferencesSyncInstance = new DropboxPreferencesSyncService(auth);
  return preferencesSyncInstance;
}

export function getPreferencesSync(): DropboxPreferencesSyncService | null {
  return preferencesSyncInstance;
}

/**
 * Clear the local sync timestamp so the next initialSync() pulls from remote.
 * Call this when pins or accent colors are cleared locally.
 */
export function clearPreferencesSyncTimestamp(): void {
  localStorage.removeItem(LS_UPDATED_AT);
}
