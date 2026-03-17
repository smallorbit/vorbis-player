# Tasks: Persist Dropbox User Preferences to Cloud Storage

Scope: **pins** and **accent** (overrides, custom colors) only. Visual effects (glow, translucence, visualizer, etc.) and volume are out of scope for now.

## Relevant Files (expected)

- `src/providers/dropbox/dropboxPreferencesSync.ts` — NEW: sync service (download, upload, merge, debounce, ensure folder)
- `src/providers/dropbox/dropboxPreferencesAdapter.ts` — NEW (optional): read/write preferences payload from/to pins storage + accent localStorage keys
- `src/providers/dropbox/dropboxProvider.ts` — Initialize preferences sync, trigger initial sync when Dropbox authenticated
- `src/App.tsx` — Trigger initial preferences sync after Dropbox OAuth callback (if not already triggered from provider init)
- `src/services/settings/pinnedItemsStorage.ts` — No schema change; sync service will call getPins/setPins(UNIFIED_PROVIDER, …)
- `src/contexts/PinnedItemsContext.tsx` — After setPins, call preferences sync schedulePush
- `src/contexts/ColorContext.tsx` — After accent overrides/custom colors change, call preferences sync schedulePush
- `src/providers/dropbox/__tests__/dropboxPreferencesSync.test.ts` — NEW: tests for merge, download/upload, 409→folder create→retry, initial sync, debounce

### Notes

- Reuse `/.vorbis` folder; ensure folder on 409 as in likes sync.
- Preferences file: `/.vorbis/preferences.json`. Merge: last-write-wins by `updatedAt`.
- Run `npm run test:run` and `npx tsc --noEmit` before pushing.

## Tasks

- [x] 1.0 Define preferences payload and adapter
  - [x] 1.1 Define TypeScript types for `RemotePreferencesFile` (version, updatedAt, pins, accent) matching PRD JSON shape (pins + accent only; no visualEffects)
  - [x] 1.2 Create adapter (or inline in sync service) that builds preferences from: getPins(UNIFIED_PROVIDER, 'playlists'|'albums'), and localStorage keys for accent (overrides, customColors)
  - [x] 1.3 Adapter: apply remote preferences to local — setPins(UNIFIED_PROVIDER, …), and set accent localStorage keys

- [x] 2.0 Create Dropbox preferences sync service
  - [x] 2.1 Create `dropboxPreferencesSync.ts` with `DropboxPreferencesSyncService` class; constructor(auth); constants for path `/.vorbis/preferences.json`, debounce 2s
  - [x] 2.2 Implement `downloadPreferencesFile()` — Dropbox content API download, 401 retry, 409 → null (no file yet)
  - [x] 2.3 Implement `uploadPreferencesFile(data)` — ensure token, upload; on 409 call existing ensureSyncFolder (or inline create_folder_v2 for `/.vorbis`) then retry upload; 401 retry
  - [x] 2.4 Implement merge: compare remote `updatedAt` vs local (read current prefs, get updatedAt from last sync e.g. localStorage `vorbis-player-preferences-sync-updatedAt`); if remote newer, apply remote to local via adapter; if local newer or no remote, keep local and schedule push
  - [x] 2.5 Implement `initialSync()` — download, build local snapshot + updatedAt, merge (apply winner to local), then if local was winner or had changes, push
  - [x] 2.6 Implement `schedulePush()` (debounce 2s) and `doPush()` — build current preferences from adapter, set updatedAt, upload; on success optionally store last pushed updatedAt
  - [x] 2.7 Export singleton: `initPreferencesSync(auth)`, `getPreferencesSync()`

- [x] 3.0 Wire sync into provider and app
  - [x] 3.1 In `dropboxProvider.ts`, call `initPreferencesSync(auth)`; when Dropbox is already authenticated, call `catalog.initializeSync()` (or a new `initializePreferencesSync()`) so initial sync runs for returning users
  - [x] 3.2 In `App.tsx`, after Dropbox OAuth callback success, call `getPreferencesSync()?.initialSync().catch(...)` so new logins get initial sync
  - [x] 3.3 After pins change: from PinnedItemsContext (or pinnedItemsStorage layer), call `getPreferencesSync()?.schedulePush()` after setPins
  - [x] 3.4 After accent overrides/custom colors change: from ColorContext, call `getPreferencesSync()?.schedulePush()`

- [x] 4.0 Tests
  - [x] 4.1 Unit tests for merge (remote newer → apply remote; local newer → no apply; missing remote → keep local)
  - [x] 4.2 Unit tests for build-preferences-from-local and apply-remote-to-local (adapter or sync service)
  - [x] 4.3 Download/upload tests with mocked fetch (success, 401 retry, 409 then create folder and retry)
  - [x] 4.4 initialSync and schedulePush debounce tests

- [x] 5.0 Build and docs
  - [x] 5.1 Run `npx tsc --noEmit` and fix type errors
  - [x] 5.2 Run `npm run test:run` and fix failures
  - [x] 5.3 Run `npm run build`
  - [x] 5.4 Update CLAUDE.md or AGENTS.md if new patterns (e.g. “Dropbox preferences sync”) should be documented
