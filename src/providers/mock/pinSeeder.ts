import type { SnapshotPins } from '../../../playwright/fixtures/data/snapshot.types';
import {
  STORE_NAMES,
  settingsGet,
  settingsPut,
} from '@/services/settings/settingsDb';
import {
  setPins,
  UNIFIED_PROVIDER,
  MAX_PINS,
} from '@/services/settings/pinnedItemsStorage';

const SEED_SENTINEL_KEY = 'mock-pins-seeded-v1';

export async function seedPinsFromSnapshots(
  spotify: SnapshotPins | null,
  dropbox: SnapshotPins | null,
): Promise<void> {
  const sentinel = await settingsGet(STORE_NAMES.PINS, SEED_SENTINEL_KEY);
  if (sentinel !== undefined) return;

  const playlistIds = dedupe([
    ...(spotify?.playlistIds ?? []),
    ...(dropbox?.playlistIds ?? []),
  ]);
  const albumIds = dedupe([
    ...(spotify?.albumIds ?? []),
    ...(dropbox?.albumIds ?? []),
  ]);

  await setPins(UNIFIED_PROVIDER, 'playlists', playlistIds.slice(0, MAX_PINS));
  await setPins(UNIFIED_PROVIDER, 'albums', albumIds.slice(0, MAX_PINS));
  await settingsPut(STORE_NAMES.PINS, { key: SEED_SENTINEL_KEY, ids: [] });
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}
