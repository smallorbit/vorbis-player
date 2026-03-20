# Implementation Plan: Spotify Adapter Migration (Multi-Provider)

> **Status:** Ready for Implementation  
> **Depends on:** [PRD Dropbox Provider](/Users/roman/src/vorbis-player/docs/prd-dropbox-provider.md), provider contracts in `src/types/domain.ts` and `src/types/providers.ts`  
> **Estimated effort:** Phased over multiple PRs  
> **Created:** March 2025

## Overview

Migrate the app from direct Spotify coupling to a provider-based architecture. Spotify remains the only provider initially; all Spotify-specific logic is wrapped behind `AuthProvider`, `CatalogProvider`, and `PlaybackProvider` implementations so that hooks and components depend on provider interfaces, not `spotifyAuth` / `spotifyPlayer` / `services/spotify` directly. No user-visible behavior change for Spotify.

## Goals

- No app-level hook or component imports `spotifyAuth`, `spotifyPlayer`, or Spotify API types for playback/catalog flow.
- Spotify behavior (auth, library, playback, seek, volume, like/save) remains functionally equivalent.
- Clear path to add Dropbox (and later other providers) by implementing the same contracts.

## Current Coupling (Summary)

| Layer        | Files / entry points |
|-------------|----------------------|
| **Bootstrap** | `App.tsx` (auth callback path, `spotifyAuth.handleRedirect`), `main.tsx`, `index.html` (Spotify SDK script) |
| **Services**  | `services/spotify.ts` (auth + API + types), `services/spotifyPlayer.ts` (SDK), `services/cache/librarySyncEngine.ts`, `libraryCache.ts`, `cacheTypes.ts` |
| **Hooks**     | `usePlaylistManager`, `useSpotifyPlayback`, `useSpotifyControls`, `usePlayerLogic`, `useAutoAdvance`, `useVolume`, `useLibrarySync`, `useLikeTrack` |
| **Contexts**  | `TrackContext` (uses `Track` from spotify) |
| **Components**| `PlayerStateRenderer`, `PlaylistSelection`, `SpotifyPlayerControls`, `TrackInfo`, `QueueTrackList`, `AlbumArt`, etc. |

## Migration Order (Incremental, No Big Bang)

### Step 1: Spotify adapter module (new code only)

- **Add** `src/providers/spotify/` (or `src/adapters/spotify/`):
  - `spotifyAuthAdapter.ts`: Implements `AuthProvider` by delegating to existing `spotifyAuth` (same instance). `handleCallback(url)` parses `/auth/spotify/callback` and calls `spotifyAuth.handleRedirect()`; return `true` if this provider handled the callback.
  - `spotifyCatalogAdapter.ts`: Implements `CatalogProvider`. Delegates to existing `getUserLibraryInterleaved`, `getPlaylistTracks`, `getAlbumTracks`, `getLikedSongs`, `getLikedSongsCount`, `checkTrackSaved`, `saveTrack`, `unsaveTrack`. Maps Spotify `Track` / `PlaylistInfo` / `AlbumInfo` to `MediaTrack` / `MediaCollection` / `CollectionRef` using `src/constants/playlist.ts` and `collectionRefToKey` / `keyToCollectionRef`.
  - `spotifyPlaybackAdapter.ts`: Implements `PlaybackProvider`. Wraps `spotifyPlayer` (and `spotifyAuth.ensureValidToken()` where needed). Maps `MediaTrack` → `uri` for `playTrack`; implements `getState()` and `subscribe()` by mapping `SpotifyPlaybackState` to `PlaybackState`; delegates `pause`, `resume`, `seek`, `next`, `previous`, `setVolume`. Keeps Spotify-specific behavior (e.g. `lastPlayTrackTime`, `playContext`, device activation) inside the adapter.
  - `spotifyProvider.ts`: Builds `ProviderDescriptor` for `spotify` (id, name, capabilities, auth, catalog, playback).
- **Add** `src/providers/registry.ts`: Simple `ProviderRegistry` implementation that holds a `Map<ProviderId, ProviderDescriptor>` and registers the Spotify descriptor. No app code switches to it yet.

**Checkpoint:** Build passes; new adapter and registry have unit tests (or at least type-check). No behavior change.

### Step 2: Introduce provider context and active-provider state

- **Add** `src/contexts/ProviderContext.tsx` (or `ActiveProviderContext.tsx`):
  - Reads `ProviderRegistry` and persisted “active provider” (e.g. `useLocalStorage('vorbis-player-active-provider', 'spotify')`).
  - Exposes: `activeProviderId`, `activeDescriptor` (from registry), `setActiveProviderId`, and optionally `isAuthenticated(providerId)` / `connect(providerId)` stubs that delegate to the descriptor’s `auth`.
- **Wire** `ProviderContext` in `App.tsx` above the existing providers (e.g. above `TrackProvider`). Keep existing Spotify-only flows working by defaulting active provider to `spotify`.

**Checkpoint:** App still works as today; active provider is always Spotify and can be read from context.

### Step 3: Auth callback routing

- **Refactor** `App.tsx` auth handling:
  - On load, detect callback URL (e.g. pathname includes `/auth/spotify/callback` or future `/auth/dropbox/callback`).
  - Iterate registered providers and call `auth.handleCallback(currentUrl)`; if any returns `true`, consider callback handled and clear URL.
  - If no provider handles it, keep current error/redirect behavior for unknown callbacks.
- **Keep** `spotifyAuth.handleRedirect()` and token exchange inside the Spotify auth adapter; `App.tsx` only routes to the adapter.

**Checkpoint:** Spotify login and callback still work; structure is ready for Dropbox callback.

### Step 4: Hooks use active provider instead of Spotify directly

- **Refactor** in this order to limit blast radius:
  1. **usePlayerLogic**: Use `useProviderContext()` to get `activeDescriptor`. If `activeDescriptor?.providerId === 'spotify'`, call Spotify playback adapter for `onPlayerStateChanged`, play/pause, and device init. Keep same behavior; only the source of the playback API is the adapter.
  2. **useSpotifyPlayback** (rename later to `usePlayback` or keep name but take provider from context): Take `PlaybackProvider` from active descriptor (or a `usePlaybackProvider()` that returns `activeDescriptor.playback`). Replace direct `spotifyPlayer.*` and `spotifyAuth.*` with adapter methods. Map `Track` (from context) to `MediaTrack` at the boundary (or migrate context to `MediaTrack` in a later step).
  3. **useSpotifyControls**: Same idea — get playback provider from context; call `seek`, `next`, `previous`, `resume` on the adapter. Timeline/position can still come from adapter’s `getState` / `subscribe`.
  4. **useVolume**: Use `activeDescriptor.playback.setVolume` instead of `spotifyPlayer.setVolume`.
  5. **useAutoAdvance**: Use playback provider’s `getState` and `subscribe`; keep auto-advance logic the same. If the adapter exposes something like `lastPlayTrackTime`, use it via a small adapter API extension or internal state in the adapter.
  6. **usePlaylistManager**: Use `activeDescriptor.catalog` and `activeDescriptor.playback`. Replace `getPlaylistTracks`, `getAlbumTracks`, `getLikedSongs`, `spotifyAuth`, `spotifyPlayer` with catalog/playback adapter calls. Map API results to `MediaTrack` and, for now, still push `Track`-shaped objects into `TrackContext` (via a thin mapping layer from `MediaTrack` → legacy `Track` so existing UI keeps working).
  7. **useLikeTrack**: Use `activeDescriptor.catalog.setTrackSaved` / `isTrackSaved` if present; otherwise hide like button (capability check).
  8. **useLibrarySync**: Becomes provider-aware: only run sync when active provider is Spotify; call existing Spotify library sync engine from a Spotify-specific branch, or move sync entry points into the Spotify catalog adapter and call from a generic “sync active provider” hook that dispatches by `activeProviderId`.

- **TrackContext**: Can stay on legacy `Track` type for this phase; feed it from `MediaTrack` via mapping in `usePlaylistManager` so that UI and rest of app keep working. Optionally introduce a parallel `MediaTrack` in context in a later PR.

**Checkpoint:** All playback, library, and like behavior unchanged for Spotify; no direct imports of `spotifyAuth` / `spotifyPlayer` in these hooks.

### Step 5: Components and remaining surfaces

- **PlayerStateRenderer**: Use `activeDescriptor` (or a small hook like `useActiveProviderAuth()`). “Connect to Spotify” becomes “Connect to [provider name]”; “Connect Spotify” button calls `activeDescriptor.auth.beginLogin()`. For “no playlist selected” and errors, keep same UX but drive copy from descriptor or a shared “needs connection” state.
- **PlaylistSelection**: Use catalog from context; replace direct `spotifyAuth.isAuthenticated()` with `activeDescriptor.auth.isAuthenticated()`. Replace `spotifyAuth.redirectToAuth()` with `activeDescriptor.auth.beginLogin()`.
- **TrackInfo / TrackInfoPopover**: Use `activeDescriptor.capabilities.hasExternalLink` and `externalLinkLabel`; “Open in Spotify” only when provider is Spotify.
- **Library sync**: Ensure `librarySyncEngine` and cache are only invoked for Spotify (e.g. from inside Spotify catalog adapter or from a sync hook that checks `activeProviderId === 'spotify'`). No change to cache key shape for Spotify in this phase.

**Checkpoint:** No remaining direct Spotify auth/player imports in components; all flows go through context + adapter.

### Step 6: Cleanup and types

- **Legacy types**: Keep `Track` in `services/spotify.ts` for the Spotify adapter’s internal use and for cache types that still use it. Public hooks and components depend on `MediaTrack` (or legacy `Track` only via mapping from adapter). Plan a follow-up to rename or deprecate `Track` where it leaks into shared UI.
- **Constants**: `constants/playlist.ts` stays; adapters use `ALBUM_ID_PREFIX`, `LIKED_SONGS_ID`, and `collectionRefToKey` / `keyToCollectionRef` so that `CollectionRef` is the single source of truth for “selected collection.”
- **Tests**: Update mocks: mock `ProviderContext` or the registry to return a Spotify descriptor that wraps the existing mocked `spotifyAuth` / `spotifyPlayer` so existing tests pass with minimal change.

## File-Level Summary

| Action   | File(s) |
|----------|---------|
| Add      | `src/providers/spotify/spotifyAuthAdapter.ts`, `spotifyCatalogAdapter.ts`, `spotifyPlaybackAdapter.ts`, `spotifyProvider.ts` |
| Add      | `src/providers/registry.ts` |
| Add      | `src/contexts/ProviderContext.tsx` (or `ActiveProviderContext.tsx`) |
| Refactor | `App.tsx` (auth callback routing; wrap with ProviderContext) |
| Refactor | `usePlayerLogic`, `useSpotifyPlayback`, `useSpotifyControls`, `useVolume`, `useAutoAdvance`, `usePlaylistManager`, `useLikeTrack`, `useLibrarySync` to use provider from context |
| Refactor | `PlayerStateRenderer`, `PlaylistSelection`, `TrackInfo` / `TrackInfoPopover` to use active provider / capabilities |
| Keep     | `services/spotify.ts`, `services/spotifyPlayer.ts` as implementation details of the Spotify adapter; no direct imports from app UI/hooks except inside `src/providers/spotify/`. |

## No-Regression Checklist

- [ ] Spotify login and callback work.
- [ ] Library loads (playlists, albums, liked songs); selection and track list match current behavior.
- [ ] Play/pause, seek, next/previous, volume, shuffle behave the same.
- [ ] Like/save track works for Spotify.
- [ ] “Open in Spotify” (or equivalent) still appears for Spotify tracks.
- [ ] Existing unit and integration tests pass (with mocks updated to provider/context where needed).
- [ ] Build and lint pass.

## Follow-Up (Out of Scope for This Plan)

- Migrate `TrackContext` and UI to use `MediaTrack` everywhere and remove legacy `Track` from public API.
- Add Dropbox provider (separate implementation plan).
- Add settings UI for “Connect Spotify” / “Connect Dropbox” and “Use as active source” (see plan-settings-provider-ux).
