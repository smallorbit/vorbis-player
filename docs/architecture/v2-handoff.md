# Architecture v2 — agent handoff

**Initiative label:** [`project:vorbis-player-architecture-v2`](https://github.com/smallorbit/vorbis-player/labels/project%3Avorbis-player-architecture-v2) (RFC 0001)  
**Working mode:** **one workstream (epic) at a time**; within an epic, **one child issue at a time**.  
**Updated:** 2026-09-20 (after #1730)

Source of truth for issue text is GitHub. Epic bodies cite `docs/rfcs/0001-s-tier-codebase.md`, which is **not yet on `main`** — landing that RFC is part of **[WS11](https://github.com/smallorbit/vorbis-player/issues/1757)**.

---

## Status snapshot

| WS | Epic | State |
|----|------|--------|
| WS1 | [#1685](https://github.com/smallorbit/vorbis-player/issues/1685) Neutral domain model | **Done** |
| WS2 | [#1692](https://github.com/smallorbit/vorbis-player/issues/1692) PlaybackStore + QueueStore | **Done** |
| WS3 | [#1699](https://github.com/smallorbit/vorbis-player/issues/1699) State, persistence & events | **Done** (8/8 children closed; close epic #1699 on GitHub if still open) |
| WS10 | [#1729](https://github.com/smallorbit/vorbis-player/issues/1729) Close the toolchain blind spots | **In progress** (1/8) |
| WS4–WS9, WS11–WS12 | Reliability → DevBug | Open (do not start until WS10 closes) |

Pre-initiative foundations already on `main`: async-race harness, honest e2e, full CI gate.

---

## Do this next

### Immediate: continue WS10 at #1731

Epic: **[#1729 — Close the toolchain blind spots](https://github.com/smallorbit/vorbis-player/issues/1729)**  
Principle: P3 — conventions are machine-enforced or they are wishes.

| # | Issue | State | Notes |
|---|--------|--------|--------|
| **1730** | **Bring tests, e2e, and scripts under typechecking** | **← THIS PR** | `tsconfig.test.json` + `tsconfig.e2e.json` referenced from root `tsc -b`; scripts/node aligned to the full flag set; one-time drift-fix |
| **1731** | **Wire coverage ratchet, knip, and npm audit into CI** | **← NEXT** | |
| 1732 | Turn on type-aware lint and finish the strictness epic | Open | |
| 1733 | Declare and enforce the layering order | Open | |
| 1734 | Make e2e run against the prod build with a real Dropbox snapshot | Open | |
| 1735 | Add boundary tests for the Spotify SDK/API layer | Open | |
| 1736 | Clean up test infrastructure and scripts | Open | |
| 1737 | Set the dependency-upgrade policy | Open | |

**WS10 exit criteria** (from epic): `tsc -b` covers 100% of TS in the repo; CI fails on coverage regression, knip findings, audit ≥ high, circular value imports, empty e2e run, chunk misplacement.

### After WS10 closes

Still **one epic at a time**. Suggested order (adjust if the human says otherwise):

1. **[WS6](https://github.com/smallorbit/vorbis-player/issues/1721)** — a11y (start [#1722](https://github.com/smallorbit/vorbis-player/issues/1722) LibraryCard keyboard)  
2. Then WS4 / WS5 / WS7–WS9 / WS11 / WS12 as capacity allows  

Optional WS2 leftovers if they surface: [#1770](https://github.com/smallorbit/vorbis-player/issues/1770) (`restoreSession` staleness after `playTrack`); [#1752](https://github.com/smallorbit/vorbis-player/issues/1752) (position ticks → PlaybackStore) lives under WS9.

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

## Context for #1730 (this PR)

Bring tests, Playwright, and `scripts/` under typechecking (F23).

- `tsconfig.test.json` — Vitest tests + `src/test` + eslint-rule tests, full strictness flag set, referenced from root `tsc -b`
- `tsconfig.e2e.json` — Playwright specs/capture + `playwright.config.ts`, same flags + DOM lib
- `tsconfig.scripts.json` / `tsconfig.node.json` aligned to the remaining flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUncheckedSideEffectImports`); node also typechecks `tailwind.config.ts`
- Drift-fix: `defined()` in `src/test/defined.ts`; expanded factories in `src/test/fixtures.ts`; tests no longer use incomplete mocks / `!` to dodge strictness
- Small production type honesty: `DropboxRequestAuth` for `contentApiRequest`; `refreshNow(scopeProviderId?: ProviderId)` on the library-sync result type

Do **not** expand into later WS10 children (#1731+) unless a shared tsconfig primitive is required.

---

## Context for #1731 (next implementation)

Wire coverage ratchet, knip, and `npm audit` into CI. Do **not** start WS4–WS9 / WS11–WS12 until WS10 closes.

---

## Agent operating notes

- Branch from latest `main`; name `cursor/<slug>-<cloud-suffix>` when using the cloud branch convention (suffix varies per run).
- Target PRs at `main`; conventional commits; run `npm test` / `npm run test:run` before push. PRs squash-merge; mark draft ready before merge.
- Staging: workflow **Deploy PR to Staging** (`workflow_dispatch` + `pr_number`). Cloud agent `gh` is often **read-only** for dispatch — equivalent plumbing is rebuild `staging` from `main`, merge `pull/N/head`, `git push --force-with-lease origin staging`.
- Prefer issue-sized PRs; close epic #1699 on GitHub when editing is available (all children closed).
- Update **this file** when finishing a child or switching epics so the next agent has a current pointer.

---

## Quick links

- Label board: https://github.com/smallorbit/vorbis-player/labels/project%3Avorbis-player-architecture-v2  
- WS3 epic (close if still open): https://github.com/smallorbit/vorbis-player/issues/1699  
- Next epic: https://github.com/smallorbit/vorbis-player/issues/1729 (WS10)  
- Next issue: https://github.com/smallorbit/vorbis-player/issues/1731  
- Test tsconfig: `tsconfig.test.json`  
- E2E tsconfig: `tsconfig.e2e.json`  
- Test factories: `src/test/fixtures.ts` / `src/test/defined.ts`  
- Shared IDB foundation: `src/services/idb/`  
- Remote JSON store: `src/providers/dropbox/remoteJsonFileStore.ts`  
- Logout purge: `src/services/cache/providerDataPurge.ts`  
- Typed events: `src/constants/events.ts`  
- Storage keys: `src/constants/storage.ts`  
- Metadata enrichment: `src/providers/dropbox/dropboxMetadataEnrichment.ts`  
