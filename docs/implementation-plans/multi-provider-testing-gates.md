# Implementation Plan: Multi-Provider Testing Strategy & No-Regression Gates

> **Status:** Ready for Implementation  
> **Applies to:** [Spotify Adapter Migration](/Users/roman/src/vorbis-player/docs/implementation-plans/spotify-adapter-migration.md), [Settings Provider UX](/Users/roman/src/vorbis-player/docs/implementation-plans/settings-provider-ux.md), [Dropbox Provider v1](/Users/roman/src/vorbis-player/docs/implementation-plans/dropbox-provider-v1.md)  
> **Created:** March 2025

## Overview

Define a test strategy and explicit no-regression checkpoints for each phase of the multi-provider work. The goal is to keep Spotify behavior identical after adapterization and to validate provider switching and playback consistency without requiring full E2E against live APIs for every commit.

## Principles

- **Unit tests** for provider contracts, mapping layers (Spotify/Dropbox types → `MediaTrack` / `MediaCollection` / `PlaybackState`), and pure helpers (`collectionRefToKey`, `keyToCollectionRef`).
- **Integration-style tests** for “active provider switch” and “playback control delegation” by mocking the registry and adapters; no live Spotify/Dropbox calls in CI.
- **Manual test matrix** for auth, library load, playback control, and error states per provider (run before release or after major provider changes).
- **No-regression gates** at the end of each phase: checklist + automated tests that must pass before moving on.

---

## Phase 0: Domain Normalization

### What to test

- **`src/types/domain.ts`**
  - `collectionRefToKey` / `keyToCollectionRef`: round-trip for all `CollectionRef` variants (playlist, album, folder, liked); invalid key returns `null`.
- **Mapping from Spotify types to domain** (when introduced)
  - Unit tests that map `Track` → `MediaTrack`, `PlaylistInfo` / `AlbumInfo` → `MediaCollection` with expected `provider: 'spotify'` and correct `playbackRef` / `CollectionRef`.

### No-regression gate

- [ ] All new domain/mapping tests pass.
- [ ] Existing tests still pass (no behavior change yet).
- [ ] `tsc --noEmit` and `npm run build` pass.

---

## Phase 1: Provider Ports + Registry

### What to test

- **Provider contracts**
  - No direct tests for interfaces; test implementations (adapters) conform by use.
- **ProviderRegistry**
  - `get(id)` returns descriptor for registered id, `undefined` for unknown id.
  - `getAll()` returns all registered descriptors.
  - `has(id)` is true for registered, false otherwise.

### No-regression gate

- [ ] Registry tests pass.
- [ ] Build and existing suite pass.

---

## Phase 2: Spotify Adapter Migration

### What to test

- **Spotify auth adapter**
  - `isAuthenticated()` delegates to underlying auth; `handleCallback(url)` returns `true` only for `/auth/spotify/callback` and when code is present; after successful handle, token is set (mock underlying `spotifyAuth`).
- **Spotify catalog adapter**
  - `listCollections` / `listTracks` return `MediaCollection[]` / `MediaTrack[]` with correct `provider: 'spotify'` and valid `CollectionRef`; mock Spotify API responses and assert shape.
  - `getLikedCount`, `setTrackSaved`, `isTrackSaved` when present delegate correctly (mock spotify service).
- **Spotify playback adapter**
  - `getState()` maps `SpotifyPlaybackState` to `PlaybackState` (mock `spotifyPlayer.getCurrentState()`).
  - `playTrack(track)` calls underlying player with track’s URI (mock `spotifyPlayer.playTrack`).
  - `subscribe` returns an unsubscribe function; callback is invoked when underlying state changes (mock `onPlayerStateChanged`).
- **Hooks using provider from context**
  - Mock `ProviderContext` (or equivalent) to return a Spotify descriptor; existing hook tests (e.g. `useSpotifyPlayback`, `useVolume`, `useLikeTrack`) still pass by mocking the adapter or the context to supply the same behavior as before.

### No-regression gate

- [ ] All existing hook/component tests pass (with mocks updated to provider/context where needed).
- [ ] New adapter unit tests pass.
- [ ] Manual: Spotify login, library load, play/pause/seek/next/prev, like/save, “Open in Spotify” still work in dev.

---

## Phase 3: Settings Integration

### What to test

- **Provider context**
  - `activeProviderId` is read from localStorage on init; `setActiveProviderId` persists to localStorage.
  - Default is `spotify` when key is missing or invalid.
- **Settings UI (component tests)**
  - Music sources section renders; for each provider from registry, label and Connect/Disconnect (or status) are present.
  - Selecting “Use this source” calls `setActiveProviderId` with correct id (mock context).
- **Integration**
  - When `setActiveProviderId` is called, consumer of context (e.g. library hook) receives new descriptor; no need for live API, just assert the right method is called or state updates.

### No-regression gate

- [ ] New context and settings UI tests pass.
- [ ] Manual: Open settings, see Spotify (and later Dropbox); connect/disconnect and “Use this source” update UI and persisted active provider; switching provider updates library/playback surface without reload.

---

## Phase 4: Dropbox Provider (v1)

### What to test

- **Dropbox auth adapter**
  - Mock OAuth redirect and callback; assert token storage and `isAuthenticated()` after `handleCallback`.
- **Dropbox catalog adapter**
  - Mock Dropbox `list_folder` response; assert `listCollections` returns folders as `MediaCollection` with `kind: 'folder'`.
  - Mock file list; assert `listTracks` returns `MediaTrack[]` with correct `playbackRef` (provider `dropbox`, ref = path).
- **Dropbox playback adapter**
  - Mock temp link API; assert `playTrack` resolves link and sets src on audio element (or mock Audio); assert `getState` / `subscribe` reflect play/pause/position when simulated.
- **Capabilities**
  - Dropbox descriptor has `hasLikedCollection: false`, `hasSaveTrack: false`, `hasExternalLink: false`; UI tests or hook tests can assert Like button is hidden when active provider is Dropbox (mock context).

### No-regression gate

- [ ] All Dropbox adapter unit tests pass.
- [ ] Manual: Connect Dropbox, browse folder, select folder, play track; play/pause/seek/next/prev work; expired link refresh and error states behave as specified.

---

## Phase 5: Sync/Cache Generalization

### What to test

- **Provider-aware sync**
  - When active provider is Spotify, existing library sync engine (or its adapter entry point) is invoked; when active is Dropbox, Dropbox indexing/sync is invoked (mock both; assert correct one called).
- **Cache isolation**
  - Spotify cache keys and Dropbox cache keys do not collide; tests that write/read per-provider data pass.

### No-regression gate

- [ ] Sync and cache tests pass.
- [ ] Manual: Switch provider and confirm library and playback reflect the active source; no cross-provider leakage.

---

## Phase 6: QA and Hardening

### What to test

- **Provider switching**
  - Integration test: set active provider A, then set active provider B; assert library/playback data source switches (mocked adapters).
- **Playback consistency**
  - For both Spotify and Dropbox adapters: play, pause, seek, next, previous produce correct `PlaybackState` and delegate to underlying implementation (mocked).
- **Error paths**
  - Auth failure, network error, expired link: adapters reject or surface error; UI shows appropriate state (component or integration test with mocks).

### No-regression gate

- [ ] Full test suite passes (`npm run test:run`).
- [ ] Manual test matrix (below) completed and signed off.

---

## Manual Test Matrix (Pre-Release or Major Provider Change)

Run once per provider and after provider-related changes.

| Area | Spotify | Dropbox |
|------|---------|---------|
| **Auth** | Login via redirect; callback returns to app; token persisted; logout clears token | Same for Dropbox OAuth |
| **Library** | Playlists, albums, liked songs load; selection shows tracks | Folders load; folder selection shows tracks; metadata view (if implemented) |
| **Playback** | Play, pause, seek, next, previous, volume | Same |
| **Queue** | Shuffle, order, auto-advance | Same (app-managed queue) |
| **Provider switch** | Set Spotify active → library and playback use Spotify | Set Dropbox active → library and playback use Dropbox |
| **Settings** | Connect / Disconnect; “Use this source”; persistence across reload | Same |
| **Errors** | Invalid token → reconnect prompt; 403 track → skip or message | Expired link → refresh and resume or message |
| **Capabilities** | Like visible; “Open in Spotify” visible for Spotify tracks | Like hidden; no external link for Dropbox tracks |

---

## Summary: Automated Test Additions by Phase

| Phase | New / updated tests |
|-------|---------------------|
| 0 | Domain: `collectionRefToKey` / `keyToCollectionRef`; mapping helpers |
| 1 | Registry: `get`, `getAll`, `has` |
| 2 | Spotify adapters (auth, catalog, playback); hook tests updated to mock provider context |
| 3 | Provider context (persistence); settings section (render + “Use this source”) |
| 4 | Dropbox adapters (auth, catalog, playback); capabilities |
| 5 | Sync/cache provider dispatch; cache key isolation |
| 6 | Provider switch integration; playback consistency; error paths |

All phases: keep existing tests green and run `npm run test:run` plus `tsc -b && vite build` as the standard gate before merge.
