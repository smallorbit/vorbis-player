import type { CollectionRef } from '@/types/domain';

/**
 * Pin identifier for the unified Liked Songs entry.
 * Lives in the same pin-id namespace as collection ids.
 */
export const LIKED_SONGS_ID = 'liked-songs';

/** Display name for the Liked Songs collection */
export const LIKED_SONGS_NAME = 'Liked Songs';

/**
 * Pin identifier for the Dropbox "All Music" aggregate row.
 * Distinct from the underlying collection id (`''`) so the pin survives
 * even if the catalog representation of All Music changes.
 */
export const ALL_MUSIC_PIN_ID = 'dropbox-all-music';

/** Returns true when the ref points at the Dropbox "All Music" aggregate (folder with empty id). */
export function isAllMusicRef(ref: CollectionRef): boolean {
  return ref.provider === 'dropbox' && ref.kind === 'folder' && 'id' in ref && ref.id === '';
}
