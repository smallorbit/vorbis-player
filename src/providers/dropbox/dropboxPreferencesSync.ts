/**
 * Syncs user preferences (pins + accent overrides/custom colors) to /.vorbis/preferences.json.
 * Merge: last-write-wins by updatedAt. Reuses /.vorbis folder; ensures folder on 409.
 */

import type { DropboxAuthAdapter } from './dropboxAuthAdapter';
import { getPins, setPins, UNIFIED_PROVIDER, notifyPinsChanged } from '@/services/settings/pinnedItemsStorage';
import { RemoteJsonFileStore } from './remoteJsonFileStore';
import { STORAGE_KEYS } from '@/constants/storage';
import { logCaughtError } from '@/utils/logCaughtError';
import {
  readLocalStorageRaw,
  removeLocalStorageKey,
  writeLocalStorageJson,
  writeLocalStorageRaw,
} from '@/utils/persistedStorage';

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

function parseJsonObject(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch (err) {
    logCaughtError('dropboxPreferencesSync.parseJsonObject', err);
    return {};
  }
}

// ── Adapter: build from local / apply to local ───────────────────────────────

export async function buildPreferencesFromLocal(): Promise<Omit<RemotePreferencesFile, 'version' | 'updatedAt'>> {
  const [playlists, albums] = await Promise.all([
    getPins(UNIFIED_PROVIDER, 'playlists'),
    getPins(UNIFIED_PROVIDER, 'albums'),
  ]);
  const overrides = parseJsonObject(readLocalStorageRaw(STORAGE_KEYS.ACCENT_COLOR_OVERRIDES));
  const customColors = parseJsonObject(readLocalStorageRaw(STORAGE_KEYS.CUSTOM_ACCENT_COLORS));
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
  writeLocalStorageJson(STORAGE_KEYS.ACCENT_COLOR_OVERRIDES, accent.overrides ?? {});
  writeLocalStorageJson(STORAGE_KEYS.CUSTOM_ACCENT_COLORS, accent.customColors ?? {});
}

function getLocalUpdatedAt(): string | null {
  return readLocalStorageRaw(STORAGE_KEYS.PREFERENCES_SYNC_UPDATED_AT);
}

function setLocalUpdatedAt(updatedAt: string): void {
  writeLocalStorageRaw(STORAGE_KEYS.PREFERENCES_SYNC_UPDATED_AT, updatedAt);
}

// ── Sync service ────────────────────────────────────────────────────────────

export class DropboxPreferencesSyncService {
  private readonly store: RemoteJsonFileStore<RemotePreferencesFile>;

  constructor(auth: DropboxAuthAdapter) {
    this.store = new RemoteJsonFileStore<RemotePreferencesFile>({
      auth,
      path: PREFERENCES_FILE_PATH,
      expectedVersion: 1,
      logLabel: 'DropboxPreferencesSync',
      buildPayload: async () => {
        const payload = await buildPreferencesFromLocal();
        return {
          version: 1 as const,
          updatedAt: new Date().toISOString(),
          ...payload,
        };
      },
      onUploadSuccess: (data) => {
        setLocalUpdatedAt(data.updatedAt);
      },
    });
  }

  /** @internal test seam — delegates to RemoteJsonFileStore */
  downloadPreferencesFile(): Promise<RemotePreferencesFile | null> {
    return this.store.download();
  }

  /** @internal test seam — delegates to RemoteJsonFileStore */
  uploadPreferencesFile(data: RemotePreferencesFile): Promise<boolean> {
    return this.store.upload(data);
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
      const remote = await this.store.download();
      const localUpdatedAt = getLocalUpdatedAt();
      const { shouldApplyRemote, shouldPushLocal } = this.merge(remote, localUpdatedAt);

      if (shouldApplyRemote && remote) {
        await applyRemoteToLocal(remote);
        setLocalUpdatedAt(remote.updatedAt);
      }

      if (shouldPushLocal) {
        await this.store.pushNow();
      }
    } catch (error) {
      console.warn('[DropboxPreferencesSync] Initial sync failed:', error);
    }
  }

  schedulePush(): void {
    this.store.schedulePush();
  }

  destroy(): void {
    this.store.destroy();
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
  removeLocalStorageKey(STORAGE_KEYS.PREFERENCES_SYNC_UPDATED_AT);
}
