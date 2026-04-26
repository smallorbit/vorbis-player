# Multi-Provider Architecture

## Provider model

Defined in `src/types/providers.ts` and `src/types/domain.ts`.

- **Provider interfaces**: `AuthProvider`, `CatalogProvider`, `PlaybackProvider`
- **Registration**: `src/providers/registry.ts` — singleton `providerRegistry`; providers self-register on import
- **Dropbox** only registers when `VITE_DROPBOX_CLIENT_ID` is set

**Domain types** (`src/types/domain.ts`):

- `MediaTrack` — provider-agnostic track with `playbackRef`
- `MediaCollection` — provider-agnostic collection (playlist or album)
- `CollectionRef` — `{ provider, kind, id }`; serialized via `collectionRefToKey` / `keyToCollectionRef`

**Capability-aware UI**: check `activeDescriptor.capabilities` before rendering provider-specific controls (`hasSaveTrack`, `hasExternalLink`, `hasLikedCollection`). Both Spotify and Dropbox support `hasSaveTrack` and `hasLikedCollection`.

## Provider toggle (Music Sources section in settings)

- Each provider row has a single on/off toggle — there is no separate Reconnect button.
- `enabledProviderIds` — localStorage-persisted set of providers the user has opted into.
- `connectedProviderIds` — derived set: `enabledProviderIds` ∩ authenticated providers. Used by cross-provider features (Unified Liked Songs, radio resolver).
- Toggle-OFF: opens `ProviderDisconnectDialog` showing the provider name and count of queued tracks that will be removed. Confirming calls `logout()`, removes the provider from `enabledProviderIds`, and cleans up queue/playback state. The last enabled provider's toggle is disabled to prevent a zero-provider state.
- Toggle-ON when already authenticated: silently adds to `enabledProviderIds`.
- Toggle-ON when not authenticated: calls `beginLogin({ popup: true })` immediately. The provider is added to `enabledProviderIds` only after the OAuth popup reports success via `AUTH_COMPLETE_EVENT`.
- OAuth cancel/failure: toggle reverts; a toast shows `"Couldn't connect to {provider}. Try again."`.
- Mid-session unrecoverable 401: `logout()` is called automatically; a toast shows `"{Provider} disconnected — session expired."`.
- Implementation: `src/components/VisualEffectsMenu/SourcesSections.tsx` (`MusicSourcesSection`).

## Unified playback across providers

- Queue items are represented as provider-agnostic `MediaTrack` records and can mix Spotify + Dropbox tracks in one queue.
- Provider model:
  - **Active provider** = selected provider context for browsing/catalog actions.
  - **Driving provider** = provider currently controlling audio output.
  - These can differ in mixed queues (Unified Liked Songs, radio, cross-provider handoff).
- Playback controls (`play`, `pause`, `next`, `previous`) route via the **driving provider**, not just the active provider.
- Provider state subscriptions are multiplexed and filtered by the **driving provider** so visualizer/play state stays in sync.
- Routing structure:
  - `useProviderPlayback` resolves provider per index (`track.provider` → `drivingProviderRef` → `activeDescriptor.id` fallback).
  - `usePlayerLogic` owns control actions and playback-state synchronization using `getDrivingProviderId()`.
  - `useAutoAdvance` advances based on events from the current driving provider.
- Unified liked songs can merge liked tracks from all connected providers (`connectedProviderIds`) and sort by `addedAt`.

## Radio generation

- Radio is a one-shot action (not a sticky toggle) that builds a playlist from the current track.
- `useRadio` + `radioService` generate suggestions from Last.fm, then match against the active provider catalog.
- Unmatched suggestions can be resolved via Spotify search (`spotifyResolver`) when authenticated and Spotify is in `connectedProviderIds`.
- Provider switches during radio now follow the same driving-provider routing (no special queue handoff modal).
- **Track name context menu**: clicking the track name (in both normal and zen mode) opens a `TrackRadioPopover` with a single "Play {trackName} Radio" option. This mirrors the existing artist/album popover pattern (`TrackInfoPopover`). The option is disabled with a tooltip when Last.fm is not configured. Components: `TrackRadioPopover.tsx` (popover wrapper), `TrackInfo.tsx` (normal mode), `AlbumArtSection.tsx` (zen mode).

## Provider implementation details

### Dropbox folder structure

```
Dropbox root/
└── <Artist>/<Album>/
    ├── cover.jpg     # also: album.jpg, folder.jpg, front.jpg
    └── 01 - Track.mp3
```

Folders containing audio files become albums; parent folder = artist. A synthetic "All Music" collection (kind `'folder'`, id `''`) is always prepended.

### Dropbox "All Music" card

`useLibrarySync.splitCollections` intercepts the All Music collection and exposes its track total as `allMusicCount` instead of pushing it into the album list. `AllMusicCard` (`src/components/PlaylistSelection/AllMusicCard.tsx`) renders the row in the **playlist grid** at the top anchor slot, alongside `LikedSongsCard`. The card uses a Dropbox-tinted gradient and a crossed-arrows shuffle SVG glyph in both grid and list layouts; subtitle is `"{N} tracks • Shuffled"`. Hidden when Dropbox is not in `enabledProviderIds` or excluded by the provider filter chip. Pin/unpin uses `ALL_MUSIC_PIN_ID = 'dropbox-all-music'` (a stable identifier distinct from the underlying collection id `''`) and persists through `PinnedItemsContext` like any other pin. The legacy `id === ''` entries in `LIBRARY_PLAYLIST_SORT_ANCHOR_IDS` and `LIBRARY_ALBUM_SORT_ANCHOR_IDS` are retired — All Music is no longer mixed into the sortable lists, so it does not need a sort-anchor exemption.

### All Music shuffle-by-default

Loading or appending the All Music aggregate always shuffles, independently of the global `shuffleEnabled` toggle. Detection uses `isAllMusicRef(collectionRef)` from `src/constants/playlist.ts`. `useCollectionLoader.applyTracks` accepts a `forceShuffle` option that ORs with `shuffleEnabled`; `loadCollection` passes `{ forceShuffle: isAllMusicRef(ref) }`. `useQueueManagement.handleAddToQueue` shuffles the fetched tracks with `shuffleArray()` before deduping and appending. The user's `shuffleEnabled` preference is not mutated — it remains whatever they set globally.

### Dropbox Liked Songs

Stored in IndexedDB (`vorbis-dropbox-art` database v3, `likes` store). Mutations dispatch `vorbis-dropbox-likes-changed` events for real-time UI updates. Settings menu exposes Export/Import (JSON) and Refresh Metadata operations.

### Dropbox preferences sync

Pins (unified playlists/albums) and accent overrides/custom colors are synced to `/.vorbis/preferences.json`. Merge is last-write-wins by `updatedAt`. `dropboxPreferencesSync.ts` provides `initPreferencesSync(auth)`, `getPreferencesSync()`, `initialSync()`, and `schedulePush()` (2s debounce). PinnedItemsContext and ColorContext call `schedulePush()` after local changes; App and provider trigger `initialSync()` after Dropbox OAuth and when already authenticated.

### Token refresh

Both providers preserve refresh tokens during transient failures and proactively refresh before expiry. Spotify uses a 5-minute buffer; Dropbox uses a 60-second buffer. On 401/400 errors Dropbox performs full logout; on 5xx or network errors it preserves the refresh token for retry.

### Spotify SDK loading

The Spotify Web Playback SDK is loaded lazily by `SpotifyPlayerService.loadSDK()` — no global script tag in `index.html`. The SDK is only injected when the Spotify provider activates.

### Spotify API batching

`checkTrackSaved` in `src/services/spotify/tracks.ts` uses microtask-based batching — concurrent calls within the same render cycle are collected and flushed as a single `/me/tracks/contains` request (up to 50 IDs per Spotify API limit), preventing 429 rate limiting.
