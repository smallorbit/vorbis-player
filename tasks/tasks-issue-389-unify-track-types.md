# Task List: Unify Track and MediaTrack Types (Issue #389)

## Relevant Files

### Core Type Definitions
- `src/types/domain.ts` - MediaTrack type definition
- `src/services/spotify.ts` - Track type definition (to be deleted)

### Contexts and Providers
- `src/contexts/TrackContext.tsx` - Main track context
- `src/providers/spotify/useSpotifyPlaylistManager.ts` - Spotify playlist manager
- `src/providers/spotify/spotifyQueueSync.ts` - Spotify queue sync

### Hooks (need updates)
- `src/hooks/usePlayerLogic.ts` - Main state management (complex refactoring)
- `src/hooks/useProviderPlayback.ts` - Provider playback handling
- `src/hooks/useAutoAdvance.ts` - Auto-advance queue
- `src/hooks/useAccentColor.ts` - Accent color from track
- `src/hooks/useSpotifyControls.ts` - Spotify control callbacks
- `src/hooks/useQueueThumbnailLoader.ts` - Queue thumbnail loading
- `src/hooks/useQueueDurationLoader.ts` - Queue duration loading
- `src/hooks/useSaveQueueAsPlaylist.ts` - Save queue functionality
- `src/hooks/usePlayerState.ts` - Player state management
- `src/hooks/useMediaTracksMirror.ts` - (to be deleted)

### UI Components
- `src/components/QueueTrackList.tsx` - Queue track list display
- `src/components/QueueDrawer.tsx` - Queue drawer (desktop)
- `src/components/QueueBottomSheet.tsx` - Queue drawer (mobile)
- `src/components/AlbumArt.tsx` - Album art display
- `src/components/AlbumArtQuickSwapBack.tsx` - Album art controls
- `src/components/SpotifyPlayerControls.tsx` - Spotify controls
- `src/components/QuickEffectsRow.tsx` - Effects controls
- `src/components/PlayerStateRenderer.tsx` - Player state display

### Utilities and Tests
- `src/utils/queueTrackMirror.ts` - (may be deleted)
- `src/services/cache/cacheTypes.ts` - Cache type definitions
- `src/test/fixtures.ts` - Test fixtures
- `src/contexts/__tests__/TrackContext.test.tsx` - Track context tests

## Tasks

### Phase 1: Contexts and Type Interfaces

- [ ] 1.0 Migrate TrackContext to MediaTrack
  - [ ] 1.1 Replace `import type { Track }` with `import type { MediaTrack }`
  - [ ] 1.2 Change `TrackListContextValue` interface to use `MediaTrack` types
  - [ ] 1.3 Change `CurrentTrackContextValue` interface to use `MediaTrack` types
  - [ ] 1.4 Update `TrackProvider` component's `useState` calls to `MediaTrack`
  - [ ] 1.5 Verify with `npx tsc --noEmit`

- [ ] 2.0 Update simple hook type signatures (no field mapping)
  - [ ] 2.1 Update `useAutoAdvance.ts` to accept `MediaTrack[]`
  - [ ] 2.2 Update `useSpotifyControls.ts` to accept `MediaTrack | null`
  - [ ] 2.3 Verify both hooks with `npx tsc --noEmit`

### Phase 2: Field Name Updates in Hooks

- [ ] 3.0 Update hooks with field mapping (album_id → albumId, duration_ms → durationMs, uri → playbackRef.ref)
  - [ ] 3.1 Update `useAccentColor.ts` - map `album_id` to `albumId`
  - [ ] 3.2 Update `useQueueThumbnailLoader.ts` - map `album_id` to `albumId`
  - [ ] 3.3 Update `useQueueDurationLoader.ts` - map `duration_ms` to `durationMs`
  - [ ] 3.4 Update `useSaveQueueAsPlaylist.ts` - map `uri` to `playbackRef.ref`
  - [ ] 3.5 Verify all with `npx tsc --noEmit`

### Phase 3: Core State Management Refactoring

- [ ] 4.0 Migrate usePlayerLogic to MediaTrack (remove parallel mediaTracksRef)
  - [ ] 4.1 Replace `import type { Track }` with `import type { MediaTrack }`
  - [ ] 4.2 Remove `mediaTracksRef` MutableRefObject and `useMediaTracksMirror` usage
  - [ ] 4.3 Remove `mediaTrackToTrack` and `trackToMediaTrack` conversion functions
  - [ ] 4.4 Update `setTracks` calls to work directly with `MediaTrack[]`
  - [ ] 4.5 Update `handleRemoveFromQueue`, `handleReorderQueue`, `handleAddToQueue` for `MediaTrack[]`
  - [ ] 4.6 Update `handleStartRadio` for `MediaTrack[]`
  - [ ] 4.7 Update `handleProviderStateChange` metadata block for `MediaTrack` field names
  - [ ] 4.8 Remove `mediaTracksRef` from returned object
  - [ ] 4.9 Verify with `npx tsc --noEmit` and `npm run test:run`

- [ ] 5.0 Update usePlayerLogic callers
  - [ ] 5.1 Update `useProviderPlayback.ts` to remove `mediaTracksRef` parameter
  - [ ] 5.2 Update component call sites that read `mediaTracksRef`
  - [ ] 5.3 Verify with `npx tsc --noEmit`

### Phase 4: Provider Updates

- [ ] 6.0 Update Spotify provider to return MediaTrack
  - [ ] 6.1 Migrate `useSpotifyPlaylistManager.ts` - return `MediaTrack[]` from `handlePlaylistSelect`
  - [ ] 6.2 Update internal `buildTracksFromWindow` and `toTrack` helper
  - [ ] 6.3 Map Spotify fields: `album?.uri` to `albumId`, `duration_ms` to `durationMs`, `uri` to `playbackRef`
  - [ ] 6.4 Verify with `npx tsc --noEmit`

- [ ] 7.0 Update Spotify queue sync
  - [ ] 7.1 Replace `import type { Track }` with `import type { MediaTrack }` in `spotifyQueueSync.ts`
  - [ ] 7.2 Update `buildUpcomingUris` method to read `playbackRef.ref` instead of `uri`
  - [ ] 7.3 Verify with `npx tsc --noEmit`

### Phase 5: UI Components

- [ ] 8.0 Update queue-related UI components
  - [ ] 8.1 Update `QueueTrackList.tsx` - replace `Track` with `MediaTrack`, map `duration_ms` to `durationMs`
  - [ ] 8.2 Update `QueueDrawer.tsx` - replace `Track` with `MediaTrack`
  - [ ] 8.3 Update `QueueBottomSheet.tsx` - replace `Track` with `MediaTrack`
  - [ ] 8.4 Verify with `npx tsc --noEmit`

- [ ] 9.0 Update other UI components
  - [ ] 9.1 Update `AlbumArt.tsx` - replace `Track` with `MediaTrack`
  - [ ] 9.2 Update `AlbumArtQuickSwapBack.tsx` - replace `Track` with `MediaTrack`
  - [ ] 9.3 Update `SpotifyPlayerControls.tsx` - replace `Track` with `MediaTrack`
  - [ ] 9.4 Update `QuickEffectsRow.tsx` - replace `Track` with `MediaTrack`, map `album_id` to `albumId`
  - [ ] 9.5 Update `PlayerStateRenderer.tsx` - replace `Track[]` with `MediaTrack[]`
  - [ ] 9.6 Verify with `npx tsc --noEmit` and `npm run test:run`

### Phase 6: Additional Hooks and Services

- [ ] 10.0 Update remaining hooks and services
  - [ ] 10.1 Update `usePlayerState.ts` - replace `Track` with `MediaTrack` in type definitions
  - [ ] 10.2 Review and update `src/services/cache/cacheTypes.ts` if needed (cache layer concern)
  - [ ] 10.3 Verify with `npx tsc --noEmit`

### Phase 7: Tests and Fixtures

- [ ] 11.0 Update test fixtures and fix tests
  - [ ] 11.1 Add `makeMediaTrack()` factory to `src/test/fixtures.ts`
  - [ ] 11.2 Update `TrackContext.test.tsx` to use `makeMediaTrack`
  - [ ] 11.3 Run `npm run test:run` and fix any failing tests
  - [ ] 11.4 All tests must pass

### Phase 8: Cleanup

- [ ] 12.0 Delete Track type and conversion utilities
  - [ ] 12.1 Verify no remaining `import.*Track.*spotify` statements with grep
  - [ ] 12.2 Delete `Track` interface from `src/services/spotify.ts`
  - [ ] 12.3 Delete `useMediaTracksMirror.ts` if no longer referenced
  - [ ] 12.4 Remove unused utilities from `src/utils/queueTrackMirror.ts` or delete the file
  - [ ] 12.5 Run `npx tsc --noEmit` and `npm run test:run` for final verification
  - [ ] 12.6 Verify clean build with `npm run build`

## Notes

- This refactoring has 12 parent tasks with multiple sub-tasks each
- Work through phases sequentially; each phase depends on the previous one
- After each parent task, verify with `npx tsc --noEmit`
- Run `npm run test:run` after Phase 5 and Phase 7 to catch breaking changes early
- The parallel `mediaTracksRef` synchronization in `usePlayerLogic` is the core of the complexity
- Spotify-specific fields (`uri`, `album_id`, `duration_ms`) are consolidated into `playbackRef` and `MediaTrack` fields
