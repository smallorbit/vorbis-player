/**
 * Registry-driven access to provider preferences sync. Neutral contexts call
 * these helpers instead of importing any provider's sync service directly.
 */

import { providerRegistry } from './registry';

/** Debounce-push local preferences to every provider that syncs them. */
export function schedulePreferencesPush(): void {
  for (const descriptor of providerRegistry.getAll()) {
    descriptor.preferencesSync?.schedulePush();
  }
}

/**
 * Forget every provider's last-sync marker and re-run its initial sync.
 * Used after local preferences are cleared so remote copies are refreshed.
 */
export async function resetPreferencesSync(): Promise<void> {
  for (const descriptor of providerRegistry.getAll()) {
    const sync = descriptor.preferencesSync;
    if (!sync) continue;
    sync.clearSyncTimestamp();
    await sync.initialSync();
  }
}
