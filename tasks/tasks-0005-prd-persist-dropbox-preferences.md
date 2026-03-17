# Tasks: Persist Dropbox User Preferences to Cloud Storage

## Relevant Files (expected)

- `src/providers/dropbox/dropboxPreferencesSync.ts` — NEW: sync service (download, upload, merge, debounce, ensure folder)
- `src/providers/dropbox/dropboxPreferencesAdapter.ts` — NEW (optional): read/write preferences payload from/to pins storage + localStorage keys (single place for key names and shape)
- `src/providers/dropbox/dropboxProvider.ts` — Initialize preferences sync, trigger initial sync when Dropbox authenticated
- `src/App.tsx` — Trigger initial preferences sync after Dropbox OAuth callback (if not already triggered from provider init)
- `src/services/settings/pinnedItemsStorage.ts` — No schema change; sync service will call getPins/setPins(UNIFIED_PROVIDER, …)
- `src/contexts/PinnedItemsContext.tsx` — After setPins, call preferences sync schedulePush (or adapter exposes a “preferences changed” callback)
- `src/contexts/ColorContext.tsx` — After accent overrides/custom colors change, notify preferences sync (or sync layer subscribes to storage)
- `src/contexts/VisualEffectsContext.tsx` — After any visual effect setting change, notify preferences sync
- `src/hooks/useVisualEffectsState.ts` — After glow intensity/rate change, notify preferences sync
- `src/providers/dropbox/__tests__/dropboxPreferencesSync.test.ts` — NEW: tests for merge, download/upload, 409→folder create→retry, initial sync, debounce

### Notes

- Reuse `/.vorbis` folder; ensure folder on 409 as in likes sync.
- Preferences file: `/.vorbis/preferences.json`. Merge: last-write-wins by `updatedAt`.
- Run `npm run test:run` and `npx tsc --noEmit` before pushing.

## Tasks

- [ ] 1.0 Define preferences payload and adapter
  - [ ] 1.1 Define TypeScript types for `RemotePreferencesFile` (version, updatedAt, pins, accent, visualEffects) matching PRD JSON shape
  - [ ] 1.2 Create adapter (or inline in sync service) that builds preferences from: getPins(UNIFIED_PROVIDER, 'playlists'|'albums'), and localStorage keys for accent + visual effects (list all keys in one place)
  - [ ] 1.3 Adapter: apply remote preferences to local — setPins(UNIFIED_PROVIDER, …), and set each localStorage key for accent and visual effects

- [ ] 2.0 Create Dropbox preferences sync service
  - [ ] 2.1 Create `dropboxPreferencesSync.ts` with `DropboxPreferencesSyncService` class; constructor(auth); constants for path `/.vorbis/preferences.json`, debounce 2s
  - [ ] 2.2 Implement `downloadPreferencesFile()` — Dropbox content API download, 401 retry, 409 → null (no file yet)
  - [ ] 2.3 Implement `uploadPreferencesFile(data)` — ensure token, upload; on 409 call existing ensureSyncFolder (or inline create_folder_v2 for `/.vorbis`) then retry upload; 401 retry
  - [ ] 2.4 Implement merge: compare remote `updatedAt` vs local (read current prefs, get updatedAt from last sync e.g. localStorage `vorbis-player-preferences-sync-updatedAt`); if remote newer, apply remote to local via adapter; if local newer or no remote, keep local and schedule push
  - [ ] 2.5 Implement `initialSync()` — download, build local snapshot + updatedAt, merge (apply winner to local), then if local was winner or had changes, push
  - [ ] 2.6 Implement `schedulePush()` (debounce 2s) and `doPush()` — build current preferences from adapter, set updatedAt, upload; on success optionally store last pushed updatedAt
  - [ ] 2.7 Export singleton: `initPreferencesSync(auth)`, `getPreferencesSync()`

- [ ] 3.0 Wire sync into provider and app
  - [ ] 3.1 In `dropboxProvider.ts`, call `initPreferencesSync(auth)`; when Dropbox is already authenticated, call `catalog.initializeSync()` (or a new `initializePreferencesSync()`) so initial sync runs for returning users
  - [ ] 3.2 In `App.tsx`, after Dropbox OAuth callback success, call `getPreferencesSync()?.initialSync().catch(...)` so new logins get initial sync
  - [ ] 3.3 After pins change: from PinnedItemsContext (or pinnedItemsStorage layer), call `getPreferencesSync()?.schedulePush()` after setPins
  - [ ] 3.4 After accent overrides/custom colors change: from ColorContext or a single “preferences changed” subscription, call `getPreferencesSync()?.schedulePush()`
  - [ ] 3.5 After visual effects or glow settings change: from VisualEffectsContext and useVisualEffectsState (or a shared preferences-write path), call `getPreferencesSync()?.schedulePush()`

- [ ] 4.0 Tests
  - [ ] 4.1 Unit tests for merge (remote newer → apply remote; local newer → no apply; missing remote → keep local)
  - [ ] 4.2 Unit tests for build-preferences-from-local and apply-remote-to-local (adapter or sync service)
  - [ ] 4.3 Download/upload tests with mocked fetch (success, 401 retry, 409 then create folder and retry)
  - [ ] 4.4 initialSync and schedulePush debounce tests

- [ ] 5.0 Build and docs
  - [ ] 5.1 Run `npx tsc --noEmit` and fix type errors
  - [ ] 5.2 Run `npm run test:run` and fix failures
  - [ ] 5.3 Run `npm run build`
  - [ ] 5.4 Update CLAUDE.md or AGENTS.md if new patterns (e.g. “Dropbox preferences sync”) should be documented
