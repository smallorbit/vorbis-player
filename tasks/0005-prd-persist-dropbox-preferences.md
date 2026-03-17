# PRD: Persist Dropbox User Preferences to Cloud Storage

## Introduction/Overview

Likes for Dropbox are already synced to `/.vorbis/likes.json` (PR 316). Users who rely on Dropbox also have other preferences that are currently local-only: **pinned** playlists/albums and **accent color** overrides (and custom accent colors). This feature syncs those preferences to a single file in the user's Dropbox (`/.vorbis/preferences.json`) so that pins and accent colors are consistent across devices when the user logs in with the same Dropbox account. Visual effects (glow, translucence, visualizer, etc.) and volume are out of scope for now and can be followed up later.

## Goals

1. Persist **pins** (unified pinned playlists and albums) to Dropbox so they sync across devices.
2. Persist **accent color** preferences (overrides and custom accent colors) to Dropbox.
3. Reuse the same `.vorbis` folder and sync patterns established for likes (download on load, debounced push on change, 401 retry, ensure folder exists on 409).
4. Keep a single preferences file and a simple merge strategy so the feature stays maintainable.

## User Stories

- As a user, I want my pinned playlists and albums to appear on any device where I use the app with Dropbox.
- As a user, I want my custom accent colors and album-specific overrides to follow me across devices.
- As a user, I expect preference changes to feel instant locally, with sync happening in the background.

## Scope: What Gets Synced

### Already synced (out of scope for this PRD)

- **Likes** — `/.vorbis/likes.json` (see PR 316).

### In scope for this PRD

| Category   | Current storage | Sync to Dropbox |
|-----------|------------------|------------------|
| **Pins**  | IndexedDB `vorbis-player-settings`, store `pins`, keys `_unified:playlists`, `_unified:albums` | `preferences.pins` (playlists, albums arrays) |
| **Accent**| localStorage `vorbis-player-accent-color-overrides`, `vorbis-player-custom-accent-colors` | `preferences.accent` (overrides, customColors) |

## Functional Requirements

1. **Single file**: Store all preferences in `/.vorbis/preferences.json` with a version and `updatedAt` timestamp.
2. **On app load** (when Dropbox is authenticated): Download `preferences.json`, merge with local state using last-write-wins by `updatedAt` (remote newer → apply remote to local; local newer → push local to remote after applying any new remote keys we don't have). *Alternative (simpler):* last-write-wins for the whole document — if remote `updatedAt` &gt; local, overwrite local with remote; else overwrite remote with local on next push.
3. **On local change** (pins or accent): Update local storage/IDB immediately, set local `updatedAt`, then schedule a debounced push (e.g. 2s) to Dropbox.
4. **Ensure folder**: On upload 409 (path/not_found or parent missing), create `/.vorbis` via Dropbox API then retry upload (same pattern as likes sync).
5. **Auth**: Use same 401-retry and token refresh as likes sync; only run when Dropbox is configured and authenticated.
6. **Merge strategy**: Document-level last-write-wins by `updatedAt` is sufficient for v1 (no per-section merging). If we need to avoid overwriting unrelated sections later, we can introduce per-section `updatedAt` in a future version.

## Non-Goals

- **Volume, mute** — out of scope; can be considered later.
- **Visual effects** — glow, translucence, background visualizer, zen mode, per-album glow, etc. Out of scope for this PRD; follow up later.
- Syncing other provider-agnostic settings (e.g. shuffle, active provider) — can be considered later.
- Real-time push from other devices; user must reload or re-open app to see changes from another device.
- Conflict resolution beyond last-write-wins (e.g. no CRDTs or multi-device merge UI).
- UI for “preferences sync status” (optional later).

## Technical Considerations

- Reuse `/.vorbis` folder; no new folder.
- New sync service (e.g. `DropboxPreferencesSyncService`) in `src/providers/dropbox/`, or extend a small “Dropbox sync” module that already has `ensureSyncFolder` and upload/download helpers. Prefer a dedicated service for preferences so the file shape and merge logic stay clear.
- **Read path**: On initial sync, read from IndexedDB (pins) and localStorage (accent keys) to build “local” preferences; download remote; compare `updatedAt`; apply winner to local (write back to IDB and localStorage).
- **Write path**: On pin or accent change, update local storage as today, then call something like `getPreferencesSync()?.schedulePush()`. Push reads current state from IDB + localStorage, builds payload, uploads.
- **Pins**: Today pins are read/written via `pinnedItemsStorage` (getPins/setPins with `UNIFIED_PROVIDER`). Sync service should call getPins/setPins for the unified provider when reading/writing the `pins` section of preferences.
- **Accent**: Stored in localStorage (`vorbis-player-accent-color-overrides`, `vorbis-player-custom-accent-colors`). Sync service reads/writes those keys via a small adapter so key names stay in one place.
- **Versioning**: Include `version: 1` in `preferences.json` so we can evolve the schema later (e.g. add sections or per-section `updatedAt`).

## File Format: `/.vorbis/preferences.json`

```json
{
  "version": 1,
  "updatedAt": "2026-03-17T14:00:00.000Z",
  "pins": {
    "playlists": ["id1", "id2"],
    "albums": ["idA", "idB"]
  },
  "accent": {
    "overrides": { "albumId1": "#hex", "albumId2": "#hex" },
    "customColors": { "albumId1": "#hex" }
  }
}
```

## Success Metrics

- Pins and accent overrides/custom colors persist across browser sessions and devices when using Dropbox.
- Changes to pins or accent still feel instant; sync does not block the UI.
- No regression to existing likes sync or Dropbox auth behavior.
