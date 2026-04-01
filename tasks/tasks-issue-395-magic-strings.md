# Issue 395: Extract Magic Strings and Event Names into Named Constants

This task involves extracting magic strings (event names, localStorage keys, playlist identifiers) into named constants for improved maintainability and readability.

## Relevant Files

- `src/constants/playlist.ts` — Add `RADIO_PLAYLIST_ID` constant
- `src/constants/events.ts` — Create new file for event constants
- `src/constants/storage.ts` — Create new file for storage key constants
- `src/contexts/ProviderContext.tsx` — Migrate to use new constants
- `src/contexts/VisualEffectsContext.tsx` — Migrate to use new constants
- `src/contexts/ColorContext.tsx` — Migrate to use new constants
- `src/contexts/ProfilingContext.tsx` — Migrate to use new constants
- `src/contexts/VisualizerDebugContext.tsx` — Migrate to use new constants
- `src/contexts/TrackContext.tsx` — Migrate to use new constants
- `src/hooks/useVolume.ts` — Migrate to use new constants
- `src/hooks/useVisualEffectsState.ts` — Migrate to use new constants
- `src/hooks/usePlayerState.ts` — Migrate to use new constants
- `src/hooks/usePlayerLogic.ts` — Migrate to use `RADIO_PLAYLIST_ID`
- `src/hooks/__tests__/usePlayerLogic.radio.test.tsx` — Update test to use constant
- `src/hooks/usePopupAuth.ts` — Migrate to use new event constants
- `src/components/AudioPlayer.tsx` — Migrate to use new constants
- `src/components/PlayerContent.tsx` — Migrate to use new constants
- `src/components/PlaylistSelection.tsx` — Migrate to use new constants
- `src/components/VisualEffectsMenu/index.tsx` — Migrate to use new constants
- `src/components/DebugOverlay.tsx` — Migrate to use new constants
- `src/App.tsx` — Migrate to use new event constants
- `src/providers/dropbox/dropboxAuthAdapter.ts` — Migrate to use new constants
- `src/providers/dropbox/dropboxPreferencesSync.ts` — Migrate to use new constants
- `src/providers/spotify/spotifyQueueSync.ts` — Migrate to use new constants
- `src/services/cache/libraryCache.ts` — Migrate to use new constants
- `src/services/settings/pinnedItemsStorage.ts` — Migrate to use new constants

## Tasks

- [ ] 1.0 Add `RADIO_PLAYLIST_ID` constant and migrate usages
  - [ ] 1.1 Add constant to `src/constants/playlist.ts`
  - [ ] 1.2 Update `src/hooks/usePlayerLogic.ts` to use constant
  - [ ] 1.3 Update test in `src/hooks/__tests__/usePlayerLogic.radio.test.tsx`
  - [ ] 1.4 Verify build with TypeScript and tests

- [ ] 2.0 Create `src/constants/events.ts` and migrate `AUTH_COMPLETE_EVENT`
  - [ ] 2.1 Create `src/constants/events.ts` with `AUTH_COMPLETE_EVENT` constant
  - [ ] 2.2 Update `src/hooks/usePopupAuth.ts` to use constant
  - [ ] 2.3 Update `src/contexts/ProviderContext.tsx` to use constant
  - [ ] 2.4 Update `src/App.tsx` to use constant
  - [ ] 2.5 Verify build with TypeScript

- [ ] 3.0 Create `src/constants/storage.ts` with all localStorage keys
  - [ ] 3.1 Create `src/constants/storage.ts` with complete `STORAGE_KEYS` object
  - [ ] 3.2 Verify file compiles without migration of callers yet

- [ ] 4.0 Migrate `src/contexts/ProviderContext.tsx` to use `STORAGE_KEYS`
  - [ ] 4.1 Remove local constants and add import
  - [ ] 4.2 Replace all usages with `STORAGE_KEYS.*`
  - [ ] 4.3 Verify build

- [ ] 5.0 Migrate `src/contexts/VisualEffectsContext.tsx` to use `STORAGE_KEYS`
  - [ ] 5.1 Replace all nine localStorage string literals with `STORAGE_KEYS.*`
  - [ ] 5.2 Verify build

- [ ] 6.0 Migrate remaining source files to use `STORAGE_KEYS`
  - [ ] 6.1 Update all context files (`ColorContext`, `ProfilingContext`, `VisualizerDebugContext`, `TrackContext`)
  - [ ] 6.2 Update all hook files (`useVolume`, `useVisualEffectsState`, `usePlayerState`)
  - [ ] 6.3 Update all component files (`AudioPlayer`, `PlayerContent`, `PlaylistSelection`, `VisualEffectsMenu`, `DebugOverlay`)
  - [ ] 6.4 Update provider and service files
  - [ ] 6.5 Run full build and test suite
