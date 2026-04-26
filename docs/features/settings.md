# Settings System

The settings panel is a right-side sliding drawer rendered via `createPortal` to `document.body`. It is the single entry point for all user-configurable preferences: provider management, visual effects, QAP, cache clearing, profiler, visualizer debug, and provider-specific data operations.

## Entry Point

Component: `src/components/VisualEffectsMenu/index.tsx` (exported as `AppSettingsMenu`).

Opened via:
- Gear icon on the flip menu back face
- Keyboard shortcut `O`
- `useVisualEffectsContext().setShowVisualEffects(true)`

The drawer is lazy-loaded (`React.lazy`) in two places:
- `src/components/PlayerContent/PlayerControlsSection.tsx` (when a track is loaded)
- `src/components/AudioPlayer.tsx` (when no track is loaded / idle state)

## Props Interface

```ts
interface AppSettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onClearCache: (options: ClearCacheOptions) => Promise<void>;
  profilerEnabled: boolean;
  onProfilerToggle: () => void;
  visualizerDebugEnabled: boolean;
  onVisualizerDebugToggle: () => void;
  qapEnabled: boolean;
  onQapToggle: () => void;
}
```

The component uses `React.memo` with a custom `arePropsEqual` that only compares `isOpen`, `profilerEnabled`, `visualizerDebugEnabled`, and `qapEnabled`. Callback identity changes are intentionally ignored.

## Panel Organization

The drawer content is structured top-to-bottom:

### 1. Music Sources (`MusicSourcesSection`)

File: `src/components/VisualEffectsMenu/SourcesSections.tsx`

Only renders when 2+ providers are registered. Shows each provider with:
- Name
- Status badge: `connected` / `expired` / (empty when disabled)
- Reconnect button (when enabled but not authenticated)
- Enable/disable `Switch` toggle (last enabled provider cannot be disabled)

Uses `useProviderContext()` for `registry`, `enabledProviderIds`, `toggleProvider`.

### 2. Native Queue Sync (`NativeQueueSyncSection`)

File: `src/components/VisualEffectsMenu/SourcesSections.tsx`

Only renders when a connected provider has `capabilities.hasNativeQueueSync` (currently only Spotify). Shows:
- **Queue sync toggle**: keeps Spotify's native queue synced with Vorbis playback. Key: `STORAGE_KEYS.SPOTIFY_QUEUE_SYNC` (default: `true`).
- **Cross-provider resolve toggle**: replaces non-Spotify tracks with Spotify equivalents in the synced queue. Only visible when sync is enabled AND another provider is connected. Key: `STORAGE_KEYS.SPOTIFY_QUEUE_CROSS_PROVIDER` (default: `true`).

### 3. Quick Access Panel Toggle

Inline in `index.tsx`. On/Off `OptionButton` pair that toggles the QAP preference. See [QAP section](#quick-access-panel-qap) below.

### 4. Advanced (Collapsible)

Wrapped in `CollapsibleSection` (file: `src/components/VisualEffectsMenu/CollapsibleSection.tsx`). Starts collapsed by default.

Contains:

#### Clear Library Cache

Three-state flow: `idle` -> `confirming` -> `success`.

On `confirming`, shows checkboxes:
- "Also clear Likes" (only when no provider-specific data sections exist)
- "Also clear Pins"
- "Also clear Accent Colors"

The `onClearCache` callback in `PlayerControlsSection` calls:
- `clearCacheWithOptions({ clearLikes })` from `src/services/cache/libraryCache`
- `clearAllPins()` from `src/services/settings/pinnedItemsStorage` (if clearPins)
- Removes `ACCENT_COLOR_OVERRIDES` and `CUSTOM_ACCENT_COLORS` from localStorage (if clearAccentColors)
- If pins or accent colors were cleared, resets the Dropbox preferences sync timestamp and triggers `initialSync()` to pull remote state

#### Performance Profiler

On/Off toggle. See `docs/features/profiler.md`.

Invariant: enabling the profiler disables visualizer debug mode (`vizDebugCtx.setIsDebugMode(false)`).

#### Visualizer Debug

On/Off toggle. Controlled by `VisualizerDebugContext.isDebugMode`.

Invariant: enabling visualizer debug disables the profiler (`profilerToggle()`). These two are mutually exclusive.

#### Provider Data Sections

File: `src/components/VisualEffectsMenu/ProviderDataSection.tsx`

One `ProviderDataSection` per enabled provider that has `catalog.clearArtCache` or `catalog.exportLikes`. Each is a collapsible section titled "{ProviderName} Data". Controls depend on which `CatalogProvider` capabilities exist:

| Capability | Control | Description |
|---|---|---|
| `clearArtCache` | "Clear Art Cache" button | Clears cached album art so it re-downloads |
| `refreshArtCache` | "Refresh Art" button | Clears and immediately re-fetches art; dispatches `ART_REFRESHED_EVENT` |
| `exportLikes` + `importLikes` | "Export Likes" / "Import Likes" buttons | Export: downloads JSON file. Import: opens file picker, reads JSON, calls `catalog.importLikes(json)` |
| `refreshLikedMetadata` | "Refresh Metadata" button | Re-scans provider to update metadata for liked tracks; shows count of updated/removed |

All buttons use `useAsyncAction` for loading/success state management with `FEEDBACK_DISPLAY_MS` (from `src/hooks/useAsyncAction.ts`) delay before resetting.

## Quick Access Panel (QAP)

### Storage

Key: `vorbis-player-qap-enabled` (hardcoded in `useQapEnabled`, not in `STORAGE_KEYS`).

Default: `false`.

### Hook

```ts
// src/hooks/useQapEnabled.ts
export const useQapEnabled = (): [boolean, (value: boolean) => void] => {
  return useLocalStorage<boolean>('vorbis-player-qap-enabled', false);
};
```

### Behavior

- When QAP is disabled (default): `PlayerStateRenderer` initializes `showLibrary = true`, showing the library browser (`PlaylistSelection`) in the idle/home view.
- When QAP is enabled: `PlayerStateRenderer` initializes `showLibrary = false`, showing the Quick Access Panel instead.
- The down-arrow keyboard shortcut routes to either `onOpenQuickAccessPanel` or `onOpenLibraryDrawer` based on `qapEnabled`.

### Gotcha

The QAP key is NOT centralized in `STORAGE_KEYS`. It is hardcoded as a string literal in `useQapEnabled.ts`. If you need to reference it elsewhere, use the hook or duplicate the string.

## Dropbox Preferences Sync

File: `src/providers/dropbox/dropboxPreferencesSync.ts`

Syncs two categories of local state to `/.vorbis/preferences.json` in the user's Dropbox:

1. **Pins** (unified playlists and albums) -- stored in IndexedDB via `pinnedItemsStorage`
2. **Accent overrides and custom colors** -- stored in localStorage under `ACCENT_COLOR_OVERRIDES` and `CUSTOM_ACCENT_COLORS`

### Architecture

`DropboxPreferencesSyncService` is a singleton created via `initPreferencesSync(auth)`. Access the instance via `getPreferencesSync()`.

### Remote File Format

```ts
interface RemotePreferencesFile {
  version: 1;
  updatedAt: string; // ISO 8601
  pins: { playlists: string[]; albums: string[] };
  accent: { overrides: Record<string, string>; customColors: Record<string, string> };
}
```

### Merge Strategy

Last-write-wins by `updatedAt` timestamp. Comparison:
- Remote newer than local -> apply remote to local
- Local newer than remote -> push local to remote
- Equal timestamps -> no-op

Local `updatedAt` is tracked in localStorage under `STORAGE_KEYS.PREFERENCES_SYNC_UPDATED_AT`.

### Trigger Points

- **Initial sync**: called after Dropbox OAuth completion and when Dropbox is already authenticated at app startup (in `App.tsx` and `dropboxProvider.ts`).
- **Push (debounced)**: `PinnedItemsContext` and `ColorContext` call `getPreferencesSync()?.schedulePush()` after local changes. The push is debounced by 2 seconds (`UPLOAD_DEBOUNCE_MS`).
- **After cache clear**: when pins or accent colors are cleared, `clearPreferencesSyncTimestamp()` resets the local timestamp so the next `initialSync()` pulls from remote.

### Key Files

- `src/providers/dropbox/dropboxPreferencesSync.ts` -- service class, singleton, merge logic
- `src/providers/dropbox/dropboxSyncFolder.ts` -- `ensureVorbisFolder()` helper
- `src/contexts/PinnedItemsContext.tsx` -- calls `schedulePush()` after pin mutations
- `src/contexts/ColorContext.tsx` -- calls `schedulePush()` after accent color changes

## useLocalStorage Hook

File: `src/hooks/useLocalStorage.ts`

```ts
export const useLocalStorage = <T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void]
```

Behavior:
- Reads from `localStorage` on initial render (lazy `useState` initializer)
- Writes to `localStorage` synchronously inside the setter
- Listens for cross-tab `storage` events to sync state
- JSON serializes/deserializes all values
- Catches and warns on parse/write failures; falls back to `initialValue`

Convention: all keys use the `vorbis-player-` prefix.

## Complete localStorage Key Reference

All keys from `src/constants/storage.ts` (`STORAGE_KEYS`) plus standalone keys:

| Key | Default | Type | Purpose |
|---|---|---|---|
| `vorbis-player-active-provider` | -- | `string` | Currently selected provider for browsing |
| `vorbis-player-enabled-providers` | -- | `string[]` | Provider IDs enabled in settings |
| `vorbis-player-volume` | -- | `number` | Playback volume (0-100) |
| `vorbis-player-muted` | -- | `boolean` | Mute state |
| `vorbis-player-shuffle-enabled` | -- | `boolean` | Shuffle toggle state |
| `vorbis-player-visual-effects-enabled` | `true` | `boolean` | Master glow/effects toggle |
| `vorbis-player-per-album-glow` | `{}` | `Record<string, {intensity, rate}>` | Per-album glow intensity/rate overrides |
| `vorbis-player-glow-intensity` | -- | `number` | Default glow intensity |
| `vorbis-player-glow-rate` | -- | `number` | Default glow rate |
| `vorbis-player-translucence-enabled` | `true` | `boolean` | Album art translucence effect |
| `vorbis-player-translucence-opacity` | `0.8` | `number` | Translucence opacity level |
| `vorbis-player-zen-mode-enabled` | `false` | `boolean` | Zen mode state |
| `vorbis-player-background-visualizer-enabled` | `true` | `boolean` | Background visualizer on/off |
| `vorbis-player-background-visualizer-style` | `'fireflies'` | `VisualizerStyle` | Active visualizer style |
| `vorbis-player-background-visualizer-intensity` | `40` | `number` | Visualizer intensity |
| `vorbis-player-background-visualizer-speed` | `1.0` | `number` | Visualizer speed multiplier |
| `vorbis-player-accent-color-background-preferred` | `false` | `boolean` | Use accent color as background |
| `vorbis-player-accent-color-overrides` | `{}` | `Record<string, string>` | Per-collection accent color overrides |
| `vorbis-player-custom-accent-colors` | `{}` | `Record<string, string>` | User-picked custom accent colors |
| `vorbis-player-view-mode` | -- | `string` | Library grid/list view mode |
| `vorbis-player-playlist-sort` | -- | `string` | Playlist sort preference |
| `vorbis-player-album-sort` | -- | `string` | Album sort preference |
| `vorbis-player-album-filters` | -- | -- | Album filter state |
| `vorbis-player-pinned-playlists` | -- | `string[]` | Pinned playlist IDs |
| `vorbis-player-pinned-albums` | -- | `string[]` | Pinned album IDs |
| `vorbis-player-dropbox-token` | -- | `string` | Dropbox access token |
| `vorbis-player-dropbox-refresh-token` | -- | `string` | Dropbox refresh token |
| `vorbis-player-dropbox-token-expiry` | -- | `string` | Dropbox token expiry timestamp |
| `vorbis-player-dropbox-code-verifier` | -- | `string` | PKCE code verifier (OAuth) |
| `vorbis-player-dropbox-oauth-state` | -- | `string` | OAuth state param |
| `vorbis-player-preferences-sync-updatedAt` | -- | `string` | Last sync timestamp (ISO) |
| `vorbis-player-spotify-queue-sync-enabled` | `true` | `boolean` | Spotify native queue sync |
| `vorbis-player-spotify-queue-resolve-cross-provider` | `true` | `boolean` | Replace non-Spotify tracks in synced queue |
| `vorbis-player-cache-albums` | -- | -- | Cached album data |
| `vorbis-player-cache-playlists` | -- | -- | Cached playlist data |
| `vorbis-player-liked-count-snapshots` | -- | -- | Liked song count snapshots |
| `vorbis-player-library` | -- | -- | Cached library state |
| `vorbis-player-settings` | -- | -- | General settings cache |
| `vorbis-player-profiling` | `'false'` | `string` | Profiler enabled (raw string, not JSON) |
| `vorbis-player-debug-overlay` | `'false'` | `string` | Debug overlay enabled (raw string) |
| `vorbis-player-visualizer-debug-overrides` | -- | `JSON` | Visualizer param overrides |
| `vorbis-player-devbug` | `false` | `boolean` | DevBug FAB enabled |
| `vorbis-player-qap-enabled` | `false` | `boolean` | Quick Access Panel enabled (NOT in STORAGE_KEYS) |

### Gotcha: Raw vs JSON Storage

Most keys use `useLocalStorage` which JSON-serializes values (so `true` is stored as `"true"` which `JSON.parse` reads back).

Two keys bypass `useLocalStorage` and write raw strings directly:
- `PROFILING` -- written with `localStorage.setItem(key, String(next))` in `ProfilingContext`. Read with `=== 'true'` comparison.
- `DEBUG_OVERLAY` -- written with `localStorage.setItem(key, String(enabled))`. Read with `=== 'true'` comparison.

These are compatible because `JSON.parse('"true"')` and `'true' === 'true'` both work, but be aware if mixing read methods.

## Key Files

| File | Role |
|---|---|
| `src/components/VisualEffectsMenu/index.tsx` | Settings drawer component |
| `src/components/VisualEffectsMenu/SourcesSections.tsx` | Music Sources + Queue Sync sections |
| `src/components/VisualEffectsMenu/ProviderDataSection.tsx` | Per-provider data management |
| `src/components/VisualEffectsMenu/CollapsibleSection.tsx` | Generic collapsible section wrapper |
| `src/components/VisualEffectsMenu/styled.ts` | All styled-components for the drawer |
| `src/constants/storage.ts` | `STORAGE_KEYS` constant object |
| `src/hooks/useLocalStorage.ts` | Generic localStorage hook with cross-tab sync |
| `src/hooks/useQapEnabled.ts` | QAP preference hook |
| `src/contexts/VisualEffectsContext.tsx` | Visual effects state (glow, visualizer, translucence, zen) |
| `src/providers/dropbox/dropboxPreferencesSync.ts` | Dropbox preferences sync service |
| `src/components/PlayerContent/PlayerControlsSection.tsx` | Wires settings props from contexts to the drawer |
