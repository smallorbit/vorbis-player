# RFC 0001: The Road to S-Tier

- **Status**: Draft
- **Date**: 2026-07-19
- **Scope**: The entire codebase — architecture, code quality, security, accessibility, performance, tooling, tests, and documentation.
- **Method**: A systematic audit of all ~43k lines of `src/` (538 TS/TSX files): eleven subsystem deep-reads, six cross-cutting reviews (layering, duplication, error handling, API elegance, performance, dead code), a completeness pass over uncovered dimensions (security, OS media integration, accessibility, DevBug), and then **adversarial verification of every high- and medium-severity claim against the actual code**. 152 raw findings consolidated to 103; all 78 high/medium findings were re-checked by an independent skeptical pass — 30 confirmed exactly as stated, 48 confirmed with scope corrections, **0 refuted**. The full inventory is in [Appendix A](#appendix-a-findings-inventory).

---

## 1. Executive summary

Vorbis Player is a **high-craft codebase on a mid-tier core architecture**. The craft is real and recent: CI gates every PR on lint + typecheck + unit + build + e2e; 2,040 tests pass in ~100s; the docs were trued against the code within the last month; dead code gets swept with knip; race bugs get fixed with precision and documented with issue references. Very few codebases of this size are maintained this actively or this honestly.

But the audit shows the same handful of architectural debts generating most of the ongoing cost, and they will keep generating it until they are paid down structurally rather than patched locally:

1. **The domain model is inverted.** The provider-neutral `MediaTrack`/`MediaCollection` layer exists and is mandated by the project's own spec — yet the app-wide library currency is Spotify wire shapes (`Track`/`PlaylistInfo`/`AlbumInfo`), with neutral collections converted *back* into fake Spotify shapes (`useCatalogLibrarySync.ts:42–74` fabricates `uri: ''` and `album_type: 'folder'`). The IndexedDB cache and CmdK search are structurally Spotify-only as a result.
2. **Playback state has no single source of truth.** `isPlaying`/position live in two disconnected React stores; three parallel provider-subscription mechanisms each carry their own stale-event heuristic; "which provider is driving" is answered six different ways; the queue exists twice (React state + `mediaTracksRef` mirror, hand-synced at 17 write sites). Five shipped race fixes (#1199, #1571, #1644, #1671, #1675) all trace to this topology. Race-proneness here is **structural, not incidental**.
3. **The same solutions are built repeatedly instead of once.** PKCE OAuth is duplicated per provider *with security hardening drifting between the copies* (Spotify lacks the CSRF `state` check Dropbox has). Retry/backoff exists in 5+ divergent copies. Three independent IndexedDB lifecycle stacks. Three copies of the Dropbox remote-JSON sync service. Two `useLongPress` implementations. The newest-wins async guard — the codebase's most recurring bug mechanism — is hand-rolled 8+ times in three idioms.
4. **The product is web-app-solid but platform-weak.** No React error boundary (any render throw white-screens the player). A hand-rolled service worker outside every quality gate, broken four ways, caching authenticated Spotify responses with no logout purge. No Media Session API in an installable PWA music player. Three verified high-severity accessibility holes. No CSP.
5. **The quality system has blind spots exactly where they hurt.** ~44k LOC of tests and all Playwright code are excluded from typechecking. No coverage measurement in CI. knip and `npm audit` exist as scripts but aren't wired in — and audit currently fails with 3 critical / 2 high advisories, all clearable by `npm update`.

**What S-tier means here**: not a rewrite, and not novelty. It means (a) every piece of state has exactly one owner, (b) every recurring concern has exactly one canonical implementation, (c) every convention is machine-enforced, (d) the neutral domain contract is honored on both sides — by providers *and* consumers, and (e) the platform obligations of a shipped PWA (resilience, accessibility, security, OS integration) are met with the same craft the internals already show.

The program below is ~5 phases. Phases 0–1 are days of work and remove all correctness/security-critical findings. Phases 2–3 are the two real architectural migrations. Phases 4–5 are consolidation and institutionalization.

---

## 2. What is already S-tier — protect it

The RFC's first obligation is to name what must **not** be lost. These are verified strengths, and several should be *extended* rather than merely preserved:

- **The provider contract spine.** `AuthProvider`/`CatalogProvider`/`PlaybackProvider` behind a registration-time-validated registry (`InvalidProviderDescriptorError` names the missing adapter). Documented twice — `docs/architecture/providers.md` and an openspec spec with testable scenarios.
- **Typed cross-provider errors.** `AuthExpiredError` carries `providerId`, `UnavailableTrackError` carries `trackName`; all three playback adapters throw them consistently and `useProviderPlayback` consumes them without string matching. (The one seam where this dissolves is F20 — fix that seam, keep the pattern.)
- **Cross-provider handoff is small.** Per-track provider resolution plus `pausePreviousProvider` — roughly 15 lines (`useProviderPlayback.ts:79–91`). Mixed Spotify+Dropbox queues flow through one seam.
- **The mock provider is a true peer, not a stub.** It implements the full contract, registers under real provider ids so every production code path runs credential-free in Playwright, and marks its escape hatches with `__test` prefixes.
- **Comment discipline on race-prone code.** The prepareTrack hydrate-vs-pre-warm split, the art-race guard (#1199), the generation-counter prime logic — each explains *why* with an issue reference. This is institutional memory; Workstream 11 mandates it elsewhere.
- **The convention → lint rule → test pipeline.** `eslint-rules/props-explicit-undefined.js` with its own test suite proves the project can turn a convention into enforcement. Several workstreams below reuse exactly this pipeline.
- **Dropbox provider decomposition.** Eight focused modules composed by the adapter, every file under the 500-line rule, 12 test files for one provider.
- **Capability-gated behavior where it matters.** `onQueueChanged` only fires for `hasNativeQueueSync` providers; Dropbox only registers with a client id; the mock is tree-shaken from production.
- **Test breadth and e2e realism.** 2,040 tests; a Playwright rig that runs the real UI against committed snapshots; the BDD `#given/#when/#then` convention is genuinely followed.
- **An honest docs culture.** The recent docs-trueing sweep (#1617–#1624) shows the project treats stale docs as bugs.

---

## 3. Design principles

These principles generalize the audit's findings into rules the codebase can be held to. Each workstream cites them.

- **P1 — One owner per state.** Every piece of runtime state has exactly one writable home; everything else is a subscription. No hand-synced mirrors, no parallel stores, no cross-file mutable-ref protocols.
- **P2 — One canonical implementation per concern.** OAuth, retry, IndexedDB lifecycle, remote JSON sync, gestures, newest-wins guards, notifications: each gets one shared primitive; per-caller variation is configuration, not a fork.
- **P3 — Conventions are machine-enforced or they are wishes.** Every "we always do X" in CLAUDE.md gets a lint rule, a CI check, or a type — via the already-proven `eslint-rules/` pipeline.
- **P4 — The neutral domain model is the only currency above the adapter boundary.** Provider wire shapes live inside `src/services/<provider>/` and `src/providers/<provider>/`; everything above speaks `MediaTrack`/`MediaCollection`/`CollectionRef`.
- **P5 — Errors are typed values with one policy.** `instanceof` at the catch site, discriminated unions in state, one notify seam for the user, one sink for diagnostics. Never substring matching, never silent swallows.
- **P6 — Variability is declared once.** A provider's optional features are expressed through one mechanism (capabilities *or* method presence), not two half-covering ones.
- **P7 — The platform is part of elegance.** Error boundaries, accessibility, security headers, offline behavior, and OS media integration are architectural obligations of a shipped PWA, not polish.
- **P8 — Strangler-fig migrations only.** Every workstream lands as a sequence of small PRs each keeping the suite green; no long-lived branches; each PR deletes what it replaces.

---

## 4. Workstreams

Findings are referenced as **F1–F103** (Appendix A). Severity after adversarial verification: **12 high, 55 medium, 36 low**.

### Pillar I — Core architecture

#### WS1: Make the neutral domain model the app-wide currency *(P4 — F1, F2, F15, F19, F28, F47)*

**Problem.** The library UI, IndexedDB cache, and CmdK search consume Spotify-shaped types; `useCatalogLibrarySync` converts neutral `MediaCollection` *back* into fabricated Spotify shapes; the sync engine hardcodes `providerId='spotify'`, so search structurally cannot see Dropbox content while Dropbox runs a parallel, uncoordinated cache stack (F1). In parallel, collection identity exists in two schemes — prefix-encoded string IDs (`album:`) and typed `CollectionRef` — leaking into each other, with the `'playlist'|'album'` union re-inlined ~20 times and identity passed in four different callback shapes at the UI seam (F2). Dropbox-specific services are hard-wired into provider-neutral contexts (`PinnedItemsContext`, `ColorContext`, `ProviderContext` importing dropbox modules) (F19). The optional-feature story is split between capability flags and method-presence checks, forcing double gates and banned `!` assertions (F28).

**Target state.** `MediaTrack`/`MediaCollection`/`CollectionRef` are the only shapes above the adapter boundary. Caches are keyed by `(provider, id)`. Search is cross-provider by construction. One variability mechanism on the provider contract. Contexts iterate registered descriptors; zero `dropbox`/`spotify` imports outside their own directories (enforced by lint, WS10).

**Moves.**
1. Lift shared collection shapes into `src/types/domain.ts`; convert Spotify wire shapes **once** at the sync-engine/adapter boundary; migrate the ~15 importers; delete `collectionToAlbumInfo`/`collectionToPlaylistInfo`; key cache stores by `(provider, id)`; bump the IndexedDB schema version once (F1).
2. Make `CollectionRef` (+ display name) the sole selection currency: `selectedCollection: CollectionRef | null` in TrackContext, `CollectionRef`-taking `loadCollection` and LibraryRoute callbacks; delete `ALBUM_ID_PREFIX`/`toAlbumPlaylistId`/`resolvePlaylistRef` and the defensive re-decoding; fix `keyToCollectionRef` to round-trip the empty-id folder ref. Include a compatibility shim for persisted ids (pins, session snapshots) (F2).
3. Add neutral extension points on `ProviderDescriptor` (optional `preferencesSync`, art resolver, generic auth-state event) and convert the three Dropbox-specific context imports to descriptor iteration (F19).
4. Collapse the two optional-feature mechanisms: derive capability flags from method presence via a registry-time helper, keep only genuinely behavioral flags (`hasNativeQueueSync`, `externalLinkLabel`), and validate flag/method agreement in `registry.register()` (F28).
5. Retire the dead/bypassing surfaces this exposes: `useSpotifyPlaylistManager`'s drifted retry copy routes through `descriptor.playback.playCollection`; drop never-called `next()`/`previous()` from the required interface (F14); either lift incremental sync into a provider-agnostic engine consuming `CatalogProvider` or declare engine-provided listing via capability so the contract stops advertising a never-called method (F15).
6. Finish with the mechanical rename pass: `SpotifyPlayerControls` → `PlayerControls`, `useSpotifyControls` → `usePlaybackControls`, `SettingsV2` → `Settings`, `showVisualEffects` → `isSettingsOpen` (F68).

**Exit criteria.** Zero imports of `src/services/spotify/types` outside `src/services/spotify/` + `src/providers/spotify/`; CmdK returns Dropbox tracks in the mock-provider e2e; one grep for `'album:'` returns only the Spotify adapter's wire-parsing internals.

#### WS2: One playback engine *(P1 — F3, F13, F22, F23, F24, F31, F14)*

**Problem.** The playback core is an implicit distributed state machine: two disconnected `isPlaying`/position stores; three subscription mechanisms with three stale-event heuristics (`expectedTrackIdRef`, `wasPlayingRef`+`PLAY_COOLDOWN_MS`, `pendingSeekRef`+`SEEK_GUARD_WINDOW_MS`); six driving-provider resolutions with inconsistent fallback order; `expectedTrackIdRef` created in one file and mutated in four; the queue duplicated across React state and `mediaTracksRef`, hand-synced at 17 write sites in 6 files (F3, F13). Two parallel session-restore paths, one missing the playability fallback (F31). The append/dedupe/shuffle invariant is repeated three times inside `useQueueManagement` (F24). Every new consumer must copy one of three inconsistent patterns — which is precisely why the Media Session hook (WS5) should not be built until this lands.

**Target state.** One module-level **PlaybackStore** (outside React, consumed via `useSyncExternalStore`) owning `isPlaying`, `positionMs`, `durationMs`, `currentTrackId`, `drivingProviderId`, and the transition guard — fed by a single fan-out subscription over all adapters. One **QueueStore** owning `tracks`/`originalTracks`/`currentIndex`/`shuffle`, with mutators as store methods maintaining the invariant in exactly one place (the iOS gesture-window synchronous read comes free — the store *is* the imperative source). One exported driving-provider resolver. `usePlaybackSubscription`, `useAutoAdvance`, `useSpotifyControls`, `useVolume` become pure consumers. The next race bug is fixable in one file.

**Moves.**
1. Introduce `PlaybackStore` and migrate `usePlaybackSubscription` onto it; fold the 1s poll and the three stale-event heuristics into private store fields. Keep the slider's scrub-local state UI-side (verified as legitimately local).
2. Fold the six driving-provider heuristics into one resolver exported by the store.
3. Introduce `QueueStore`; migrate the 17 write sites; delete `mediaTracksRef` and the stale comments referencing a removed recovery hook (F13); rebuild `useQueueManagement` on two primitives — `fetchCollectionTracks` + `addTracks({position})` (F24).
4. Unify session restore into `restoreSession(session, {autoplay})` with the candidate-iteration fallback shared by both paths (F31).
5. Change `loadCollection`'s return to the project's own convention: `{status:'loaded';count} | {status:'superseded'} | {status:'empty'}` — killing the bogus "Added N tracks" toast (F30).
6. Extract `useNewestWins` (generation + AbortController + `isStale`) and migrate the 8+ hand-rolled guards, adding the missing guard in `useAccentColor` in the same pass (F44).

**Exit criteria.** `grep -r "expectedTrackIdRef\|mediaTracksRef" src/` returns only the store module; the async-race harness (#1675) runs against the store's public API; one documented subscription topology in `docs/architecture/playback.md`.

#### WS3: State, persistence & events with single owners *(P1, P2 — F4, F5, F29, F35, F39, F41, F70, F77, F84)*

**Problem.** `useLocalStorage` has no same-tab change channel: multi-mounted instances silently desync (volume can audibly snap back; QAP/glow/recently-played all affected), and non-hook writers clobber synced accent colors, which then get pushed *back* to Dropbox (F4). The IndexedDB liked-songs list is never invalidated on save/unsave — stale Liked Songs for up to 24h (F5). Three independent IndexedDB lifecycle stacks with divergent, silently-lossy fallback semantics — one documents itself as a copy of another (F35). The Dropbox `/.vorbis` remote-JSON sync service is triplicated (F39). Logout has no data-purge contract — Dropbox logout leaves its entire IndexedDB behind while Spotify clears its equivalent (F41). The window CustomEvent bus is the cross-layer backbone, but two-thirds of its names are minted ad hoc, untyped (F70). `STORAGE_KEYS` misses six keys — including the Spotify tokens, stored under raw unprefixed literals (F77). `ProviderContext` is a 371-line 17-field mixed-concern context composing toast copy in the data layer (F29).

**Target state.** One write path per persisted key; every store change observable in the same tab; one IndexedDB foundation with one written degradation policy; one typed event registry; one enumerable key list that the logout-purge contract iterates.

**Moves.**
1. Give `useLocalStorage` a same-tab broadcast (CustomEvent on `setValue`; instances re-read; `newValue === null` = reset); route external writers (preferences sync, settings clear) through a shared helper dispatching the same event; lint-restrict raw `localStorage` to an allowlist (F4).
2. Fire `libraryCache.removeTrackList('liked-songs')` from `invalidateLikedSongsCaches` — or better, patch the IDB entry in place per save/unsave, validating against the liked-count meta the way playlists validate against `snapshot_id` (F5).
3. Promote `KVStore` + lifecycle into `src/services/idb`; rebuild `settingsDb` and the Dropbox trio on it; write the degradation policy once: retry once, evict-and-retry on quota, `deleteDatabase` on corruption, never let a write failure hide readable data (F35).
4. Extract `RemoteJsonFileStore<T>` (path, version guard, download/upload, debounced single-flight push, injected merge policy) under the Dropbox provider; delete ~250 duplicated lines (F39).
5. Define the logout contract on `AuthProvider.logout` and in the openspec auth spec: *logout removes all provider-scoped persisted data*; implement symmetrically; add per-adapter tests asserting post-logout storage is empty (F41).
6. Grow `constants/events.ts` into a typed `AppEventMap` with `on`/`dispatch` helpers owning the single sanctioned `detail` cast; move all names there — this also deletes the codebase's only providers→hooks inversion (F70).
7. Complete `STORAGE_KEYS` (with a one-time migration for the Spotify token key); lint-flag prefixed literals outside `constants/storage.ts` (F77).
8. Slim `ProviderContext`: one `removeFromEnabled` helper, one session-expiry flow, notification rendering moved to the UI layer via the event bus (F29). Fix `PinnedItemsContext`'s async side effects inside setState updaters, then enable StrictMode (F84, F103).

**Exit criteria.** A settings change made in one surface is visible in every other surface without a reload; `npm run test:run` passes under StrictMode; logout leaves zero provider-scoped keys/databases (proven by test).

### Pillar II — Product robustness

#### WS4: A coherent reliability story *(P5 — F6, F17, F20, F40, F60, F72, F75)*

**Problem.** No React error boundary and no global `error`/`unhandledrejection` hooks — a single render throw white-screens the player, tracelessly, since `logCaughtError` is DEV-only (F6). Two fully-built, typed, tested error channels are write-only: `PlaybackState.playbackError` and `useLibrarySync.syncError` have zero production consumers (F17). The typed provider-error contract dissolves into substring matching at the most user-visible seam (F20). ~40 bare `.catch(() => {})` swallows bypass the logCaughtError convention with no lint enforcement (F40). Notifications and diagnostics each have three competing channels (F72). Production error observability is zero by design (F75).

**Moves.**
1. Top-level ErrorBoundary with a reload-recovery card, plus per-surface boundaries around the existing lazy islands (LibraryRoute, SettingsV2, visualizers, QueueDrawer) so a feature crash can't kill playback; `unhandledrejection` routed into the same sink (F6).
2. Consume the channels that already exist: `playbackError` → toast + skip-on-error decision; `syncError` → dismissible banner; forward SDK errors into `playbackError` so all providers surface identically (F17).
3. Replace the substring classifier with a discriminated error union in TrackContext state (`{kind:'auth'; providerId} | {kind:'load'; message} | null`), assigned by `instanceof` at the catch site; map kinds to copy in `PlayerStateRenderer` (F20).
4. Add `swallow(context)` returning `(err) => logCaughtError(context, err)`; migrate the ~40 sites, classifying each as legitimately-silent vs needs-toast; ban empty `.catch()` via a custom lint rule (F40).
5. One notify seam (small notify service or typed mutation results rendered by one shell effect); extend CLAUDE.md: user-visible → notify, swallowed → `logCaughtError`, trace → `debugLog`; enable `no-console` (F72).
6. Make `logCaughtError` always push `{context, error, ts}` into a bounded ring buffer on `window` (console output stays DEV-only); DevBug attaches the buffer to reports (F75).

**Exit criteria.** Killing any lazy island in the mock e2e leaves audio playing and shows a recovery card; zero empty catch/`.catch()` in `src/` by lint.

#### WS5: Security & the web platform *(P7 — F7, F8, F16, F18, F41, F62, F87)*

**Problem.** The 268-line hand-rolled service worker is outside every quality gate and broken four ways — cache cleanup that never fires, phantom precache, a stale-shell window after deploys, and **persistent caching of authenticated Spotify API responses with no logout purge** (F7). Bearer/refresh tokens sit in localStorage with no CSP or modern security headers anywhere (F18). Spotify's OAuth lacks the CSRF `state` check its Dropbox twin implements and tests (F16). The Media Session API is entirely absent — the installable PWA is invisible to lock screens and hardware media keys (F8). The manifest has drifted (Spotify-only description, hard-locked portrait) (F62).

**Moves.**
1. Replace `sw.js` with `vite-plugin-pwa`/Workbox: build-manifest-driven precache (fixes phantom precache and stale shell atomically), automatic old-cache cleanup, runtime caching that **excludes** `api.spotify.com`/`accounts.spotify.com` (static assets + public art CDN only); one app-level online/offline listener pausing sync polling with a reconnect banner (F7).
2. Ship a CSP in `vercel.json`: `default-src 'self'; script-src 'self' https://sdk.scdn.co; connect-src` scoped to the enumerable Spotify/Dropbox/Last.fm origins; `style-src 'self' 'unsafe-inline'` (styled-components); `frame-ancestors 'none'`; plus `Strict-Transport-Security`. Verify against the mock e2e plus a manual SDK/EME playback check (F18).
3. Extract `PkceOAuthClient` (verifier/challenge, `state` param, single-flight refresh, terminal-vs-transient classification, injected storage keys); both adapters become thin configurations; Spotify immediately gains the state check; port the two Dropbox state tests (F16).
4. **After WS2 lands**: add `useMediaSession` — metadata from `MediaTrack`, transport handlers from the store, `setPositionState` from store emits; guard on `'mediaSession' in navigator`; e2e-test against the mock provider (F8).
5. True up the manifest (description, drop `orientation`, split `any`/`maskable` icons) and put it under the release checklist (F62).
6. Fold in the logout-purge contract from WS3 so the SW purge and IDB purge fire from one place (F41).

**Exit criteria.** Deploying a new version invalidates the old shell within one navigation; DevTools Application tab shows zero cached `api.spotify.com` entries; lock-screen controls work on a phone; securityheaders.com grade A.

#### WS6: Accessibility as a first-class dimension *(P7 — F9, F10, F11, F55, F56, F57, F58, F97)*

**Problem.** Three verified high-severity holes: the queue is effectively keyboard-inoperable (non-focusable rows, no `KeyboardSensor`, context menu reachable only by right-click/long-press, the one keyboard-reachable remove button is invisible when focused) (F9); the rAF canvas visualizers — default-on, viewport-filling — never honor `prefers-reduced-motion` (F10); keyboard activation of library cards is a silent no-op whenever a context menu is wired, i.e. across the entire main library surface (F11). Beyond those: drawers lack dialog semantics and focus management, and a closed drawer stays in the tab order (F55); global shortcuts hijack Space/arrows from focused controls (F56); the `--accent-contrast-color` threshold fails WCAG for the extractor's own output range — with a unit test enshrining a failing case (F57); zero automated a11y verification despite the full mock-provider rig (F58).

**Moves.**
1. Library fix first (smallest, highest reach): in `LibraryCard.handleClick`, detect non-pointer activation (`e.detail === 0`) and run `onSelect`; regression-test Enter on a card with a menu wired (F11).
2. Reduced motion at the single choke point: `useReducedMotion` in `BackgroundVisualizer`, return null/static frame; `aria-hidden` on the canvas (also stops the rAF loop — a free perf win) (F10).
3. Queue: focusable rows with Enter/Space selection and aria-labels; `KeyboardSensor` + `sortableKeyboardCoordinates` (the attributes spread already advertises sortable semantics); `:focus-visible` reveal for the remove button; a focusable trigger for the context menu (F9).
4. Drawers: shared modal-overlay treatment (focus save/move/restore, `inert` when closed, dialog semantics) — or rebuild on Radix Dialog per the codebase's own shadcn pattern (F55).
5. Shortcuts: early-return on `event.defaultPrevented`; exempt `target.closest('button, [role=button], [role=slider], …')` for Space/Enter/arrows; unit-test that Space on a focused button doesn't toggle playback (F56).
6. Compute real contrast ratios via the existing `getRelativeLuminance` for both candidate foregrounds; fix the enshrined test expectation (F57).
7. Institutionalize: `@axe-core/playwright` scans on the five key surfaces + one keyboard-journey spec (Tab → queue → select → reorder → Escape); `jest-axe` in the Vitest render helpers (F58). Zen-mode focus visibility picked deliberately (F97).

**Exit criteria.** The keyboard-journey spec passes; axe scans gate CI; a keyboard-only user can browse, play, queue, reorder, and remove.

### Pillar III — Craft & consistency

#### WS7: Component & styling coherence *(P2 — F12, F25, F26, F33, F36, F37, F38, F43, F79, F81, F82)*

**Problem.** `AudioPlayer` is a 633-line wiring hub over the project's own 500-line rule, with five copy-pasted toast callbacks and two hand-synced ~22-prop LibraryRoute mounts (F25). The queue surface is a five-site duplication web: twin shells with an identical 12-prop contract, the row body pasted four times, two competing overlay primitives (F12) — and the queue feature is a flat sprawl at components root reaching into LibraryRoute's private context-menu internals (F43). A vestigial *fourth* styling system (`src/components/styled/` + button mixins) duplicates shadcn primitives (F33). Three colliding token vocabularies — theme `primary`/`accent` contradict shadcn `--primary`/`--accent`, and the Vite starter purple ships in ~20 call sites (F36). The z-index scale is stale and re-declared as literals (F37); breakpoints are triplicated (F38); two theme-access idioms mix within single styled blocks (F79).

**Moves.**
1. `AudioPlayer` diet: `useQueueAddedToast` collapsing five callbacks; a shared `libraryRouteProps` object/host for the dual mount → ~350–400 lines, no behavior change (F25). Wire or delete the five-file dead `onStartRadioForCollection`; introduce a `PlaybackActions` context mirroring `BottomBarActionsContext` to kill the 3-layer prop drilling (F26).
2. Queue: create `src/components/Queue/`; keep both shells (interaction models genuinely differ — verified) but single-source `QueueSurfaceProps`, header, one `QueueTrackRowBody` composed by sortable/swipeable/read-only wrappers, one overlay primitive. SettingsV2 already proves this pattern (F12). Promote `MenuRoot`/`MenuItemButton`/`VirtualAnchor` + one roving-nav hook into `ui/` as THE context-menu pattern (F43).
3. Styling: migrate `PlayerStateRenderer`'s bespoke Button/Alert/Card to `ui/` primitives, delete the fourth system (F33, F81); one-time palette audit killing the starter purple and renaming colliding token keys (F36); z-index layer constants defined once and imported everywhere (F37); `breakpointPixels` as single source, derived and imported into tailwind config (F38); direct-import theme access as canonical, codemodded, lint-enforced (F79).
4. Sweep: consolidate inline SVGs into `components/icons/`, merge the two ResumeHeros, move `useIsTouchDevice` to hooks (F82).

**Exit criteria.** Every component file under 500 lines (machine-checked); `docs/architecture/shadcn.md`'s two-system claim is true; one grep for `#646cff` (starter purple) returns nothing.

#### WS8: Collapse duplication into shared primitives *(P2 — F16, F21, F34, F42, F44, F45, F46, F88, F98)*

**Problem.** Beyond WS3/WS5's OAuth and IDB collapses: retry/backoff in 5+ divergent copies, with the player Web API calls that most need hardening bypassing `spotifyApiRequest` entirely (F21); ~30 call sites hand-fetch a token and pass it to a function that already owns the auth dependency (F34); two divergent `useLongPress` implementations with user-feelable physics differences plus three copies of the direction-lock state machine (F42); `colorExtractor` duplicates its entire pipeline with asymmetric caching, and basic color math is reimplemented in four modules (F45); ~200 lines of write-only feature-detection probes (F46); structural-twin queue field loaders (F88); ad-hoc iOS sniffing via deprecated APIs (F98).

**Moves.**
1. One `authorizedFetch` primitive parameterized by the `ensureValidToken`/refresh/`reportUnauthorized` triad; one `withRetry(fn, policy)`; route player PUT/GETs through `spotifyApiRequest`; drop the token parameter from ~30 call sites (F21, F34).
2. One `useLongPress` superset; one direction-lock/touch-tracking core under the three swipe hooks (F42).
3. One `scoreImageColors(imageUrl)` pipeline cached by URL; color math consolidated into `colorUtils.ts`, imported by the worker too (F45).
4. Delete the dead feature-detection layer and unread sizing fields — pure deletion (F46).
5. Generic `useProgressiveTrackFieldResolver` under the two queue loaders, with one deliberate attempted-marking policy (F88).
6. `src/utils/platform.ts` exporting `isIOS()`/`isStandalonePWA()` as the single deprecation-acknowledged boundary (F98).

**Exit criteria.** One implementation each for: OAuth client, retry, IDB lifecycle, remote JSON sync, long-press, direction lock, color extraction, newest-wins. Each with its own tests; forks banned by review checklist.

#### WS9: Performance with evidence *(F22, F47, F48, F49, F50, F69, F73)*

**Problem.** The manual chunk strategy is empirically broken — the vendor chunk builds *empty* and React ships inside the 196 kB radix chunk, while the config docblock describes chunks that don't exist (F47). Playback position ticks are root-level React state re-rendering the app root ~8×/sec during Dropbox playback — while their only consumer's debounced save can mathematically never fire (F22). CmdK re-reads the entire library from IndexedDB on every debounced keystroke (F48). The queue renders every row unvirtualized against unbounded queues (F49). Session persistence JSON-serializes the whole queue to localStorage on the main thread every 10s (F50). `TrackContext`'s split is defeated by `handleShuffleToggle` identity churn (F69). `PlayerSizingProvider` is mounted twice, one fully shadowed (F73).

**Moves.**
1. Fix chunks with a function-form `manualChunks` (or delete and rely on auto-chunking + existing dynamic imports); restore the 500 kB warning limit; CI assertion on empty configured chunks / main-chunk byte budget (F47).
2. Position ticks move into the WS2 PlaybackStore (subscribed only where rendered); delete the Dropbox 250ms interval (`timeupdate` already streams) (F22).
3. CmdK: build the corpus once in memory, invalidate on existing sync-engine write events, filter per keystroke (F48).
4. Virtualize queue rows (dnd-kit + fixed row height or `@tanstack/react-virtual`); interim: window around `currentTrackIndex` (F49).
5. Persist a bounded session window (`currentIndex ± ~100` + collection ref), or ids rehydrated from cache (F50).
6. Stabilize TrackContext mutator identities via the established latest-value-ref pattern; delete the shadowed sizing provider mount (F69, F73).

**Exit criteria.** React/radix/vendor chunk placement asserted in CI; root re-render count during playback measured via the existing `[Profiling]` counter ≈ per-track, not per-tick; 1,000-track queue opens without jank.

### Pillar IV — The engineering system

#### WS10: Close the toolchain blind spots *(P3 — F23, F32, F51, F52, F53, F71, F74, F76, F78, F80, F83, F85, F92, F93, F94, F100)*

**Problem.** ~44k LOC of tests and all Playwright code are excluded from typechecking; `scripts/` runs below the declared strictness baseline (F23). No coverage measurement or thresholds anywhere (F51). knip and `npm audit` unwired — audit failing with 3 critical / 2 high, all clearable by `npm update` (F52). ESLint runs without type information — and for the excluded test code it's the *only* static analysis (F85). 14 banned `!` assertions and 13 optional-and-nullable fields remain from the strictness epic, unenforced (F32). Six circular import chains held safe only by type-erasure (F93). E2e runs only against the dev server, so production-build regressions (like the empty vendor chunk) are structurally invisible (F74); every spec self-skips on empty snapshots with no CI guard (F71). The Spotify SDK/API boundary is untested while every layer above mocks it away (F53). Cross-provider handoff — a headline capability — has no direct test of its core seam and is e2e-untestable because the committed Dropbox snapshot is empty (F83).

**Moves.**
1. `tsconfig.test.json` + `tsconfig.e2e.json` with the full flag set, referenced from root `tsc -b`; align `scripts/`; budget a one-time drift-fix pass (F23).
2. CI: coverage with per-directory thresholds at current measured levels (ratchet-only); knip step; `audit:ci` step after `npm update` clears the backlog (F51, F52).
3. Type-aware lint (`recommendedTypeChecked` + `projectService`, scoped to `src/` first): `no-floating-promises`, `no-unsafe-*` (F85). Finish the strictness epic with one bounded cleanup PR, then turn on `no-non-null-assertion` as error and extend the props rule to reject `| null` in optional Props fields (F32).
4. Layering: declare the order (types/constants → utils → services → providers → hooks/contexts → components) in CLAUDE.md; enforce with import zones; `madge --circular` in CI holding the count at zero; fix the six chains by pointing type imports at leaf modules (F76, F93).
5. E2e integrity: CI webServer = `build` + `vite preview`; Playwright browser cache; empty-fixture hard-fail under CI; commit a minimal synthetic Dropbox snapshot (2 folder-albums reusing bundled clips) so the cross-provider handoff spec becomes possible; add the transition-matrix unit test for `useProviderPlayback` (F74, F71, F83).
6. Boundary tests for `SpotifyPlayerService`/`spotifyPlayerPlayback` (global fetch mock + fake timers: transfer/backoff/429/shuffle; stub `window.Spotify.Player` for settle-once semantics) (F53).
7. Test infrastructure: one `MediaTrack` factory, Map-backed localStorage fake (F92); scripts converted to `.ts`, deploy runs tests and uses `--prebuilt` (F80); vite-env typing fixed (F100); `spotify.d.ts` header rewrite (F78).
8. Dependency policy: routine `npm update` now; one coordinated upgrade RFC for React 19 + Vite 8 + Vitest 4 later — explicitly not piecemeal (F94).

**Exit criteria.** `tsc -b` covers 100% of TS in the repo; CI fails on: coverage regression, knip findings, audit ≥ high, circular value imports, empty e2e run, chunk misplacement.

#### WS11: Documentation & specs as enforced source of truth *(F54, F59, F60, F61, F64, F65)*

**Problem.** The openspec change lifecycle has stalled: 9 of 10 active changes are fully implemented but never archived, leaving the declared source-of-truth specs stale in both directions (F54). CLAUDE.md contains verifiably false structural claims (F59). User docs describe a retired UI generation (F60). ArrowDown/L behavior is contradicted across three docs because the code-level wire is dead (`onOpenLibrary` declared, documented, passed, never invoked) (F61). Spec coverage is inversely proportional to subsystem complexity: radio (~890 LOC), cache/sync (~1,460 LOC), and session persistence have no capability spec (F64). The docs/ vs openspec/ boundary is undeclared (F65).

**Moves.**
1. `/opsx:bulk-archive` the eight completed changes; reconcile the two stragglers; add a CI/PR-template guard failing when a change's tasks.md is 100% checked for > N days without archive (F54).
2. Claims-audit CLAUDE.md and README; rewrite the user-guide sections against current surfaces; delete the dead `onOpenLibrary` wire and make `keyboard.md` the single normative table (F59, F60, F61).
3. Author the three missing capability specs — radio-generation, library-cache-sync, session-resume — seeded from the prose already in the architecture docs (F64).
4. Declare the boundary once (specs = normative behavior; architecture = mechanism; features = reference), cross-link, and index both in `docs/README.md` (F65).

**Exit criteria.** Zero unarchived-but-complete changes; every CLAUDE.md structural claim greps true; each major subsystem has a capability spec.

#### WS12: Contain and finish DevBug *(F66, F67, F87, F89, F91, F99, F101, F102, F104)*

**Problem.** DevBug (~2.9k LOC) ships in the production bundle guarded only by incidental tree-shaking — and it guards a repo-write GitHub token (F87). Its selector generator emits `:nth-child` with nth-of-type indexing, so bug-report selectors match the wrong element (F66). Its area-select generality is unreachable dead plumbing (F67); `FeedbackPanel` is 622 lines with a 353-line inline CSS string (F91); half the context API is dead (F89); it hardcodes repo coordinates and commits screenshots directly to the default branch (F102).

**Moves.**
1. Make the production boundary structural: `React.lazy` import inside the DEV branch; CI grep over `dist/` asserting absence, so a tree-shaking regression fails loudly instead of shipping a secret (F87).
2. Fix the selector semantics with a round-trip test (F66); thread area-select through honestly or delete the plumbing (F67); extract the CSS to a documented sibling module (F91); collapse the dead context API (F89) and the duplicate `ConsoleEntry` type (F104).
3. Move repo coordinates to env; upload screenshots to an orphan branch or embed them, so bug reporting stops committing to `main` (F102); route Ctrl+Shift+D through the keyboard registry or document the exception (F101); add hook-layer tests (F99).

**Exit criteria.** `dist/` provably DevBug-free in CI; bug reports reference the right element; no writes to `main`.

---

## 5. Roadmap

Sequencing follows dependency and risk, not severity alone. Every phase keeps the suite green (P8).

| Phase | Theme | Contents | Size |
|---|---|---|---|
| **0 — Stop the bleeding** | Correctness & safety quick wins, all independently landable | `npm update` (clears 3 critical / 2 high advisories) · error boundaries + `unhandledrejection` (F6) · liked-songs invalidation (F5) · reduced-motion choke point (F10) · LibraryCard Enter fix (F11) · shortcut hijack fix (F56) · chunk fix (F47) · CSP + headers (F18) · SW replacement with vite-plugin-pwa (F7) · double-mounted sizing provider (F73) · vite-env typing (F100) | days |
| **1 — Trust the tooling** | Make the quality system see everything before big migrations begin | typecheck tests/e2e/scripts (F23) · coverage ratchet, knip, audit in CI (F51, F52) · type-aware lint + strictness-epic finish (F85, F32) · layering declaration + import zones + madge (F76, F93) · e2e against prod build + empty-fixture guard + Dropbox snapshot (F74, F71, F83) · same-tab localStorage channel (F4) · logout-purge contract (F41) | ~1–2 weeks |
| **2 — The playback engine** | WS2 in full: PlaybackStore → QueueStore → restore unification → newest-wins helper. Then the consumers that were blocked on it: Media Session (F8), position-tick perf (F22), SDK boundary tests (F53) | largest single migration; strangler-fig, one store at a time | ~2–3 weeks |
| **3 — The domain model** | WS1 in full: neutral currency → CollectionRef → descriptor extension points → capability unification → dead-surface retirement → rename pass. Unlocks cross-provider search and third-provider readiness | second-largest; mostly mechanical after the cache re-keying | ~2–3 weeks |
| **4 — Consolidation** | WS7 (component/styling coherence) · WS8 (shared primitives) · WS9 remainder (CmdK corpus, queue virtualization, session window) · WS6 remainder (queue keyboard, drawers, axe gates) · WS4 remainder (error channels, notify seam) | parallelizable; fits the project's swarm/epic tooling | ~2–3 weeks |
| **5 — Institutionalize** | WS11 (specs/docs trueing + missing capability specs + lifecycle guard) · WS12 (DevBug) · dependency-upgrade RFC (React 19/Vite 8/Vitest 4) · final CLAUDE.md update encoding every new convention + lint rule | ongoing discipline | ~1 week + standing |

Phases 2 and 3 are deliberately separated: both touch `usePlayerLogic`'s neighborhood, and interleaving them multiplies risk. Phase 1 must precede both — the migrations need typechecked tests and layering enforcement to be safe. Within phases 4–5, workstreams are independent and suit the project's existing multi-agent epic workflow (architect + builders + reviewer + tester, stacked PRs into a feature branch).

---

## 6. What we explicitly will NOT do

Considered and rejected — recorded so they aren't relitigated:

- **No framework or state-library adoption.** The playback/queue stores are small bespoke modules consumed via `useSyncExternalStore`. Redux/Zustand/XState would add a dependency and a second idiom for what two ~150-line modules with existing test harnesses express fine.
- **No queue-shell unification.** `QueueDrawer` and `QueueBottomSheet` have genuinely different interaction models (verified). Share the contract, header, row body, and overlay — keep two shells.
- **No styled-components exit.** The two-system stack (styled-components + shadcn/Tailwind primitives) is documented and workable; the RFC kills the *vestigial fourth* system and the token collisions, not the stack. A wholesale CSS migration would burn the entire budget for negative user value.
- **No docs/openspec merger.** The two systems serve different readers; the fix is a declared boundary and cross-links (WS11), not consolidation.
- **No piecemeal major-version chasing.** React 19 / Vite 8 / Vitest 4 / Tailwind 4 land via one coordinated upgrade RFC after Phase 3, when the churn surface is smallest. `npm update` within current majors happens now (it clears the security backlog).
- **No rewrite of the provider contract.** It is the best part of the codebase. WS1 makes its consumers honor it; it does not redesign it.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| The Phase 2 store migration destabilizes playback — the app's core | Strangler-fig per store; the async-race harness (#1675) ported to the store API *first*; mock-provider e2e covers hydrate/handoff/auto-advance before any consumer flips; feature-flag the store behind the existing pattern if needed |
| Cache re-keying (Phase 3) invalidates users' local libraries | One-time IndexedDB schema bump with migration, or accept a one-time cold resync (cache is a derived store; the sync engine rebuilds it) — decide in the Phase 3 design doc |
| CSP breaks Spotify SDK/EME playback in a way tests can't see | Manual verification checklist on preview deploy (SDK load, DRM playback, OAuth popups) before production; CSP ships in report-only mode for one deploy first |
| Typechecking 44k LOC of excluded tests surfaces a large drift backlog | Time-boxed fix pass; `@ts-expect-error` with issue links for the tail; ratchet via CI so the count only decreases |
| The program stalls halfway, leaving two idioms everywhere | Phase gates: each workstream's exit criteria are lint/CI checks, so "done" is machine-verified; no phase starts until the previous phase's checks are green in CI |

## 8. Acceptance: what "S-tier" verifies as

The end state is not a vibe; it is a checklist, most of it machine-enforced:

1. **One owner per state** — greps for `mediaTracksRef`, `expectedTrackIdRef`, duplicate position stores return only the store modules.
2. **One implementation per concern** — OAuth, retry, IDB, remote sync, gestures, color, newest-wins each exist exactly once, tested.
3. **Neutral currency** — no Spotify wire types above the adapter boundary (lint-enforced import zones); CmdK finds Dropbox tracks.
4. **Typed errors end-to-end** — zero substring classification; zero silent swallows (lint-enforced).
5. **Platform obligations met** — error boundaries, Media Session, managed SW, CSP grade A, axe gates green, keyboard journey passes.
6. **Toolchain totality** — `tsc -b` sees every TS file; coverage ratcheted; knip/audit/madge/chunk checks in CI.
7. **Docs that grep true** — specs archived on merge, capability specs for every major subsystem, CLAUDE.md claims-audited.
8. **All 12 high-severity findings closed; zero regressions on the strengths inventory in §2.**

---

## Appendix A: Findings inventory

103 findings; severity is post-verification. ✓ = confirmed exactly as stated; ± = confirmed with scope corrections; L = low-severity, spot-checked but not adversarially verified. Full evidence with file:line citations lives in the audit record; titles are self-describing.

### High (12)

| ID | V | Category | Finding |
|---|---|---|---|
| F1 | ✓ | architecture | Spotify-shaped types (`Track`/`PlaylistInfo`/`AlbumInfo`) are the app-wide library model; the provider-neutral domain layer is inverted |
| F2 | ✓ | abstraction | Two coexisting collection-identity schemes: prefix-encoded string IDs and typed `CollectionRef` leak into each other, plus four competing callback shapes at the UI seam |
| F3 | ± | architecture | Playback state has no single source of truth: three parallel provider subscriptions, duplicate isPlaying/position stores, six driving-provider heuristics, cross-file mutable-ref protocols |
| F4 | ✓ | state-sync | localStorage state has no same-tab change channel: multi-mounted `useLocalStorage` instances silently desync; non-hook writers clobber synced accent colors |
| F5 | ✓ | correctness | IndexedDB liked-songs track list never invalidated on save/unsave — stale Liked Songs served for up to 24h |
| F6 | ✓ | error-handling | No React error boundary and no global error/unhandledrejection hooks — any render throw white-screens the player |
| F7 | ✓ | correctness | Hand-rolled 268-line service worker outside every quality gate, broken four ways, caching authenticated Spotify responses with no logout purge |
| F8 | ✓ | architecture | Media Session API entirely absent — the installable PWA player is invisible to lock screens and hardware media keys |
| F9 | ± | accessibility | Queue is effectively keyboard-inoperable: non-focusable rows, no KeyboardSensor, unreachable context menu, invisible focused remove button |
| F10 | ✓ | accessibility | rAF canvas visualizers — default-on, viewport-filling — never honor `prefers-reduced-motion` |
| F11 | ✓ | accessibility | LibraryCard keyboard activation is a silent no-op whenever a context menu is wired — the entire main library surface |
| F12* | ✓ | type-safety | 44k LOC of tests and all Playwright code excluded from typechecking; scripts below declared strictness (listed as F23 in workstreams) |

### Medium (55)

| ID | V | Category | Finding |
|---|---|---|---|
| F13 | ± | architecture | Dual queue store — React state + imperative `mediaTracksRef` mirror — hand-synced at 17 write sites across 6 files |
| F14 | ± | architecture | Legacy `useSpotifyPlaylistManager` bypasses PlaybackProvider with drifted retry logic; `playCollection`/`next`/`previous` dead contract surface |
| F15 | ± | architecture | Dual Spotify catalog implementation: sync engine bypasses the CatalogProvider adapter, leaving `listCollections` dead in every configuration |
| F16 | ± | duplication | PKCE OAuth lifecycle duplicated per provider with security hardening drifting — Spotify lacks the CSRF state check Dropbox implements |
| F17 | ± | error-handling | Two fully-built, typed, tested error channels are write-only: `playbackError` and `syncError` have zero production consumers |
| F18 | ± | security | Bearer/refresh tokens in localStorage with no CSP or modern security headers anywhere |
| F20 | ± | error-handling | Typed provider-error contract dissolves into substring matching at the most user-visible seam |
| F21 | ± | duplication | Token-refresh/retry/backoff gateway logic in 5+ divergent copies; the player API calls that most need it bypass the hardened path |
| F22 | ± | performance | Playback position ticks are root-level React state (~8×/sec app-root re-renders); the debounced save consuming them can never fire |
| F24 | ✓ | duplication | `useQueueManagement` repeats the append/dedupe/shuffle invariant three times |
| F25 | ✓ | complexity | AudioPlayer is a 633-line wiring hub over the 500-line rule: five copy-pasted toast callbacks, two hand-synced ~22-prop mounts |
| F26 | ± | abstraction | Mini-player actions/sizing drilled 3 layers past the actions-context pattern; `onStartRadioForCollection` is a five-file dead wire |
| F28 | ± | abstraction | Two competing optional-feature mechanisms — capability flags vs method presence — each cover half the surface |
| F29 | ± | architecture | ProviderContext: overgrown 371-line 17-field mixed-concern context; triplicated mutation logic; toast copy in the data layer |
| F30 | ± | api-design | `loadCollection` returns the internal generation counter as its "track count" when superseded → bogus toast |
| F31 | ± | duplication | Two parallel session-restore paths; `handleResume` lacks the playability fallback |
| F32 | ± | type-safety | Strictness-epic residue: 14 banned `!` assertions, 13 optional-and-nullable fields, mutability-lying double casts |
| F33 | ± | duplication | Vestigial fourth styling system (`components/styled/` + button mixins) duplicates shadcn primitives |
| F34 | ✓ | abstraction | Token plumbing ceremony: ~30 call sites fetch a token for a function that already owns the auth dependency |
| F35 | ± | duplication | Three independent IndexedDB lifecycle stacks with divergent, silently-lossy fallback semantics |
| F36 | ± | consistency | Three colliding token vocabularies; Vite starter purple ships in ~20 call sites |
| F37 | ± | consistency | z-index scale stale and re-declared as literals held in sync only by comments |
| F38 | ✓ | duplication | Breakpoint scale triplicated; `containerBreakpoints` dead; container queries hardcode values |
| F39 | ± | duplication | Dropbox `/.vorbis` remote-JSON sync triplicated across likes/preferences/playlists |
| F40 | ± | consistency | ~40 bare `.catch(() => {})` swallows bypass the logCaughtError convention, unenforced |
| F41 | ± | security | No logout data-purge contract: Dropbox logout leaves its entire IndexedDB behind |
| F42 | ✓ | duplication | Two divergent `useLongPress` implementations + three copies of the direction-lock state machine |
| F43 | ± | architecture | Queue feature is flat sprawl at components root, reaching into LibraryRoute's private context-menu internals |
| F44 | ± | abstraction | Newest-wins async guard hand-rolled 8+ times in three idioms; one path unguarded |
| F45 | ✓ | duplication | colorExtractor duplicates its entire pipeline; color math reimplemented in four modules |
| F46 | ± | dead-code | Dead speculative feature-detection layer: ~25 probes feeding ~3 fields (~200 write-only lines) |
| F47 | ✓ | performance | Manual chunk strategy empirically broken: vendor chunk builds empty; React ships in the radix chunk |
| F48 | ± | performance | CmdK search re-reads the entire library from IndexedDB per debounced keystroke |
| F49 | ✓ | performance | Queue renders every row unvirtualized against unbounded queues |
| F50 | ✓ | performance | Session persistence serializes the whole queue to localStorage on the main thread every 10s |
| F51 | ✓ | ci-enforcement | No coverage measurement or thresholds anywhere in CI |
| F52 | ✓ | ci-completeness | knip and npm audit not in CI; audit failing 3 critical / 2 high, all clearable by `npm update` |
| F53 | ± | test-coverage | Spotify SDK/API boundary layer untested while every layer above mocks it away |
| F54 | ✓ | docs-drift | OpenSpec lifecycle stalled: 9 of 10 active changes implemented but never archived |
| F55 | ± | accessibility | Custom queue drawers lack dialog semantics and focus management; closed drawer stays in tab order |
| F56 | ± | accessibility | Global shortcuts hijack Space/arrows from focused interactive controls |
| F57 | ± | accessibility | `--accent-contrast-color` threshold fails WCAG for the extractor's own output; a test enshrines a failing case |
| F58 | ✓ | testing | Zero automated accessibility verification despite 2,040 tests and the full mock rig |
| F59 | ± | docs-drift | CLAUDE.md contains verifiably false structural claims |
| F60 | ± | docs-drift | User/feature docs describe a retired UI generation |
| F61 | ✓ | docs-drift | ArrowDown/L contradicted across three docs; `onOpenLibrary` is a dead wire |
| F62 | ✓ | docs-drift | PWA manifest drifted: Spotify-only description, hard-locked portrait, combined icon purpose |
| F64 | ± | docs-coverage | Spec coverage inversely proportional to complexity: radio, cache/sync, session persistence unspecified |
| F66 | ✓ | correctness | DevBug `generateCssSelector` emits `:nth-child` with nth-of-type indexing — wrong-element bug reports |
| F67 | ✓ | abstraction | DevBug pipeline generality unreachable: selectionMode hardcoded; area-select discards elements |
| F87 | ± | architecture | DevBug's production exclusion is incidental tree-shaking guarding a repo-write GitHub token |
| F91 | ✓ | consistency | FeedbackPanel: 622 lines, 353-line inline CSS string, no-op useCallback, uncleaned timers |
| F19 | ± | architecture | Dropbox-specific services hard-wired into provider-neutral contexts (incl. a Dropbox event imported by ProviderContext) |
| F23 | — | — | *(= F12 above: typechecking exclusions; cross-referenced from workstreams)* |

### Low (36)

| ID | Category | Finding |
|---|---|---|
| F69 | performance | TrackContext split defeated: `handleShuffleToggle` identity churn re-renders all seven TrackList consumers |
| F70 | architecture | CustomEvent bus: two-thirds of names minted outside the registry, untyped; sole providers→hooks inversion |
| F71 | e2e-integrity | Playwright suite can silently degrade to a no-op via empty-snapshot self-skips |
| F72 | consistency | Notifications and diagnostics each have three competing channels |
| F73 | duplication | `PlayerSizingProvider` mounted twice; App-level instance fully shadowed |
| F74 | ci-completeness | CI e2e runs only against the dev server; prod-build regressions invisible |
| F75 | error-handling | Production error observability is zero by design (DEV-only logCaughtError) |
| F76 | architecture | Layering discipline real but undeclared and unenforced |
| F77 | consistency | STORAGE_KEYS incomplete; Spotify tokens under raw unprefixed literals |
| F78 | docs-drift | `spotify.d.ts` header documents nonexistent types; over-broad global injection |
| F79 | consistency | Two competing theme-access idioms (74 vs 32 files), mixed within single styled blocks |
| F80 | consistency | `scripts/` mixes five module conventions; deploy installs a global CLI, double-builds, skips tests |
| F81 | consistency | PlayerStateRenderer inlines three loading-card copies with hand-rolled inline styles |
| F82 | duplication | Two `useIsTouchDevice`s, twice-defined ResumeHero, inline SVGs in 21 files despite `icons/` |
| F83 | test-coverage | Cross-provider handoff has no direct seam test; e2e-untestable (empty Dropbox snapshot) |
| F84 | correctness-hygiene | PinnedItemsContext runs async side effects inside setState updaters (StrictMode landmine) |
| F85 | type-safety | ESLint runs without type information — sole static analysis for excluded test code |
| F86 | consistency | Provider access has two sanctioned channels (context vs registry singleton) used interchangeably |
| F88 | duplication | `useQueueThumbnailLoader`/`useQueueDurationLoader` structural twins with unexplained divergence |
| F89 | dead-code | DevBug mode state duplicated; half the DevBugContext API dead |
| F90 | api-design | `useSessionPersistence` takes 11 positional params; `useAccentColor` injects raw setters positionally |
| F92 | duplication | Shared test-fixture factories duplicated in 24 files; two near-identical MediaTrack factories |
| F93 | architecture | Six circular import chains held safe only by type-erasure |
| F94 | dependencies | React/Vite/Vitest/Tailwind each 1+ major behind; html2canvas unmaintained; lucide-react is fine |
| F95 | duplication | `getExternalUrls` builder and descriptor metadata duplicated between real and mock providers |
| F96 | consistency | Track-list cache keys built from inline literals in six files |
| F97 | accessibility | Zen-mode transport buttons invisible when keyboard-focused |
| F98 | consistency | Platform detection ad hoc, via deprecated `navigator.platform` |
| F99 | testing | DevBug component/hook layer has zero tests (service layer fully covered) |
| F100 | type-safety | `vite-env.d.ts` stale both directions: one phantom var, four real vars typed `any` |
| F101 | consistency | Ctrl+Shift+D bypasses the centralized keyboard system, undocumented |
| F102 | error-handling | DevBug hardcodes repo coordinates and commits screenshots to the default branch |
| F65 | architecture | docs/ vs openspec/ boundary undeclared, uncross-linked; `docs/README.md` indexes neither |
| F68 | naming | Provider-neutral player code carries Spotify/legacy names (`SpotifyPlayerControls`, `useSpotifyControls`, `SettingsV2`, `showVisualEffects`) |
| F103 | abstraction | DropboxPlaybackAdapter mixes ID3 parsing, metadata enrichment, and art caching into the 534-line playback adapter |
| F104 | type-safety | DevBug `ConsoleEntry` defined twice with divergent shapes, violating the canonical-types convention |

*Verification note: F12/F23 are the same finding cross-referenced from two workstreams; the inventory preserves both handles.*
