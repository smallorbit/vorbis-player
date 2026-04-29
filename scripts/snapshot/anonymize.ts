import { createHash } from 'node:crypto';

export const SCRUBBED = {
  DISPLAY_NAME: 'Anonymous User',
  EMAIL: null as string | null,
  EMPTY_STRING: '',
  EMPTY_ARRAY: [] as never[],
} as const;

/**
 * Produces a deterministic anonymized id: "<prefix>_<sha256-truncated-8>".
 * Same seed + value always yields the same output across re-runs.
 */
export function hashId(
  seed: string,
  prefix: 'user' | 'owner' | 'playlist' | 'track_added_by',
  value: string,
): string {
  const hash = createHash('sha256')
    .update(seed + ':' + value)
    .digest('hex')
    .slice(0, 8);
  return `${prefix}_${hash}`;
}

export interface AnonymizationContext {
  readonly seed: string;
  /** Returns the anonymized id for an original Spotify playlist id. Memoized within a run. */
  anonymizePlaylistId(originalId: string): string;
}

export function createAnonymizationContext(seed: string): AnonymizationContext {
  const playlistIdMap = new Map<string, string>();

  return {
    seed,
    anonymizePlaylistId(originalId: string): string {
      let anonymized = playlistIdMap.get(originalId);
      if (!anonymized) {
        anonymized = hashId(seed, 'playlist', originalId);
        playlistIdMap.set(originalId, anonymized);
      }
      return anonymized;
    },
  };
}
