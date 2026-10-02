# Architecture v2 — agent handoff

**Initiative label:** [`project:vorbis-player-architecture-v2`](https://github.com/smallorbit/vorbis-player/labels/project%3Avorbis-player-architecture-v2) (RFC 0001)  
**Working mode:** **one workstream (epic) at a time**; within an epic, **one child issue at a time**.  
**Updated:** 2026-10-02 (WS7 #1739 in progress)

Source of truth for issue text is GitHub. Epic bodies cite `docs/rfcs/0001-s-tier-codebase.md`, which is **not yet on `main`** — landing that RFC is part of **[WS11](https://github.com/smallorbit/vorbis-player/issues/1757)**.

---

## Status snapshot

| WS | Epic | State |
|----|------|--------|
| WS1 | [#1685](https://github.com/smallorbit/vorbis-player/issues/1685) Neutral domain model | **Done** |
| WS2 | [#1692](https://github.com/smallorbit/vorbis-player/issues/1692) PlaybackStore + QueueStore | **Done** |
| WS3 | [#1699](https://github.com/smallorbit/vorbis-player/issues/1699) State, persistence & events | **Done** |
| WS10 | [#1729](https://github.com/smallorbit/vorbis-player/issues/1729) Close the toolchain blind spots | **Done** (8/8) |
| WS7 | [#1738](https://github.com/smallorbit/vorbis-player/issues/1738) Component & styling coherence | **In progress** (0/4 → #1739) |
| WS4–WS6, WS8–WS9, WS11–WS12 | Reliability → DevBug | Open (one epic at a time) |

Pre-initiative foundations already on `main`: async-race harness, honest e2e, full CI gate (coverage + knip + audit ≥ high).

---

## Do this next

### Immediate: continue WS7 at #1739

Epic: **[#1738 — Component & styling coherence](https://github.com/smallorbit/vorbis-player/issues/1738)**

| # | Issue | State | Notes |
|---|--------|--------|--------|
| **1739** | **Put AudioPlayer on a diet and add a PlaybackActions context** | **← active** | F25, F26 |
| 1740 | Consolidate the queue feature into `src/components/Queue/` | Open | |
| 1741 | Delete the fourth styling system and unify tokens | Open | |
| 1742 | Sweep: icons, ResumeHero, useIsTouchDevice | Open | |

### WS10 closed (reference)

**[#1729](https://github.com/smallorbit/vorbis-player/issues/1729)** — policy: [`docs/dependency-upgrades.md`](../dependency-upgrades.md), RFC 0002.

---

## WS3 closed summary (reference)

| # | Issue | PR |
|---|--------|-----|
| 1700 | Same-tab `localStorage` broadcast | [#1771](https://github.com/smallorbit/vorbis-player/pull/1771) — `persistedStorage.ts` / `useLocalStorage` |
| 1701 | Invalidate IndexedDB liked-songs on save/unsave | [#1773](https://github.com/smallorbit/vorbis-player/pull/1773) |
| 1702 | One IndexedDB foundation + degradation policy | [#1775](https://github.com/smallorbit/vorbis-player/pull/1775) — `src/services/idb` |
| 1703 | `RemoteJsonFileStore<T>` under Dropbox | [#1776](https://github.com/smallorbit/vorbis-player/pull/1776) |
| 1704 | Logout data-purge contract | [#1777](https://github.com/smallorbit/vorbis-player/pull/1777) — `providerDataPurge.ts` |
| 1705 | Typed `AppEventMap` in `constants/events.ts` | [#1778](https://github.com/smallorbit/vorbis-player/pull/1778) |
| 1706 | Complete `STORAGE_KEYS` + prefix convention | [#1779](https://github.com/smallorbit/vorbis-player/pull/1779) |
| 1707 | Slim `ProviderContext` + StrictMode | [#1780](https://github.com/smallorbit/vorbis-player/pull/1780) — `removeFromEnabled`; toast via events; PinnedItems dirty-flag persist; `dropboxMetadataEnrichment.ts`; `<StrictMode>` in `main.tsx` |

### Known follow-ups (do **not** block WS10)

- Session hydrate clears on-disk session via `resetLastSession`; debounced re-save often never lands while position ticks reset the timer. Re-prime falls back to **PlaybackStore** cursor (`useProviderPlayback`).
- Accent/pin maps may still hold Dropbox-shaped album paths after Dropbox logout — product/gray area; not part of the #1704 enumerable purge set.
- `docs/rfcs/0001-s-tier-codebase.md` still missing from the tree → WS11.
- In-place IDB patch of liked-songs (vs full remove from #1701) was deferred; revisit only if refetch cost after save/unsave becomes measurable.

---

## Context for #1731 (merged)

Wire coverage ratchet, knip, and `npm audit` into CI (F51, F52). On `main` via [#1783](https://github.com/smallorbit/vorbis-player/pull/1783).

- CI `checks` job: `npm run knip`, `npm run audit:ci` (`--audit-level=high`), `npm run test:coverage` (replaces `test:run`)
- Coverage: `all: true` over `src/**/*.{ts,tsx}`; excludes `src/main.tsx` and `src/workers/**`. Per-directory **threshold floors removed** (report-only); historically ratcheted in `vite.config.ts` until #1737 follow-up.
- knip: `ignoreExportsUsedInFile` for types; ambient `.d.ts` ignored; dead re-exports removed so `npx knip` is clean
- Audit: `npm update` + `sharp@^0.35.4`. Remaining vitest advisories are **moderate** → #1737

---

## Context for #1732 (merged)

Turn on type-aware lint and finish the strictness epic (F85, F32). On `main` via [#1785](https://github.com/smallorbit/vorbis-player/pull/1785).

- `eslint.config.js`: `projectService` on production `src/**/*.{ts,tsx}` (excludes `__tests__`, `src/test`) — `no-floating-promises`, `no-unsafe-*`, `no-non-null-assertion`
- `vorbis/props-explicit-undefined`: optional Props fields must not include `| null` (F32)
- Shared parsers: `oauthTokenResponse.ts`, `authPostMessage.ts`, `spotifyApiErrorBody.ts` (+ unit tests)

**Deferred (do not expand #1734 to cover unless required):** extend the same type-aware ESLint block to `src/**/__tests__/**` and `src/test/**` once layering is stable.

---

## Context for #1733 (merged)

Declare and enforce the layering order (F76, F93).

- **Docs:** `CLAUDE.md` layering subsection + [`docs/architecture/layering.md`](layering.md)
- **ESLint:** `import/no-restricted-paths` zones in `eslint.config.js` (`eslint-layer-zones.js`; production `src/`, excludes tests and `src/types/**/*.d.ts`)
- **CI:** `npm run check:circular` (`madge` devDependency) after typecheck in `.github/workflows/ci.yml`
- **Cycles:** six Dropbox/IDB chains broken — `IdbDatabaseHandle` → `services/idb/types.ts`; Dropbox modules use `dropboxAuthHandle.ts` (token surface); `providerRegistry` → `services/providerRegistry.ts`; logout purge → `providers/providerDataPurge.ts` + `services/spotify/purgePersistedData.ts`; provider errors → `types/providerErrors.ts`

## Context for #1734 (merged)

Make e2e run against the prod build with a synthetic Dropbox snapshot (F74, F71, F83).

- **Playwright:** `webServer` runs `npm run preview:e2e` (`build:e2e` bakes `VITE_MOCK_PROVIDER=true`, then `vite preview` on port 3000)
- **CI:** Playwright browser cache (`~/.cache/ms-playwright`); longer webServer timeout for prod build
- **Fixtures:** committed synthetic `dropbox-snapshot.json`; `require-snapshot.ts` hard-fails on hollow fixtures (no silent skips)
- **Unit:** `useProviderPlayback.transitionMatrix.test.ts` — cross-provider pause / driving-provider matrix

## Context for #1735 (merged)

Add boundary tests for the Spotify SDK/API layer (F53).

- **`spotifyPlayerPlayback.test.ts`:** fetch boundary — shuffle-once, play payload, 429 + `Retry-After`, transfer retry/backoff, device-active polling
- **`spotifyPlayer.boundary.test.ts`:** stub `window.Spotify.Player` — transfer TTL vs `force`, `waitForPlaybackOrResume` settle-once + timeout fallback

## Context for #1736 (merged)

Clean up test infrastructure and scripts (F92, F80, F100, F78).

- **F92:** `createStorageMock()` in `src/test/storageMock.ts`; Vitest setup uses Map-backed storage; `makeMediaTrack` removed — single `makeTrack()` in `src/test/fixtures.ts` with provider-aware defaults; duplicate inline factories migrated across tests (fixed recursive shadow in `usePlayerLogic.radio.test.tsx`)
- **F80:** `scripts/deploy.ts`, `check-node-modules.ts`, `generate-favicon.ts` (tsx); deploy runs `test:run` before build; Vercel examples use `npx vercel deploy --prebuilt` + `vercel build` when target includes `--prebuilt`
- **F100:** `vite-env.d.ts` — drop phantom `VITE_DROPBOX_APP_KEY`; optional env vars typed correctly
- **F78:** `spotify.d.ts` header documents Web Playback SDK globals only

## Context for #1737 (merged)

Set the dependency-upgrade policy (F94).

- **Policy:** [`docs/dependency-upgrades.md`](../dependency-upgrades.md) — routine `npm update` vs coordinated majors; audit:ci ≥ high; no `audit fix --force` on main; html2canvas DevBug-only
- **RFC:** [`docs/rfcs/0002-coordinated-toolchain-upgrade.md`](../rfcs/0002-coordinated-toolchain-upgrade.md) — Proposed; React 19 + Vite 8 + Vitest 4+ (+ Tailwind 4 in same window)
- **Moderate Vitest advisories** remain until RFC implementation

---

## Agent operating notes

- Branch from latest `main`; name `cursor/<slug>-<cloud-suffix>` when using the cloud branch convention (suffix varies per run).
- Target PRs at `main`; conventional commits; run `npm test` / `npm run test:run` before push. PRs squash-merge; mark draft ready before merge.
- Staging: workflow **Deploy PR to Staging** (`workflow_dispatch` + `pr_number`). Cloud agent `gh` is often **read-only** for dispatch — equivalent plumbing is rebuild `staging` from `main`, merge `pull/N/head`, `git push --force-with-lease origin staging`.
- Prefer issue-sized PRs; tick closed children on epic [#1729](https://github.com/smallorbit/vorbis-player/issues/1729) when editing is available.
- Update **this file** when finishing a child or switching epics so the next agent has a current pointer.

---

## Quick links

- Label board: https://github.com/smallorbit/vorbis-player/labels/project%3Avorbis-player-architecture-v2  
- WS10 epic: https://github.com/smallorbit/vorbis-player/issues/1729  
- Dependency policy: [`docs/dependency-upgrades.md`](../dependency-upgrades.md)  
- Toolchain RFC: [`docs/rfcs/0002-coordinated-toolchain-upgrade.md`](../rfcs/0002-coordinated-toolchain-upgrade.md)  
- Suggested next epic (if not WS7): [WS6 a11y #1721](https://github.com/smallorbit/vorbis-player/issues/1721)  
- WS7 epic: [#1738](https://github.com/smallorbit/vorbis-player/issues/1738)  
- Coverage config: `vite.config.ts` (`test.coverage`, report-only)  
- knip config: `knip.json`  
- Test tsconfig: `tsconfig.test.json`  
- E2E tsconfig: `tsconfig.e2e.json`  
- Test factories: `src/test/fixtures.ts` / `src/test/defined.ts`  
- Shared IDB foundation: `src/services/idb/`  
- Provider registry: `src/services/providerRegistry.ts` (re-export: `src/providers/registry.ts`)  
- Remote JSON store: `src/providers/dropbox/remoteJsonFileStore.ts`  
- Logout purge: `src/providers/providerDataPurge.ts`  
- Typed events: `src/constants/events.ts`  
- Storage keys: `src/constants/storage.ts`  
- Metadata enrichment: `src/providers/dropbox/dropboxMetadataEnrichment.ts`  
- Type-aware lint: `eslint.config.js` (production `src/` block)  
- Import layering zones: `eslint-layer-zones.js`  
- Circular import check: `npm run check:circular`  
