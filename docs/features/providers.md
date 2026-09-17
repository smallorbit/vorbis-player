# Multi-Provider Architecture

## Overview

The app abstracts music sources behind three provider interfaces (`AuthProvider`, `CatalogProvider`, `PlaybackProvider`) and a composite `ProviderDescriptor`. Two providers ship today: **Spotify** (Web Playback SDK, Premium required) and **Dropbox** (HTML5 Audio over temporary links). The queue can mix tracks from different providers.

## Domain Types

Defined in `src/types/domain.ts`.

### ProviderId

```ts
type ProviderId = 'spotify' | 'dropbox';
```

To add a new provider, extend this union first. Every domain type carries a `provider` field typed to `ProviderId`.

### MediaTrack

Provider-agnostic track. Key fields:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `string` | Unique track ID (Spotify track ID or Dropbox lowercase path) |
| `provider` | `ProviderId` | Which provider owns this track |
| `playbackRef` | `PlaybackItemRef` | Opaque ref passed to `PlaybackProvider.playTrack()` |
| `addedAt` | `number?` | Epoch ms; used for cross-provider sorting in Unified Liked Songs |
| `musicbrainzRecordingId` | `string?` | Populated from ID3 tags by Dropbox; used for radio matching |
| `albumId` | `string?` | Spotify: raw album ID. Dropbox: lowercase folder path. Used for album art cache keys |

`PlaybackItemRef` is `{ provider: ProviderId; ref: string }`. For Spotify, `ref` is a Spotify URI (`spotify:track:xxx`). For Dropbox, `ref` is the lowercase Dropbox file path.

### MediaCollection

Provider-agnostic collection. `kind` is `'playlist' | 'album' | 'folder' | 'liked'`. Dropbox uses `'album'` for folders containing audio and `'folder'` for the synthetic "All Music" collection. Display/metadata fields are neutral: `imageUrl`, `trackCount`, `ownerName`, and `revision` (a change-detection cursor, e.g. Spotify's snapshot_id at the wire level). Provider wire shapes never leave the adapter layer — `MediaCollection`/`MediaTrack` are the app-wide currency (library UI, IndexedDB cache, CmdK search).

### CollectionRef

Discriminated union referencing a collection:

```ts
type CollectionRef =
  | { provider: ProviderId; kind: 'playlist'; id: string }
  | { provider: ProviderId; kind: 'album'; id: string }
  | { provider: ProviderId; kind: 'folder'; id: string }
  | { provider: ProviderId; kind: 'liked' };  // no id field
```

Serialization: `collectionRefToKey(ref)` produces `"spotify:playlist:abc123"` or `"dropbox:liked:"`. Parse back with `keyToCollectionRef(key)`.

## Provider Interfaces

Defined in `src/types/providers.ts`.

### AuthProvider

```ts
interface AuthProvider {
  readonly providerId: ProviderId;
  isAuthenticated(): boolean;
  getAccessToken(): Promise<string | null>;
  beginLogin(options?: { popup?: boolean }): Promise<void>;
  handleCallback(url: URL): Promise<boolean>;
  logout(): void;
}
```

- `handleCallback` returns `true` if the URL was consumed as an OAuth callback for this provider. The app iterates all providers in `usePlayerLogic` calling `handleCallback` on each until one returns `true`.
- `beginLogin` supports both redirect (default) and popup (`{ popup: true }`) flows.
- Both providers use PKCE (SHA-256 code challenge). Code verifiers are stored in `localStorage`.

### CatalogProvider

```ts
interface CatalogProvider {
  readonly providerId: ProviderId;
  listCollections?(signal?: AbortSignal, options?: { forceRefresh?: boolean }): Promise<MediaCollection[]>;
  listTracks(collectionRef: CollectionRef, signal?: AbortSignal): Promise<MediaTrack[]>;
  getLikedCount?(signal?: AbortSignal): Promise<number>;
  setTrackSaved?(trackId: string, saved: boolean): Promise<void>;
  isTrackSaved?(trackId: string): Promise<boolean>;
  setAlbumSaved?(albumId: string, saved: boolean): Promise<void>;
  isAlbumSaved?(albumId: string): Promise<boolean>;
  resolveDuration?(track: MediaTrack): Promise<number | null>;
  resolveArtwork?(albumId: string, signal?: AbortSignal): Promise<string | null>;
  searchTrack?(artist: string, title: string): Promise<MediaTrack | null>;
  clearArtCache?(): Promise<void>;
  refreshArtCache?(): Promise<void>;
  exportLikes?(): Promise<string>;
  importLikes?(json: string): Promise<number>;
  refreshLikedMetadata?(): Promise<RefreshLikedMetadataResult>;
}
```

`listTracks` is the only required method. `listCollections` is optional: it is absent when a background sync engine provides library listing for that provider — the real Spotify adapter omits it, and `useLibrarySync` routes providers to the sync-engine path by that absence (everyone else, including the mock Spotify adapter, takes the catalog path). The UI checks `capabilities` flags on the descriptor before calling optional methods.

**Invariant**: `listTracks` must return `MediaTrack[]` with `provider` set to the provider's own ID and `playbackRef.provider` matching. Violating this breaks the provider resolution chain.

### PlaybackProvider

```ts
interface PlaybackProvider {
  readonly providerId: ProviderId;
  initialize(): Promise<void>;
  playTrack(track: MediaTrack, options?: { positionMs?: number }): Promise<void>;
  playCollection?(collectionRef: CollectionRef, options?: { offset?: number }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume0to1: number): Promise<void>;
  getState(): Promise<PlaybackState | null>;
  subscribe(listener: (state: PlaybackState | null) => void): () => void;
  prepareTrack?(track: MediaTrack, options?: { positionMs?: number }): void;
  probePlayable?(track: MediaTrack): Promise<boolean>;
  refreshCurrentTrackArt?(): void;
  getLastPlayTime?(): number;
  onQueueChanged?(tracks: MediaTrack[], fromIndex: number): void;
}
```

- There are no `next()`/`previous()` methods — skip is app-queue-owned. `usePlayerLogic.handleNext`/`handlePrevious` pick the target index in the app queue and call `playTrack` on the resolved provider.
- `subscribe` returns an unsubscribe function. Multiple subscribers are supported.
- `getLastPlayTime` returns epoch ms of the last `playTrack` call. Used by `useAutoAdvance` to implement a 5-second cooldown (`PLAY_COOLDOWN_MS`) that prevents false end-of-track triggers during buffering.
- `onQueueChanged` is invoked on track transitions (`useProviderPlayback.playTrack`) and on user-driven queue mutations (`useQueueManagement`), and only for providers whose descriptor declares `hasNativeQueueSync`. Spotify uses this to build upcoming URIs for native queue sync.

### PlaybackState

```ts
interface PlaybackState {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  currentTrackId: string | null;
  currentPlaybackRef: PlaybackItemRef | null;
  trackMetadata?: Partial<Pick<MediaTrack, 'name' | 'artists' | 'album' | 'image' | 'durationMs'>>;
  playbackError?: { code: number; message: string };
}
```

`trackMetadata` is a one-shot update mechanism: Dropbox populates it with ID3 tag data or cached album art, then clears it after one notification cycle. The playback store's event pipeline reads it and patches the queue track via `queueStore.mapTracks`.

## Provider Descriptor and Capabilities

```ts
interface ProviderDescriptor {
  id: ProviderId;
  name: string;
  capabilities: ProviderCapabilities;
  auth: AuthProvider;
  catalog: CatalogProvider;
  playback: PlaybackProvider;
  color?: string;                     // Brand hex, e.g. '#1db954'
  subscriptionNote?: string;          // Shown on auth screen
  icon?: ComponentType<{ size?: number }>;
  likesChangedEvent?: string;         // Window event name for real-time UI
  authStateChangedEvent?: string;     // Window event name for out-of-band auth changes
  preferencesSync?: ProviderPreferencesSync;  // Remote pins/accent-color sync
  getExternalUrl?(info): string;
  getExternalUrls?(info): Array<{ label; url; icon }>;
  savePlaylist?(name, tracks): Promise<{ url?; totalTracks; skippedTracks } | null>;
}
```

- `authStateChangedEvent` names a window event the provider dispatches when its auth state may have changed outside the shared popup flow (e.g. token revocation mid-request). Neutral contexts (`ProviderContext`) subscribe to re-evaluate connected state. Only Dropbox sets it today.
- `preferencesSync` (`{ schedulePush, initialSync, clearSyncTimestamp }`) is the optional provider-backed preferences sync extension point. Neutral code goes through the registry helpers in `src/providers/preferencesSync.ts` (`schedulePreferencesPush`, `resetPreferencesSync`) instead of importing provider modules.

### ProviderCapabilities

There is exactly one variability mechanism on the provider contract: optional-method presence. Capability flags that mirror a catalog method (`hasLikedCollection`, `hasSaveTrack`, `hasSaveAlbum`, `hasTrackSearch`) are **derived** in `registry.register()` from the adapter — a provider cannot declare them out of agreement with its methods. Providers declare only the **behavioral** flags (`DeclaredProviderCapabilities`): `hasExternalLink`, `externalLinkLabel`, `hasNativeQueueSync`, `hasContextPlaybackFallback` — flags where the method may exist as a documented no-op or the capability isn't a method at all.

| Flag | Derived from | Spotify | Dropbox | UI Effect |
|------|--------------|---------|---------|-----------|
| `hasLikedCollection` | `catalog.getLikedCount` | `true` | `true` | Shows "Liked Songs" in library |
| `hasSaveTrack` | `catalog.setTrackSaved` + `isTrackSaved` | `true` | `true` | Heart icon on tracks |
| `hasSaveAlbum` | `catalog.setAlbumSaved` + `isAlbumSaved` | `true` | -- | Save album button |
| `hasTrackSearch` | `catalog.searchTrack` | `true` | -- | Used for radio cross-provider resolution |
| `hasExternalLink` | declared | `true` | `true` | "Open in Spotify" / "Search Discogs" |
| `hasNativeQueueSync` | declared | `true` | -- | Syncs queue to Spotify's native player |
| `hasContextPlaybackFallback` | declared | `true` | -- | Context-playback fallback when `listTracks` returns 0 |

**Invariant**: Always check `capabilities` before calling optional catalog/playback methods or rendering provider-specific UI. `register()` validates declared behavioral flags against the adapter (`hasNativeQueueSync` requires `playback.onQueueChanged`; `hasContextPlaybackFallback` requires `playback.playCollection`) and throws `ProviderCapabilityMismatchError` on disagreement.

## Provider Registration

### Registry (`src/providers/registry.ts`)

Singleton `providerRegistry` backed by a `Map<ProviderId, ProviderDescriptor>`.

```ts
class ProviderRegistryImpl implements ProviderRegistry {
  private providers = new Map<ProviderId, ProviderDescriptor>();
  register(registration: ProviderRegistration): void;
  get(id: ProviderId): ProviderDescriptor | undefined;
  getAll(): ProviderDescriptor[];
  has(id: ProviderId): boolean;
}
export const providerRegistry = new ProviderRegistryImpl();
```

`register()` takes a `ProviderRegistration` (a descriptor whose `capabilities` are the declared behavioral flags only), verifies the three adapters exist, validates declared flags against the adapter, and stores a full `ProviderDescriptor` with the method-mirroring capability flags derived from catalog method presence (`deriveCapabilities`).

### Self-Registration Pattern

Each provider module calls `providerRegistry.register(registration)` at module scope. Registration happens via ES module side effects when the module is imported.

**Spotify** (`src/providers/spotify/spotifyProvider.ts`): Always registers. The descriptor is a module-level constant.

**Dropbox** (`src/providers/dropbox/dropboxProvider.ts`): Conditionally registers. The entire registration block is gated behind `if (DROPBOX_CLIENT_ID)`, where `DROPBOX_CLIENT_ID = import.meta.env.VITE_DROPBOX_CLIENT_ID ?? ''`. If the env var is missing, Dropbox never enters the registry.

### Import Trigger

`src/providers/registerProviders.ts` is the composition root — the only neutral module allowed to import provider packages:

```ts
import './spotify/spotifyProvider';
import './dropbox/dropboxProvider'; // conditionally registers if VITE_DROPBOX_CLIENT_ID is set
```

`src/contexts/ProviderContext.tsx` imports `@/providers/registerProviders`, so registration runs before the context renders. (The mock provider, when active, is loaded synchronously in `main.tsx` before render.)

## ProviderContext

`src/contexts/ProviderContext.tsx` provides the React context.

Key fields:

| Field | Type | Description |
|-------|------|-------------|
| `chosenProviderId` | `ProviderId \| null` | Stored value; `null` means show provider picker |
| `activeProviderId` | `ProviderId` | Always non-null; falls back to first registered |
| `activeDescriptor` | `ProviderDescriptor \| undefined` | Descriptor for `activeProviderId` |
| `enabledProviderIds` | `ProviderId[]` | Providers toggled on by user |
| `connectedProviderIds` | `ProviderId[]` | Subset of enabled that are authenticated |
| `needsProviderSelection` | `boolean` | `true` when no provider chosen or stored one not registered |

Auto-fallthrough: if the active provider loses auth, the context auto-switches to the next authenticated enabled provider and shows a notification.

## Active Provider vs Driving Provider

This is the most important architectural distinction in the provider system.

- **Active provider** (`activeProviderId` / `activeDescriptor`): The provider context for browsing, catalog actions, and library UI. Stored in localStorage, user-selectable.
- **Driving provider** (`drivingProviderId`): The provider currently controlling audio output. A field on the playback store's snapshot (`src/stores/playbackStore.ts`), committed by `useProviderPlayback.playTrack` via `playbackStore.setDrivingProvider()`.

**When they differ**: In a mixed queue (Unified Liked Songs, radio with cross-provider tracks), the user might have Dropbox as the active provider but the current track is a Spotify track. Playback controls (`play`, `pause`, `seek`) must route to the driving provider, not the active one; skip (next/previous) is app-queue-owned and routes each target track to its own provider via `playTrack`.

### Provider Resolution Chain

`playbackStore.resolveDrivingProviderId(trackProvider?)` is the single resolver for which provider should handle a playback operation:

```
trackProvider                     // 1. Track's own provider (preferred)
  ?? snapshot.drivingProviderId   // 2. Provider currently producing audio
  ?? activeProviderFallback       // 3. Active provider (mirrored in by usePlayerLogic
                                  //    via setActiveProviderFallback)
```

`getDrivingDescriptor(trackProvider?)` is the descriptor form of the same chain.

**Invariant**: Every `MediaTrack` in the queue MUST have a valid `provider` field. If step 1 fails, the fallbacks exist for edge cases but should not be relied upon in normal operation.

## Cross-Provider Handoff

In `useProviderPlayback.playTrack(index)`:

1. `playbackStore.resolveDrivingProviderId(mediaTrack?.provider)` determines the target provider
2. `playbackStore.beginTransition(mediaTrack.id)` raises the transition guard before any adapter call
3. `pausePreviousProvider(nextProvider)` pauses the old driving provider if it differs from the new one. This calls `.playback.pause()` on the previous provider and is fire-and-forget (`.catch(() => {})`)
4. `playbackStore.setDrivingProvider(trackProvider)` commits the new driving provider
5. `descriptor.playback.playTrack(mediaTrack)` is called on the resolved provider
6. On success, `queueStore.setCurrentIndex(index)` commits the index and `prepareTrack()` is called on the **next** track's provider (not the current one) for pre-warming

**Error handling during playback**:
- `AuthExpiredError`: Surfaces a re-auth prompt via `onAuthExpired` callback
- `UnavailableTrackError`: Auto-skips to next track if `skipOnError` is true (500ms delay)
- Generic errors: Same auto-skip behavior

## Playback Subscription (`playbackStore.attach`)

`src/stores/playbackStore.ts` owns the single fan-out subscription: `attach()` subscribes to **all registered providers** (`providerRegistry.getAll()`) and filters events by the driving provider before they enter the store's pipeline.

```ts
function handleProviderEvent(providerId: ProviderId, state: PlaybackState | null) {
  if (providerId !== resolveDrivingProviderId()) return;  // ignore events from non-driving providers
  // ... commit isPlaying/positionMs/durationMs, sync queue index, overlay trackMetadata, detect track end
}
```

### Transition guard

During track transitions, provider state updates from the old track can arrive before the new track starts playing. The store's transition guard (a private `expectedTrackId` field) protects against stale index updates:

- Raised via `playbackStore.beginTransition(trackId)` before `playTrack()` makes any adapter call
- While raised, provider index updates for other track ids are ignored
- Consumed when the expected track ID arrives in a state update
- Also dropped on `visibilitychange` (tab returns to foreground), which triggers a full resync via `getState()`

### Visibility Change Handling

When the tab returns to foreground:
1. The transition guard is dropped
2. `getState()` is called on the driving provider
3. The full state (track, position, play/pause) is run through the pipeline and resynced

This handles cases where the user interacted with the native Spotify app while the tab was backgrounded.

### Attach Lifecycle

`usePlayerLogic` attaches the store once and re-attaches when the active provider changes (`useEffect(() => playbackStore.attach(), [activeDescriptor])`), which re-primes state from whichever provider now drives. At most one attachment is live at a time. Nothing else in the app subscribes to provider playback events — React reads the store through `usePlaybackState()`.

## Auto-Advance (`useAutoAdvance`)

Track-end detection lives in `playbackStore`, which emits a `trackEnded` event (at most once per track) from two signals:

1. **Near-end**: `timeRemaining <= AUTO_ADVANCE_END_THRESHOLD_MS` (2000ms) or `position >= duration - NEAR_END_FALLBACK_MS` (1000ms)
2. **Natural end**: `wasPlaying && isPaused && position === 0 && duration > 0`

The natural-end signal has a cooldown guard: `msSinceLastPlay > PLAY_COOLDOWN_MS` (5000ms). This prevents false triggers during buffering when both Spotify SDK and HTML5 Audio briefly pause at position 0.

`lastPlayTime` is read from the driving provider's `getLastPlayTime()` method, with the store's `lastPlayInitiatedAt` (stamped by `beginTransition`) as fallback.

`src/hooks/useAutoAdvance.ts` subscribes to `trackEnded` (`playbackStore.subscribeTrackEnded`) and owns only policy: wait `AUTO_ADVANCE_DELAY_MS`, re-read the live queue from `queueStore`, stop at the end of the queue, otherwise `playTrack(nextIndex, skipOnError=true)`. Pending advances cancel when the queue or index changes.

## Spotify Implementation

### Files

| File | Purpose |
|------|---------|
| `src/providers/spotify/spotifyProvider.ts` | Assembles descriptor, registers |
| `src/providers/spotify/spotifyAuthAdapter.ts` | Delegates to `spotifyAuth` singleton |
| `src/providers/spotify/spotifyCatalogAdapter.ts` | Maps Spotify API responses to domain types |
| `src/providers/spotify/spotifyPlaybackAdapter.ts` | Wraps `spotifyPlayer` singleton |
| `src/providers/spotify/spotifyQueueSync.ts` | Syncs queue to Spotify's native player |
| `src/services/spotify/auth.ts` | `SpotifyAuth` class (PKCE, token refresh) |
| `src/services/spotify/tracks.ts` | Track API calls, batched `checkTrackSaved` |
| `src/services/spotify/api.ts` | `spotifyApiRequest`, `fetchAllPaginated` |
| `src/services/spotifyPlayer.ts` | `SpotifyPlayerService` (SDK wrapper) |
| `src/services/spotifyPlayerSdk.ts` | SDK script injection, HMR state preservation |
| `src/services/spotifyPlayerPlayback.ts` | Low-level playback commands |

### Lazy SDK Loading

The Spotify Web Playback SDK (`https://sdk.scdn.co/spotify-player.js`) is NOT loaded via a `<script>` tag in `index.html`. Instead:

1. `loadSpotifySDK()` (an exported function in `spotifyPlayerSdk.ts`, called from `SpotifyPlayerService.initialize()`) dynamically creates a `<script>` element
2. Waits for `window.onSpotifyWebPlaybackSDKReady` callback (10s timeout)
3. Only called when the Spotify provider activates (first `initialize()` call)
4. The pending promise is stored in a ref to deduplicate concurrent calls

### Token Refresh

`SpotifyAuth` (`src/services/spotify/auth.ts`):
- Token stored in localStorage as `spotify_token` (JSON with `access_token`, `refresh_token`, `expires_at`)
- `ensureValidToken()` proactively refreshes when within 5 minutes of expiry (`TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000`)
- On startup, if the access token is expired but a refresh token exists, the token data is kept so `ensureValidToken()` can refresh on first API call
- `SpotifyPlaybackAdapter.prepareTrack()` pre-warms the auth token for the next track

### API Batching (`checkTrackSaved`)

`src/services/spotify/tracks.ts` implements microtask-based batching for the "is track saved" check:

1. Each call to `checkTrackSaved(trackId)` returns a `Promise<boolean>` and pushes the ID to `_batchQueue`
2. A 50ms timer (`BATCH_COLLECT_DELAY_MS`) collects calls from the same render cycle
3. On flush, IDs are chunked into groups of 50 (`BATCH_SIZE`, Spotify API limit)
4. Each chunk makes a single `GET /me/tracks/contains?ids=...` request
5. Results are cached in `trackSavedCache` with TTL

This prevents 429 rate limiting when rendering a playlist with many tracks.

### Playback Retry Logic

`SpotifyPlaybackAdapter.playWithRetry()` handles:
- **401**: Throws `AuthExpiredError` (no retry)
- **429**: Respects `Retry-After` header, exponential backoff, up to `SPOTIFY_MAX_RETRIES` (5)
- **403 + "Restriction violated"**: Throws `UnavailableTrackError` (no retry)
- **403 (other)**: Re-transfers playback to device, exponential backoff, retries

### Fast-Path Playback

After the first successful `playTrack`, `playbackSessionActive` is set to `true`. Subsequent plays skip the full `ensurePlaybackReady()` (which includes `transferPlaybackToDevice` and `ensureDeviceIsActive` API calls) and use `ensurePlaybackReadyFastPath()` instead, which only checks local state (`getIsReady()` and `getDeviceId()`). Falls back to the full path if local state indicates the device went away.

### Native Queue Sync

`SpotifyQueueSyncService` (`src/providers/spotify/spotifyQueueSync.ts`) provides `buildUpcomingUris(tracks, fromIndex)` and `resolveTracksInBackground()`. The adapter (`spotifyPlaybackAdapter.ts`) wires them up:
- `SpotifyPlaybackAdapter.onQueueChanged` calls `spotifyQueueSync.buildUpcomingUris(tracks, fromIndex)` to build a list of upcoming Spotify URIs
- These URIs are stored on the adapter's `pendingUpcomingUris` field and passed to `spotifyPlayer.playTrack(uri, upcomingUris)` on the next play call
- Non-Spotify tracks are included only if a cached Spotify URI exists (from background resolution)
- `resolveTracksInBackground()` searches Spotify for non-Spotify tracks, caching results
- Settings: `STORAGE_KEYS.SPOTIFY_QUEUE_SYNC` (sync on/off), `STORAGE_KEYS.SPOTIFY_QUEUE_CROSS_PROVIDER` (cross-provider resolution on/off)

## Dropbox Implementation

### Files

| File | Purpose |
|------|---------|
| `src/providers/dropbox/dropboxProvider.ts` | Assembles descriptor, conditional registration |
| `src/providers/dropbox/dropboxAuthAdapter.ts` | PKCE OAuth, token refresh |
| `src/providers/dropbox/dropboxCatalogAdapter.ts` | Folder scanning, track listing |
| `src/providers/dropbox/dropboxPlaybackAdapter.ts` | HTML5 Audio, ID3 metadata enrichment |
| `src/providers/dropbox/dropboxApiClient.ts` | Authenticated Dropbox API calls |
| `src/providers/dropbox/dropboxArtworkResolver.ts` | Album art resolution (folder images, IndexedDB cache) |
| `src/providers/dropbox/dropboxArtCache.ts` | IndexedDB database (`vorbis-dropbox-art` v7) |
| `src/providers/dropbox/dropboxCatalogCache.ts` | Catalog cache in IndexedDB |
| `src/providers/dropbox/dropboxCatalogHelpers.ts` | Audio file detection, path parsing, track creation |
| `src/providers/dropbox/dropboxLikesCache.ts` | IndexedDB `likes` store, `LIKES_CHANGED_EVENT` |
| `src/providers/dropbox/dropboxLikesSync.ts` | Syncs likes to `/.vorbis/likes.json` in Dropbox |
| `src/providers/dropbox/dropboxPreferencesSync.ts` | Syncs pins + colors to `/.vorbis/preferences.json` |
| `src/providers/dropbox/dropboxPlaylistStorage.ts` | Saved playlists in `/.vorbis/playlists/` folder |
| `src/providers/dropbox/dropboxDateScanner.ts` | Background album date scanning |
| `src/providers/dropbox/dropboxSyncFolder.ts` | Ensures `/.vorbis/` folder exists |

### Folder Structure Convention

```
Dropbox root/
  <Artist>/
    <Album>/
      cover.jpg          # also: album.jpg, folder.jpg, front.jpg
      01 - Track Title.mp3
      02 - Another Track.flac
```

- A folder containing audio files = album
- Parent folder = artist name
- Track ID = lowercase file path
- Album ID = lowercase folder path
- A synthetic "All Music" collection (kind `'folder'`, id `''`) is always prepended to the collection list. It is surfaced in the playlist grid (not the album grid) via `useLibrarySync` (`allMusicCount`) and always plays shuffled. Pin behavior uses `ALL_MUSIC_PIN_ID = 'dropbox-all-music'` (distinct from the underlying collection id `''`).

### Token Refresh

`DropboxAuthAdapter` (`src/providers/dropbox/dropboxAuthAdapter.ts`):
- Tokens stored in localStorage (`STORAGE_KEYS.DROPBOX_TOKEN`, `STORAGE_KEYS.DROPBOX_REFRESH_TOKEN`, `STORAGE_KEYS.DROPBOX_TOKEN_EXPIRY`)
- `ensureValidToken()` proactively refreshes when within 60 seconds of expiry (`TOKEN_EXPIRY_BUFFER_MS = 60 * 1000`)
- Error handling in `refreshAccessToken()`:
  - **400/401**: Invalid/revoked grant. Full `logout()` (clears all tokens)
  - **5xx / network error**: Clears access token but preserves refresh token for retry
- `reportUnauthorized()`: Called by API consumers when a freshly-refreshed token still gets 401. Triggers full logout and dispatches `DROPBOX_AUTH_ERROR_EVENT` for UI notification

### HTML5 Audio Playback

`DropboxPlaybackAdapter`:
- Creates a single `HTMLAudioElement`, reused across tracks
- `playTrack()` flow:
  1. Calls `audio.play()` **synchronously** (before any `await`) for iOS Safari gesture activation
  2. Fetches temporary link via `catalog.getTemporaryLink(path)`
  3. Sets `audio.src` and plays
  4. Starts a 250ms polling interval for smooth position updates
  5. Kicks off background metadata enrichment (delayed 2s to not compete with audio buffering)
- Track advance is app-owned (`useAutoAdvance` / `handleNext`); the adapter has no skip methods
- `prepareTrack()` calls `catalog.prefetchTemporaryLink(path)` to pre-fetch the Dropbox temporary link

### ID3 Metadata Enrichment

After starting playback, `enrichMetadataInBackground()`:
1. Waits 2 seconds (`ENRICHMENT_DELAY_MS`)
2. Fetches the first 256KB of the audio file via `Range: bytes=0-262143`
3. Parses ID3 tags: title, artist, album, cover art, MusicBrainz IDs, ISRC
4. Patches metadata through `PlaybackState.trackMetadata` (consumed by the playback store's pipeline via `queueStore.mapTracks`)
5. Caches tag metadata and album art in IndexedDB

### Liked Songs

Stored in IndexedDB (`vorbis-dropbox-art` database v7, `likes` store). Each entry is `{ trackId, track: MediaTrack, likedAt: number }`.

Mutations dispatch `vorbis-dropbox-likes-changed` (the `LIKES_CHANGED_EVENT` constant) as a window event. The descriptor sets `likesChangedEvent` to this value, enabling real-time UI updates.

Sync to Dropbox: `dropboxLikesSync.ts` writes to `/.vorbis/likes.json`. Merge is last-write-wins per trackId using `likedAt` vs `deletedAt` timestamps. Tombstones have a 30-day TTL.

### Preferences Sync

`dropboxPreferencesSync.ts` syncs pinned items and accent color overrides to `/.vorbis/preferences.json`. Merge is last-write-wins by `updatedAt`. Push is debounced at 2 seconds.

## Radio Generation

### Overview

Radio is a one-shot action that builds a queue from a seed track. It is not a persistent mode.

### Pipeline (`src/services/radioPipeline.ts`)

`runRadioPipeline()` orchestrates:

1. **Fetch catalog**: `catalogProvider.listTracks()` on "All Music" (falls back to liked songs)
2. **Generate queue**: `generateRadioQueue(seed, catalogTracks)` via `radioService.ts`
3. **Cross-provider resolution**: For unmatched Last.fm suggestions, searches providers with `hasTrackSearch` capability
4. **Dedup + shuffle**: Excludes seed track, shuffles results, prepends seed as first track

### Radio Service (`src/services/radioService.ts`)

`generateRadioQueue()` supports three seed types:

| Seed | Strategy |
|------|----------|
| `track` | Get similar tracks from Last.fm, match against catalog. If < 5 matches, also fetch similar artists |
| `artist` | Get similar artists from Last.fm, find their tracks in catalog. Also includes seed artist's own tracks |
| `album` | Sample up to 5 album tracks, get similar tracks for each (3 concurrent Last.fm calls max) |

Matching uses `catalogMatcher.ts` with `CatalogIndexes`:
- Primary: MusicBrainz Recording ID (`byRecordingMbid`)
- Primary: MusicBrainz Artist ID (`byArtistMbid`)
- Fallback: normalized artist + title key (`byNormalizedKey`)
- Fallback: normalized artist name (`byNormalizedArtist`)

### Cross-Provider Resolution

In `radioPipeline.ts`, unmatched suggestions are resolved by searching all providers with `hasTrackSearch` capability:

```ts
const searchCapableProviders = searchProviders.filter(
  d => d.capabilities.hasTrackSearch && d.auth.isAuthenticated(),
);
```

Currently only Spotify has `hasTrackSearch: true`. This means a Dropbox-seeded radio can include Spotify tracks if the user is authenticated to Spotify.

### Radio Session Hook (`useRadioSession`)

`src/hooks/useRadioSession.ts` connects the pipeline to React state:
- `handleStartRadio()` runs the pipeline with the current track as seed
- On success, replaces the queue with the radio results
- Sets the playback selection to `{ type: 'radio' }` (the radio variant of `PlaybackSelection`)

## Error Types

`src/providers/errors.ts`:

```ts
class AuthExpiredError extends Error {
  readonly providerId: ProviderId;
}

class UnavailableTrackError extends Error {
  readonly trackName: string;
}
```

- `AuthExpiredError` is thrown by playback adapters when auth fails during play. `useProviderPlayback` catches it and surfaces a re-auth prompt.
- `UnavailableTrackError` is thrown for Spotify 403 "Restriction violated" (region-restricted, not available on premium, etc.). Triggers auto-skip.

## Adding a New Provider

### Steps

1. **Extend `ProviderId`** in `src/types/domain.ts` to include the new provider name

2. **Create provider directory** at `src/providers/<name>/`

3. **Implement the three interfaces**:
   - `<Name>AuthAdapter implements AuthProvider`
   - `<Name>CatalogAdapter implements CatalogProvider`
   - `<Name>PlaybackAdapter implements PlaybackProvider`

4. **Create the provider module** (`<name>Provider.ts`):
   - Assemble a `ProviderRegistration` with adapters, declared behavioral capabilities, and metadata
   - Call `providerRegistry.register(registration)` at module scope
   - Gate registration behind an env var check if the provider is optional

5. **Import the provider module** in `src/providers/registerProviders.ts` (the composition root — do not import provider packages from other neutral modules):
   ```ts
   import './<name>/<name>Provider';
   ```

6. **Declare only behavioral capabilities** (`hasExternalLink`, `externalLinkLabel`, `hasNativeQueueSync`, `hasContextPlaybackFallback`). The method-mirroring flags are derived from your catalog adapter's method presence at registration; declared flags are validated against the adapter.

7. **Map all API responses to domain types** (`MediaTrack`, `MediaCollection`). Ensure `provider` is set correctly on every object.

### Invariants to Maintain

- Every `MediaTrack` must have `provider` and `playbackRef.provider` set to the provider's ID
- `PlaybackProvider.subscribe()` must notify listeners of all state changes (play, pause, position, track change, errors)
- `PlaybackProvider.getState()` must return current state synchronously (or near-synchronously) for tab visibility resync
- `getLastPlayTime()` should return the epoch ms of the last `playTrack` call for auto-advance cooldown
- If the provider supports `onQueueChanged`, it should handle mixed-provider queues gracefully (ignore tracks from other providers)

### Common Gotchas

- **iOS Safari gesture activation**: If your playback requires an async step before playing audio (like fetching a stream URL), you must call `audio.play()` synchronously within the user gesture before the await. See `DropboxPlaybackAdapter.playTrack()`.
- **Stale state during transitions**: The playback store assumes providers may emit events for the previous track during transitions — its transition guard (raised via `playbackStore.beginTransition` before any adapter call) ignores those stale index updates. Adapters just emit truthfully; no provider-side guarding is needed.
- **Token refresh during playback**: The `prepareTrack()` method should pre-warm auth tokens to avoid refresh delays during track transitions.

## Key File Dependency Graph

```
ProviderContext.tsx
  imports: providers/registerProviders.ts   -- composition root
             -> providers/spotify/spotifyProvider.ts
             -> providers/dropbox/dropboxProvider.ts
  uses:    providers/registry.ts

usePlayerLogic.ts
  uses: useProviderPlayback.ts      -- playTrack, resumePlayback
        stores/playbackStore.ts      -- attach (single fan-out), driving-provider resolution
        stores/queueStore.ts         -- synchronous queue reads/mutations
        useAutoAdvance.ts            -- advance policy on trackEnded events
        useCollectionLoader.ts       -- loading collections into queue
        useQueueManagement.ts        -- add/remove/reorder queue
        useRadioSession.ts           -- radio generation

useProviderPlayback.ts
  uses: providers/registry.ts       -- resolve descriptor by ID
        providers/errors.ts          -- AuthExpiredError, UnavailableTrackError
        stores/playbackStore.ts      -- beginTransition, setDrivingProvider, resolveDrivingProviderId
        stores/queueStore.ts         -- queue reads, setCurrentIndex

stores/playbackStore.ts
  uses: providers/registry.ts       -- subscribe to all providers, getState, getLastPlayTime
        stores/queueStore.ts         -- index sync + metadata overlays

useAutoAdvance.ts
  uses: stores/playbackStore.ts     -- subscribeTrackEnded
        stores/queueStore.ts         -- re-read queue at advance time
```
