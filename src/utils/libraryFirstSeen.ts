import type { ProviderId } from '@/types/domain';

/**
 * Stable "added to this app" time for catalog-backed collections (e.g. Dropbox)
 * that have no provider-reported added_at. Persisted so "Recently Added" sort
 * does not reshuffle on every refresh.
 *
 * @param ordinalForNew - When several collections are first-seen in one sync,
 *   offset by this many minutes so sort order is not all identical (only on first write).
 */
export function getOrSetFirstSeenAddedAtIso(
  providerId: ProviderId,
  collectionId: string,
  ordinalForNew = 0
): string {
  try {
    const key = `vorbis-library-first-seen:${providerId}:${encodeURIComponent(collectionId)}`;
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const now = new Date(Date.now() - ordinalForNew * 60000).toISOString();
    window.localStorage.setItem(key, now);
    return now;
  } catch {
    return new Date(Date.now() - ordinalForNew * 60000).toISOString();
  }
}
