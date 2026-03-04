# PRD: Dropbox Liked Songs

## Introduction/Overview

Add "Liked Songs" support to the Dropbox provider, allowing users to like/unlike individual tracks and browse their liked tracks as a collection in the library. Liked track data is stored locally in IndexedDB (the existing `vorbis-dropbox-art` database), not on Dropbox itself. This brings feature parity with the Spotify provider's like functionality.

## Goals

1. Users can like/unlike any Dropbox track using the existing heart button (keyboard shortcut `K`).
2. Liked Songs appears as a collection in the library browser with a Dropbox-blue gradient card.
3. Selecting "Liked Songs" loads and plays all liked tracks instantly from local storage.
4. Liked track metadata is stored alongside the track ID so the collection loads without Dropbox API calls.
5. The existing "Clear Cache" settings menu includes liked songs in its "Also clear Likes" checkbox for Dropbox.
6. A "Refresh Liked Songs metadata" option is available so users can update stale metadata (e.g., after renaming files in Dropbox).

## User Stories

- As a Dropbox user, I want to like a track so I can build a personal favorites collection.
- As a Dropbox user, I want to see my Liked Songs in the library browser so I can quickly play my favorites.
- As a Dropbox user, I want to unlike a previously liked track so I can curate my collection.
- As a Dropbox user, I want to refresh my liked songs metadata so that renamed or moved files stay up to date.

## Functional Requirements

### Storage Layer (IndexedDB)

1. Add a new `likes` object store to the existing `vorbis-dropbox-art` IndexedDB database (bump version from 2 to 3).
2. Each entry stores: `{ trackId: string, track: MediaTrack, likedAt: number }` with `trackId` as the key path.
3. Create a new module `src/providers/dropbox/dropboxLikesCache.ts` (mirroring the pattern in `dropboxCatalogCache.ts`) with these exports:
   - `getLikedTracks(): Promise<MediaTrack[]>` — returns all liked tracks sorted by `likedAt` descending (newest first).
   - `getLikedCount(): Promise<number>` — returns the count of liked tracks.
   - `isTrackLiked(trackId: string): Promise<boolean>` — checks if a specific track is liked.
   - `setTrackLiked(trackId: string, track: MediaTrack, liked: boolean): Promise<void>` — adds or removes a liked track.
   - `clearLikes(): Promise<void>` — removes all liked tracks (for cache clearing).
   - `refreshLikedTrackMetadata(freshTracks: MediaTrack[]): Promise<number>` — updates metadata for liked tracks that match by ID. Returns the number of tracks updated.

### Catalog Adapter Changes

4. Implement `isTrackSaved(trackId)` on `DropboxCatalogAdapter` — delegates to `isTrackLiked()`.
5. Implement `setTrackSaved(trackId, saved)` on `DropboxCatalogAdapter`. When saving, needs the full `MediaTrack` — obtain it from the currently loaded tracks (via a new internal method or constructor parameter).
6. Implement `getLikedCount()` on `DropboxCatalogAdapter` — delegates to `getLikedCount()` from the cache.
7. Update `listTracks()` to handle `collectionRef.kind === 'liked'` — return liked tracks from the cache instead of returning `[]`.

### Provider Descriptor Changes

8. In `dropboxProvider.ts`, set `capabilities.hasLikedCollection: true` and `capabilities.hasSaveTrack: true`.

### Playback Integration

9. In `usePlayerLogic.ts`, update the Dropbox branch of `handlePlaylistSelect` to recognize `LIKED_SONGS_ID` and construct a `CollectionRef` with `kind: 'liked'`.

### Library UI Changes

10. In `PlaylistSelection.tsx`, make the Liked Songs gradient provider-aware: use Dropbox blue (`#0061FF` to `#0090FF`) when the active provider is Dropbox, and Spotify green when Spotify is active.

### Cache Clearing

11. In the "Clear Cache" flow, **hide** the "Also clear Likes" checkbox when Dropbox is the active provider. Unlike Spotify (where the API is the source of truth and likes can be re-fetched), Dropbox likes only exist locally — clearing them is permanent data loss. The Dropbox likes live in a separate IndexedDB store (`vorbis-dropbox-art` → `likes`) from the Spotify library cache, so they are already safe from `clearCacheWithOptions`.

### Export/Import

12. Add an "Export Likes" button in the Dropbox section of the settings menu. Clicking it downloads a JSON file containing all liked track entries, allowing users to back up their likes.
13. Add an "Import Likes" button that opens a file picker, reads a previously exported JSON file, and restores the liked tracks into IndexedDB. Duplicate entries (matching track IDs) are overwritten with the imported data.

### Metadata Refresh

14. Add a "Refresh Liked Metadata" button in the Dropbox section of the settings/effects menu. When clicked, it re-scans the user's Dropbox to find current metadata for all liked track IDs and updates the stored `MediaTrack` data in IndexedDB. Tracks whose IDs are no longer found in Dropbox are removed from likes, with a count shown to the user.

## Non-Goals (Out of Scope)

- Syncing likes to Dropbox cloud storage (e.g., storing a likes.json file in Dropbox).
- Cross-device sync of likes (likes are local to the browser).
- Cross-browser or multi-device import/export (JSON export/import is provided for single-browser backup).
- Liked Songs appearing as a smart playlist with sorting/filtering options beyond what the existing UI provides.

## Design Considerations

- **Liked Songs card gradient**: Use `linear-gradient(135deg, #0061FF 0%, #0090FF 100%)` for Dropbox (brand blue), keeping the existing Spotify green for Spotify.
- **Heart icon**: Reuses the existing heart icon and `useLikeTrack` hook — no UI changes needed for the like button itself.
- **Library ordering**: Liked Songs card appears in the same position as it does for Spotify (top of playlists view, pinnable).

## Technical Considerations

- **DB version bump**: The `onupgradeneeded` handler in `dropboxArtCache.ts` must be updated to create the `likes` store when upgrading from version 2 to 3. Existing `art` and `catalog` stores are preserved.
- **Track identity for setTrackSaved**: The `CatalogProvider.setTrackSaved(trackId, saved)` interface only passes the track ID, not the full `MediaTrack`. The adapter needs access to the current track data. Options:
  - Keep an internal `Map<string, MediaTrack>` populated during `listTracks()` calls.
  - Accept the `MediaTrack` from the calling hook (would require interface change — avoid).
  - **Recommended**: Cache a `lastLoadedTracks` map in the adapter, populated whenever `listTracks` returns results.
- **Existing hook compatibility**: `useLikeTrack` already checks `catalog.isTrackSaved` and `catalog.setTrackSaved` existence — no changes needed.
- **Existing library sync**: `useLibrarySync` already calls `catalog.getLikedCount()` at line 157-159 — just needs the method to exist on the adapter.

## Success Metrics

- Dropbox users can like and unlike tracks.
- Liked Songs collection appears in library when > 0 likes exist.
- Playing the Liked Songs collection loads and plays all liked tracks.
- Liked track metadata survives page reloads (persisted in IndexedDB).
- "Clear Cache" with "Also clear Likes" removes Dropbox likes.
- No regressions in Spotify like functionality.

## Open Questions

1. **Track metadata staleness**: When a user renames or moves a file in Dropbox, the stored `MediaTrack` metadata becomes stale. The "Refresh Liked Metadata" feature addresses this, but should we also show a visual indicator for tracks that can't be found during refresh (i.e., deleted files)?
   - **Proposed**: During refresh, remove liked entries whose track IDs are no longer found in the Dropbox scan. Show a toast/notification with the count of removed tracks.
2. **Maximum likes**: Should we set an upper bound on the number of liked tracks? IndexedDB can handle thousands of entries, so likely no limit is needed.
   - **Proposed**: No limit.
