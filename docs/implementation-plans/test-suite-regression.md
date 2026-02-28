# Plan: Comprehensive Test Suite for Vorbis Player

## Context

The codebase has 12 existing test files (~1,600 lines) covering a handful of hooks, cache services, and utilities. Before major feature additions, we need regression, integration, and E2E coverage that protects the most critical business logic: playback engine, Spotify auth/API, state management, and key user interactions. The goal is to build a suite that catches regressions silently introduced during feature work.

---

## Current Test Coverage (Baseline)

Already tested: `useLocalStorage`, `usePlayerState`, `useKeyboardShortcuts`, `useSwipeGesture`, `useLibrarySync`, `usePinnedItems`, `libraryCache`, `librarySyncEngine`, `colorUtils`, `sizingUtils`, `playlistFilters`, `KeyboardShortcutsIntegration`

**Major gaps**: 17 hooks untested, spotify.ts + spotifyPlayer.ts have zero tests, 24 components untested

---

## What NOT to Test

| Category | Items | Reason |
|---|---|---|
| Visual-only | AccentColorBackground, BackgroundVisualizer, ParticleVisualizer, GeometricVisualizer | Pure CSS/canvas—nothing to assert on |
| Dev tooling | useProfilerData, useProfilingTimer, useRenderTracking, PerformanceProfiler | Not shipped behavior |
| Canvas internals | useCanvasVisualizer, useAnimationFrame | Canvas is no-op in jsdom |
| Worker internals | useImageProcessingWorker | Web Workers don't run in jsdom |
| SDK lifecycle | spotifyPlayer.initialize() end-to-end | Requires live Spotify SDK binary |

---

## Shared Test Infrastructure (create first)

**Files to create:**

### `src/test/fixtures.ts`
Typed data factories: `makeTrack()`, `makePlaylistInfo()`, `makeAlbumInfo()`, `makeSpotifyPlaybackState()`

### `src/test/spotifyMocks.ts`
Reusable vi.mock factories: `createMockSpotifyPlayer()`, `createMockSpotifyAuth()`

```typescript
// spotifyPlayer mock: playTrack, pause, resume, onPlayerStateChanged (returns unsub fn),
// getDeviceId, getIsReady, setVolume, transferPlaybackToDevice, ensureDeviceIsActive
// spotifyAuth mock: isAuthenticated, ensureValidToken, getAccessToken, handleRedirect, redirectToAuth
```

### `src/test/testWrappers.tsx`
Context provider wrapper for hooks that read TrackContext/ColorContext/VisualEffectsContext

### `src/test/setup.ts` (extend existing)
Add `import 'fake-indexeddb/auto'` at top

---

## Phase 1: Pure Logic & Simple Hooks (~35 tests, 5 files)

High-value, low-effort. Pure functions and simple hooks with no external dependencies.

### `src/utils/__tests__/colorExtractor.test.ts` (6 tests)
- `rgbToHsl`, `rgbToHex` correctness
- `isGoodContrast` boundary conditions (40–85% lightness)
- `isVibrant` saturation threshold
- `getTransparentVariant` with hex and rgb inputs
- LRU eviction at 101 items

### `src/utils/__tests__/featureDetection.test.ts` (4 tests)
Mock `CSS.supports`, `window.visualViewport`
- Returns expected keys from `detectBrowserFeatures()`
- Returns all false when CSS.supports returns false
- `getEnhancedViewportInfo` fallback to `window.innerWidth` when visualViewport absent

### `src/hooks/__tests__/useVolume.test.ts` (8 tests)
Mock `@/services/spotifyPlayer` at module level
- Loads from localStorage on init, defaults to 50
- Mute toggle: player setVolume(0), isMuted=true
- Unmute toggle: restores previousVolume
- setVolumeLevel(0) auto-sets isMuted=true
- setVolumeLevel(50) clears muted state
- Clamps [0, 100]

### `src/hooks/__tests__/useVisualEffectsState.test.ts` (7 tests)
No external mocks needed
- Initializes glow intensity/rate from localStorage
- handleGlowIntensityChange updates state and savedGlowIntensity
- handleGlowRateChange updates state
- restoreGlowSettings restores saved values
- restoreGlowSettings is no-op when savedGlowIntensity is null

### `src/hooks/__tests__/useVerticalSwipeGesture.test.ts` (10 tests)
Follow pattern from `useSwipeGesture.test.ts`
- Swipe down past 80px threshold calls onSwipeDown
- Swipe up past 80px threshold calls onSwipeUp
- Horizontal movement locks direction, does NOT trigger callbacks
- Short drag below threshold does nothing
- Fast flick (velocity) triggers swipe even below distance threshold
- `enabled: false` disables handlers
- isDragging becomes true mid-gesture
- dragOffset tracks deltaY during gesture

---

## Phase 2: Service Layer (~28 tests, 2 files)

Protects auth, rate limiting, 3-tier caching, and API functions.

### `src/services/__tests__/spotifyAuth.test.ts` (12 tests)
Key file: `src/services/spotify.ts` — `SpotifyAuth` class

- `isAuthenticated()` false with no token
- `isAuthenticated()` true with valid token
- `isAuthenticated()` false when token expired
- `loadTokenFromStorage` clears localStorage on invalid JSON
- `ensureValidToken` returns current token when not near expiry
- `ensureValidToken` calls `refreshAccessToken` within 5-minute buffer
- `refreshAccessToken` POSTs to Spotify token endpoint with correct body
- `refreshAccessToken` throws on non-ok response
- `handleAuthCallback` exchanges code+verifier, stores tokens, clears code verifier
- `handleRedirect` no-op when not on callback path
- `handleRedirect` calls handleAuthCallback when code param + callback path match
- `handleRedirect` skips already-seen code (sessionStorage guard)

### `src/services/__tests__/spotify.test.ts` (16 tests)
All use `vi.mocked(fetch)` + mock `spotifyAuth.ensureValidToken`

**Rate limiting (4 tests):**
- `spotifyApiRequest` retries when rateLimitedUntil is set from 429
- `handleRateLimitResponse` reads Retry-After header
- Defaults to 5s backoff when Retry-After absent
- Concurrent GETs to same URL share one in-flight promise

**Track-list caching (4 tests):**
- `getPlaylistTracks` returns L1 cache hit without calling fetch
- Falls through to IndexedDB (L2), promotes to L1 on cache miss
- Fetches from API (L3) on full miss, writes both L1 and L2
- `getAlbumTracks` sorts by track_number

**Like/save (4 tests):**
- `checkTrackSaved` returns cached value within TTL
- `saveTrack` makes PUT, updates cache optimistically
- `unsaveTrack` makes DELETE, invalidates liked songs caches
- Error on `saveTrack` still rejects (does not silently swallow)

**Data transformation (4 tests):**
- `transformTrackItem` returns null for non-track types
- `transformTrackItem` returns null for items without id
- `formatArtists` returns 'Unknown Artist' for empty array
- `buildArtistsData` builds correct URLs when external_urls.spotify present

---

## Phase 3: Hook Integration Tests (~34 tests, 6 files)

Require context wrappers and mocked services. Tests playback engine and state orchestration.

### `src/hooks/__tests__/useLikeTrack.test.ts` (8 tests)
Mock `checkTrackSaved`, `saveTrack`, `unsaveTrack` from `@/services/spotify`
- isLiked false when trackId undefined
- Calls checkTrackSaved when trackId changes
- Optimistic update before API resolves
- Reverts optimistic update on API error
- No-op when isLikePending=true (prevents double-click)

### `src/hooks/__tests__/useAccentColor.test.ts` (8 tests)
Mock `extractDominantColor` from `@/utils/colorExtractor`
- Uses override from accentColorOverrides when album_id matches
- Calls extractDominantColor when no override
- Falls back to theme color on extraction failure
- handleAccentColorChange('auto') removes override, triggers re-extraction
- handleAccentColorChange('#ff0000') saves to overrides

### `src/hooks/__tests__/useAutoAdvance.test.ts` (6 tests)
Mock `spotifyPlayer.onPlayerStateChanged` to simulate callbacks
- Does not subscribe when enabled=false or tracks.length=0
- Advances when timeRemaining <= endThreshold
- Advances on pause-at-position-0 (natural track end)
- Does NOT advance if msSinceLastPlay < PLAY_COOLDOWN_MS
- Wraps from last track to index 0

### `src/hooks/__tests__/usePlaylistManager.test.ts` (7 tests)
Mock spotifyPlayer (module-level) + getPlaylistTracks, getLikedSongs, getAlbumTracks
- Calls getPlaylistTracks for regular playlist IDs
- Calls getLikedSongs for LIKED_SONGS_ID
- Calls getAlbumTracks for album IDs (album: prefix)
- setError when playlist returns empty tracks
- Applies Fisher-Yates shuffle when shuffleEnabled=true
- Calls redirectToAuth on auth error
- setIsLoading(false) in finally block on error

### `src/hooks/__tests__/useSpotifyPlayback.test.ts` (5 tests)
Mock spotifyPlayer + spotifyAuth
- Returns early when track index out of bounds
- Returns early when not authenticated
- Retries on 403 non-restriction error (max 2 retries, exponential backoff)
- Marks track failed and skips to next on Restriction Violated
- Calls next track after 500ms delay when skipOnError=true

### `src/contexts/__tests__/TrackContext.test.tsx` (6 tests)
Key file: `src/contexts/TrackContext.tsx`
- currentTrack returns correct track at currentTrackIndex
- currentTrack returns null when tracks is empty
- handleShuffleToggle puts current track first in shuffled order
- handleShuffleToggle (disable) restores original order, finds correct index
- handleShuffleToggle is no-op when originalTracks is empty
- shuffleEnabled persists to localStorage

---

## Phase 4: Component Integration Tests (~24 tests, 3 files)

### `src/components/__tests__/LikeButton.test.tsx` (7 tests)
- Outlined heart when isLiked=false, filled when isLiked=true
- Shows loading spinner when isLoading=true
- Calls onToggleLike on click (normal state)
- Does NOT call onToggleLike when isLoading=true
- Does NOT call onToggleLike when trackId undefined
- Correct aria-label in each state

### `src/components/__tests__/PlaylistSelection.test.tsx` (8 tests)
Mock `useLibrarySync`, render with context wrappers
- Renders Playlists and Albums tab buttons
- Switching to Albums tab shows album grid
- Search filters by name (case-insensitive)
- Pinned items appear before unpinned
- Clicking playlist calls onPlaylistSelect with correct ID
- Shows skeleton while syncing
- Shows error alert on sync error
- Liked Songs item present with LIKED_SONGS_ID

### `src/components/__tests__/BottomBar.test.tsx` (9 tests)
Mock context values, test portal rendering
- Renders into document.body (portal behavior)
- Clicking library button calls onOpenLibraryDrawer
- Clicking back-to-library calls onBackToLibrary
- Zen mode button visible on desktop (hasPointerInput=true)
- Zen mode button hidden on touch-only devices
- Shuffle button shows active state when shuffle enabled
- Visual effects button opens effects menu

---

## Phase 5: E2E Tests with Playwright (~15 tests, 3 spec files)

### Why Playwright (not Cypress)
1. Portal-based BottomBar renders outside React root—Playwright's page-level selectors handle this naturally
2. Touch event simulation (swipe gestures) requires `page.touchscreen`—Playwright's touch emulation is first-class
3. `storageState` injects pre-authorized localStorage, bypassing Spotify OAuth entirely
4. `page.route()` for Spotify API mocking is more ergonomic for this full mock surface
5. Parallel execution + WebKit/Safari coverage (important for iOS volume fallback path)

### Auth Strategy
```typescript
// playwright/fixtures/auth.ts
await page.addInitScript(() => {
  localStorage.setItem('spotify_token', JSON.stringify({
    access_token: 'fake-e2e-token',
    expires_at: Date.now() + 3600 * 1000
  }));
});
// All Spotify API calls intercepted via page.route('https://api.spotify.com/**', ...)
```

### `playwright/specs/playlist-selection.spec.ts` (5 tests)
Intercept `GET /v1/me/playlists*` and `GET /v1/me/albums*`
- Page loads showing playlist selection when authenticated
- Playlists render after mocked API response
- Clicking playlist triggers track-load and transitions to player view
- Search input filters visible list
- Albums tab switch renders album grid

### `playwright/specs/player-controls.spec.ts` (5 tests)
After loading mocked playlist, intercept track play requests
- Play/pause button toggles state
- Next track button calls correct API endpoint
- Previous track button calls correct API endpoint
- Space keyboard shortcut triggers play/pause
- Timeline slider drag updates position display

### `playwright/specs/zen-mode.spec.ts` (5 tests)
- Zen mode button hides player controls
- Vertical swipe down on album art enters zen mode (mobile viewport emulation)
- Vertical swipe up exits zen mode (mobile viewport emulation)
- Zen mode expands album art to fill more space
- Escape key exits zen mode on desktop

---

## Critical Files to Reference During Implementation

| File | Purpose |
|---|---|
| `src/services/spotify.ts` | SpotifyAuth class, rate limiter, dedup map, 3-tier cache, all API fns |
| `src/services/spotifyPlayer.ts` | SpotifyPlayerService class, device management, state listeners |
| `src/hooks/useSpotifyPlayback.ts` | Retry-with-backoff, restriction vs. generic 403, skipOnError chain |
| `src/hooks/useAutoAdvance.ts` | End detection, PLAY_COOLDOWN_MS guard, wrap logic |
| `src/hooks/usePlaylistManager.ts` | Device init flow, Fisher-Yates shuffle, error handling |
| `src/contexts/TrackContext.tsx` | Shuffle state machine, context provider shape |
| `src/hooks/__tests__/useSwipeGesture.test.ts` | Pattern to follow for gesture hook tests |
| `src/test/setup.ts` | Global mocks to extend with fake-indexeddb |

---

## Verification

After each phase:
1. Run `npm run test:run` — all existing + new tests pass
2. Run `npm run test:coverage` — check coverage delta for targeted files
3. Phase 5: `npx playwright test` after Playwright install

End state success criteria:
- All ~136 new tests pass alongside existing 12 test files
- `spotify.ts` and `useSpotifyPlayback.ts` reach >80% statement coverage
- `usePlaylistManager.ts` and `useAutoAdvance.ts` reach >80% branch coverage
- E2E suite runs against production build (`npm run build && npm run preview`)

---

## Delivery Order Summary

| Phase | New Tests | New Files | Unlocks |
|---|---|---|---|
| 1 - Pure Logic | ~35 | 5 | Immediate wins, templates for later phases |
| 2 - Service Layer | ~28 | 2 | Auth + caching protected |
| 3 - Hook Integration | ~34 | 6 | Playback engine protected |
| 4 - Components | ~24 | 3 | UI contracts protected |
| 5 - E2E | ~15 | 3 + Playwright config | Full user journeys protected |
| **Total** | **~136** | **19** | |
