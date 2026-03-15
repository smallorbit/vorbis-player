# Tasks: Unified Liked Tracks Playlist

## Relevant Files

- `src/hooks/useUnifiedLikedTracks.ts` - New hook that aggregates liked tracks from all connected providers, sorted by recency
- `src/hooks/__tests__/useUnifiedLikedTracks.test.ts` - Tests for unified liked tracks hook
- `src/types/domain.ts` - Added optional `addedAt` field to `MediaTrack`
- `src/services/spotify.ts` - Updated to preserve `added_at` timestamp on liked songs
- `src/providers/spotify/spotifyCatalogAdapter.ts` - Maps `added_at` to `addedAt` on `MediaTrack`
- `src/providers/dropbox/dropboxLikesCache.ts` - Returns `likedAt` as `addedAt` on liked tracks
- `src/components/PlaylistSelection.tsx` - Shows single unified liked card with blended gradient when 2+ providers active
- `src/components/Playlist.tsx` - Added provider icon badges on track items (unified context only)
- `src/components/PlaylistDrawer.tsx` - Passes `showProviderIcons` prop through to Playlist
- `src/components/PlaylistBottomSheet.tsx` - Passes `showProviderIcons` prop through to Playlist
- `src/components/PlayerContent.tsx` - Determines when to show provider icons based on unified state
- `src/components/ProviderIcon.tsx` - Existing provider icon badge component (reused as-is)
- `src/hooks/usePlayerLogic.ts` - Handles unified liked playlist selection (parallel fetch + merge)

### Notes

- Tests are colocated with source files in `__tests__/` subdirectories.
- Use `npm run test:run` to run tests once.
- The existing `ProviderIcon` component already renders small circular badges with Spotify/Dropbox SVG logos — reused for track-level provider attribution.

## Tasks

- [x] 1.0 Add unified liked tracks data layer (hook + aggregation logic)
  - [x] 1.1 Create `src/hooks/useUnifiedLikedTracks.ts` hook that fetches liked tracks from all enabled providers with `hasLikedCollection` capability in parallel using their `catalog.listTracks({ provider, kind: 'liked' })` methods
  - [x] 1.2 Merge tracks from all providers into a single array, sorted by liked timestamp descending (most recent first). Spotify tracks have `addedAt` from the API; Dropbox tracks have `likedAt` from IndexedDB. Tracks without timestamps sort last.
  - [x] 1.3 Subscribe to real-time updates: listen for Dropbox `LIKES_CHANGED_EVENT` and Spotify cache invalidation to trigger re-fetch of the unified list
  - [x] 1.4 Expose from the hook: `unifiedTracks: MediaTrack[]`, `totalCount: number`, `isLoading: boolean`, and a `refresh()` function
  - [x] 1.5 Add an `isUnifiedLikedActive` boolean (true when 2+ providers with `hasLikedCollection` are connected) that consuming components can use to decide between unified vs single-provider behavior
- [x] 2.0 Update PlaylistSelection UI to show a single unified liked songs card
  - [x] 2.1 Modify `PlaylistSelection.tsx`: when `isUnifiedLikedActive` is true, render a single "Liked Songs" card instead of per-provider cards. Pass no provider parameter to `handleLikedSongsClick()`.
  - [x] 2.2 Create a blended gradient function that combines enabled provider colors (Spotify green → Dropbox blue at 135°) for the unified card background. Fall back to existing single-provider gradient when only one provider is active.
  - [x] 2.3 Display the total liked count (sum across providers) on the unified card.
  - [x] 2.4 Ensure the pinning feature works with the unified liked card (same `LIKED_SONGS_ID` key).
- [x] 3.0 Update track list rendering to display provider icons
  - [x] 3.1 Modify `Playlist.tsx` track item rendering to accept and display an optional provider icon badge using the existing `ProviderIcon` component. Positioned on the album art thumbnail.
  - [x] 3.2 Pass the `provider` field from each `Track` to the track item when the current playlist is the unified liked playlist. Only show provider icons in the unified context (not for regular single-provider playlists).
- [x] 4.0 Wire up like/unlike actions and track loading in the unified context
  - [x] 4.1 Modify `usePlayerLogic.ts` `handlePlaylistSelect`: when `LIKED_SONGS_ID` is selected without a specific provider (unified mode), fetch liked tracks from all providers in parallel, merge and sort by recency, and set as the current playlist.
  - [x] 4.2 `useLikeTrack` already delegates to the source provider via the track's provider field — verified no changes needed.
  - [x] 4.3 Cross-provider playback transitions work via existing `currentPlaybackProviderRef` mechanism — verified no changes needed.
- [x] 5.0 Add automated tests for unified liked tracks behavior
  - [x] 5.1 Test that unified aggregation merges tracks from multiple providers sorted by timestamp descending
  - [x] 5.2 Test that single-provider mode (1 provider active) does not produce a unified playlist
  - [x] 5.3 Test that provider fetch failure is handled gracefully (returns tracks from working providers)
  - [x] 5.4 Test that Dropbox likes-changed event triggers a refresh of the unified list
