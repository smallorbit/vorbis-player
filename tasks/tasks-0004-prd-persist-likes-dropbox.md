# Tasks: Persist Dropbox Likes to Cloud Storage

## Relevant Files

- `src/providers/dropbox/dropboxArtCache.ts` - Bump DB version, add tombstones object store
- `src/providers/dropbox/dropboxLikesCache.ts` - Export LikedEntry, add getLikedEntries/replaceLikes, tombstone functions
- `src/providers/dropbox/dropboxLikesSync.ts` - NEW: Core sync service with download, upload, merge, debounce
- `src/providers/dropbox/dropboxCatalogAdapter.ts` - Wire sync into setTrackSaved, importLikes, clearLikesCache
- `src/providers/dropbox/dropboxProvider.ts` - Initialize sync service, trigger initial sync on auth
- `src/providers/dropbox/__tests__/dropboxLikesSync.test.ts` - NEW: Tests for sync service and merge algorithm
- `src/providers/dropbox/__tests__/dropboxLikesCache.test.ts` - Update tests for new functions

### Notes

- Tests are colocated in `__tests__/` subdirectories
- Run `npm run test:run` to execute all tests
- Run `npx tsc --noEmit` to verify TypeScript compiles

## Tasks

- [ ] 1.0 Add tombstones store to IndexedDB and extend likes cache
  - [ ] 1.1 Bump DB_VERSION from 5 to 6 in `dropboxArtCache.ts` and add `tombstones` object store with keyPath `trackId`
  - [ ] 1.2 Export the `LikedEntry` interface from `dropboxLikesCache.ts`
  - [ ] 1.3 Add `getLikedEntries(): Promise<LikedEntry[]>` to return raw entries (not mapped to MediaTrack)
  - [ ] 1.4 Add `replaceLikes(entries: LikedEntry[]): Promise<void>` that clears and replaces all entries atomically
  - [ ] 1.5 Add tombstone functions in `dropboxLikesCache.ts`: `addTombstone(trackId)`, `getTombstones()`, `clearTombstones()`, `setTombstones(entries)`
  - [ ] 1.6 Call `addTombstone()` from `setTrackLiked()` when `liked === false`

- [ ] 2.0 Create the Dropbox likes sync service
  - [ ] 2.1 Create `dropboxLikesSync.ts` with `RemoteLikesFile` type, constants, and `DropboxLikesSyncService` class skeleton
  - [ ] 2.2 Implement `downloadLikesFile()` using Dropbox content API with 401 retry and 409/not_found handling
  - [ ] 2.3 Implement `uploadLikesFile()` using Dropbox content API with overwrite mode and mute flag
  - [ ] 2.4 Implement `mergeLikes()` — last-write-wins merge of local entries, remote entries, and tombstones with pruning
  - [ ] 2.5 Implement `initialSync()` — download, merge, write to IDB, conditionally push
  - [ ] 2.6 Implement `schedulePush()` with 2-second debounce and `doPush()` with retry on failure
  - [ ] 2.7 Export singleton init/getter: `initLikesSync(auth)` and `getLikesSync()`

- [ ] 3.0 Wire sync into catalog adapter and provider
  - [ ] 3.1 In `dropboxCatalogAdapter.ts`, import sync and call `schedulePush()` after `setTrackSaved()`, `importLikes()`, and `clearLikesCache()`
  - [ ] 3.2 Add `initializeSync()` method on the catalog adapter that calls `likesSync.initialSync()`
  - [ ] 3.3 In `dropboxProvider.ts`, initialize the sync service and trigger `initialSync()` when authenticated
  - [ ] 3.4 Handle post-login sync: trigger `initialSync()` after successful OAuth callback

- [ ] 4.0 Add tests for sync service
  - [ ] 4.1 Unit tests for `mergeLikes()` — same like both sides, conflicting timestamps, tombstone vs like, tombstone expiration, empty remote/local
  - [ ] 4.2 Unit tests for `downloadLikesFile()` and `uploadLikesFile()` with mocked fetch
  - [ ] 4.3 Integration test for `initialSync()` flow
  - [ ] 4.4 Update existing `dropboxLikesCache.test.ts` for new functions (getLikedEntries, replaceLikes, tombstones)

- [ ] 5.0 Build verification and cleanup
  - [ ] 5.1 Run `npx tsc --noEmit` and fix any type errors
  - [ ] 5.2 Run `npm run test:run` and fix any test failures
  - [ ] 5.3 Run `npm run build` to verify production build
