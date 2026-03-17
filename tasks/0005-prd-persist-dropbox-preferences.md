# PRD: Persist Dropbox User Preferences to Cloud Storage

## Introduction/Overview

Likes for Dropbox are already synced to `/.vorbis/likes.json` (PR 316). Users who rely on Dropbox also have other preferences that are currently local-only: **pinned** playlists/albums, **accent color** overrides (and related accent settings), and **visual effects** settings (glow, background visualizer, translucence, zen mode, etc.). This feature syncs those preferences to a single file in the user's Dropbox (`/.vorbis/preferences.json`) so that pins, accent colors, and visual effects behavior are consistent across devices when the user logs in with the same Dropbox account.

## Goals

1. Persist **pins** (unified pinned playlists and albums) to Dropbox so they sync across devices.
2. Persist **accent color** preferences (overrides, custom accent colors, accent-color-background preference) to Dropbox.
3. Persist **visual effects** preferences (enabled state, per-album glow, background visualizer style/intensity, translucence, zen mode, glow intensity/rate) to Dropbox.
4. Reuse the same `.vorbis` folder and sync patterns established for likes (download on load, debounced push on change, 401 retry, ensure folder exists on 409).
5. Keep a single preferences file and a simple merge strategy so the feature stays maintainable.

## User Stories

- As a user, I want my pinned playlists and albums to appear on any device where I use the app with Dropbox.
- As a user, I want my custom accent colors and album-specific overrides to follow me across devices.
- As a user, I want my visual effects settings (glow, background style, translucence, zen mode) to be the same on every device when I'm using Dropbox.
- As a user, I expect preference changes to feel instant locally, with sync happening in the background.

## Scope: What Gets Synced

### Already synced (out of scope for this PRD)

- **Likes** — `/.vorbis/likes.json` (see PR 316).

### In scope for this PRD

| Category        | Current storage | Sync to Dropbox |
|----------------|------------------|------------------|
| **Pins**       | IndexedDB `vorbis-player-settings`, store `pins`, keys `_unified:playlists`, `_unified:albums` | `preferences.pins` (playlists, albums arrays) |
| **Accent**     | localStorage `vorbis-player-accent-color-overrides`, `vorbis-player-custom-accent-colors`; `vorbis-player-accent-color-background-preferred` is stored under visualEffects in the file | `preferences.accent` (overrides, customColors); accentColorBackgroundPreferred in `preferences.visualEffects` |
| **Visual effects** | localStorage: `vorbis-player-visual-effects-enabled`, `vorbis-player-per-album-glow`, `vorbis-player-background-visualizer-*`, `vorbis-player-translucence-*`, `vorbis-player-zen-mode-enabled`, `vorbis-player-glow-intensity`, `vorbis-player-glow-rate` | `preferences.visualEffects` (all of the above as a structured object) |

## Functional Requirements

1. **Single file**: Store all preferences in `/.vorbis/preferences.json` with a version and `updatedAt` timestamp.
2. **On app load** (when Dropbox is authenticated): Download `preferences.json`, merge with local state using last-write-wins by `updatedAt` (remote newer → apply remote to local; local newer → push local to remote after applying any new remote keys we don't have). *Alternative (simpler):* last-write-wins for the whole document — if remote `updatedAt` &gt; local, overwrite local with remote; else overwrite remote with local on next push.
3. **On local change** (pins, accent, or visual effects): Update local storage/IDB immediately, set local `updatedAt`, then schedule a debounced push (e.g. 2s) to Dropbox.
4. **Ensure folder**: On upload 409 (path/not_found or parent missing), create `/.vorbis` via Dropbox API then retry upload (same pattern as likes sync).
5. **Auth**: Use same 401-retry and token refresh as likes sync; only run when Dropbox is configured and authenticated.
6. **Merge strategy**: Document-level last-write-wins by `updatedAt` is sufficient for v1 (no per-section merging). If we need to avoid overwriting unrelated sections later, we can introduce per-section `updatedAt` in a future version.

## Non-Goals

- Syncing provider-agnostic settings that are not tied to “my Dropbox experience” (e.g. volume, mute, shuffle, active provider) — can be considered later.
- Real-time push from other devices; user must reload or re-open app to see changes from another device.
- Conflict resolution beyond last-write-wins (e.g. no CRDTs or multi-device merge UI).
- UI for “preferences sync status” (optional later).

## Technical Considerations

- Reuse `/.vorbis` folder; no new folder.
- New sync service (e.g. `DropboxPreferencesSyncService`) in `src/providers/dropbox/`, or extend a small “Dropbox sync” module that already has `ensureSyncFolder` and upload/download helpers. Prefer a dedicated service for preferences so the file shape and merge logic stay clear.
- **Read path**: On initial sync, read from IndexedDB (pins) and localStorage (accent, visual effects) to build “local” preferences; download remote; compare `updatedAt`; apply winner to local (write back to IDB and localStorage).
- **Write path**: On pin/accent/visual-effects change, update local storage as today, then call something like `getPreferencesSync()?.schedulePush()`. Push reads current state from IDB + localStorage, builds payload, uploads.
- **Pins**: Today pins are read/written via `pinnedItemsStorage` (getPins/setPins with `UNIFIED_PROVIDER`). Sync service should call getPins/setPins for the unified provider when reading/writing the `pins` section of preferences.
- **Accent / Visual effects**: Stored in localStorage with `vorbis-player-*` keys. Sync service must read/write those keys (or go through a small adapter so we don’t scatter key names). Prefer a single “preferences adapter” that maps between localStorage keys and the JSON shape.
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
  },
  "visualEffects": {
    "visualEffectsEnabled": true,
    "perAlbumGlow": { "albumId": { "intensity": 0.5, "rate": 1 } },
    "backgroundVisualizerEnabled": true,
    "backgroundVisualizerStyle": "fireflies",
    "backgroundVisualizerIntensity": 60,
    "accentColorBackgroundPreferred": false,
    "translucenceEnabled": false,
    "translucenceOpacity": 0.8,
    "zenModeEnabled": false,
    "glowIntensity": 0.6,
    "glowRate": 1
  }
}
```

Store `accentColorBackgroundPreferred` only under `visualEffects` in the file to avoid duplication.

## Success Metrics

- Pins, accent overrides/custom colors, and visual effects settings persist across browser sessions and devices when using Dropbox.
- Changes to pins, accent, or visual effects still feel instant; sync does not block the UI.
- No regression to existing likes sync or Dropbox auth behavior.
