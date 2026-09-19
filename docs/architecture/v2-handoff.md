# Architecture v2 — agent handoff

**Initiative label:** [`project:vorbis-player-architecture-v2`](https://github.com/smallorbit/vorbis-player/labels/project%3Avorbis-player-architecture-v2) (RFC 0001)  
**Working mode:** **one workstream (epic) at a time**; within an epic, **one child issue at a time**.  
**Updated:** 2026-09-19 (after #1702)

Source of truth for issue text is GitHub. Epic bodies cite `docs/rfcs/0001-s-tier-codebase.md`, which is **not yet on `main`** — landing that RFC is part of **[WS11](https://github.com/smallorbit/vorbis-player/issues/1757)**.

---

## Status snapshot

| WS | Epic | State |
|----|------|--------|
| WS1 | [#1685](https://github.com/smallorbit/vorbis-player/issues/1685) Neutral domain model | **Done** |
| WS2 | [#1692](https://github.com/smallorbit/vorbis-player/issues/1692) PlaybackStore + QueueStore | **Done** |
| WS3 | [#1699](https://github.com/smallorbit/vorbis-player/issues/1699) State, persistence & events | **In progress** (3/8) |
| WS4–WS12 | Reliability → DevBug | Open (do not start until WS3 closes) |

Pre-initiative foundations already on `main`: async-race harness, honest e2e, full CI gate.

---

## Do this next

### Immediate: finish WS3, starting at #1703

Epic: **[#1699 — State, persistence & events with single owners](https://github.com/smallorbit/vorbis-player/issues/1699)**  
Principles: P1/P2 — one owner per state; one canonical implementation per concern.

| # | Issue | State | Notes |
|---|--------|--------|--------|
| 1700 | Same-tab `localStorage` broadcast | **Closed** | PR [#1771](https://github.com/smallorbit/vorbis-player/pull/1771). Helper: `src/utils/persistedStorage.ts`; hook: `src/hooks/useLocalStorage.ts`; lint allowlist in `eslint.config.js`. |
| 1701 | Invalidate IndexedDB liked-songs on save/unsave | **Closed** | PR [#1773](https://github.com/smallorbit/vorbis-player/pull/1773). `invalidateLikedSongsCaches` awaits `libraryCache.removeTrackList({ provider: 'spotify', kind: 'liked' })`. |
| 1702 | One IndexedDB foundation + degradation policy | **Closed** | Shared `src/services/idb`; library / settings / Dropbox rebuilt on it. Policy: retry → quota eviction → `deleteDatabase` on corruption; write soft-fail uses per-key overlay (never whole-DB fallback). |
| **1703** | **`RemoteJsonFileStore<T>` under Dropbox** | **← NEXT** | Dedupe `/.vorbis` remote-JSON sync. |
| 1704 | Logout data-purge contract | Open | High priority — can use `createIdbDatabase().deleteDatabase()` + STORAGE_KEYS |
| 1705 | Typed `AppEventMap` in `constants/events.ts` | Open | |
| 1706 | Complete `STORAGE_KEYS` + prefix convention | Open | Fold more raw writers off the #1700 allowlist where appropriate |
| 1707 | Slim `ProviderContext` + StrictMode | Open | Epic exit: tests pass under StrictMode |

**WS3 exit criteria** (from epic): settings change visible across surfaces without reload; `npm run test:run` under StrictMode; logout leaves zero provider-scoped keys/DBs (proven by test).

### After WS3 closes

Still **one epic at a time**. Suggested order (Phase 0/1 from RFC bodies; adjust if the human says otherwise):

1. **[WS10](https://github.com/smallorbit/vorbis-player/issues/1729)** — toolchain (typecheck tests/scripts, coverage/knip/audit) — de-risks later refactors  
2. **[WS6](https://github.com/smallorbit/vorbis-player/issues/1721)** — a11y (start [#1722](https://github.com/smallorbit/vorbis-player/issues/1722) LibraryCard keyboard)  
3. Then WS4 / WS5 / WS7–WS9 / WS11 / WS12 as capacity allows  

Optional WS2 leftovers if they surface: [#1770](https://github.com/smallorbit/vorbis-player/issues/1770) (`restoreSession` staleness after `playTrack`); [#1752](https://github.com/smallorbit/vorbis-player/issues/1752) (position ticks → PlaybackStore) lives under WS9.

---

## Context for #1703 (next implementation)

Extract a single `RemoteJsonFileStore<T>` under the Dropbox provider for the triplicated `/.vorbis` remote-JSON sync paths. Do **not** expand into logout purge (#1704) or STORAGE_KEYS (#1706) unless a shared primitive is required.

### Known follow-ups (do **not** block #1703)

- Session hydrate clears on-disk session via `resetLastSession`; debounced re-save often never lands while position ticks reset the timer. Re-prime falls back to **PlaybackStore** cursor (`useProviderPlayback`). Durable session re-save belongs with #1706 territory if touched at all.
- Raw `localStorage` allowlist in `eslint.config.js` still includes auth/session/debug/migration modules; shrink it as #1704/#1706 land.
- `docs/rfcs/0001-s-tier-codebase.md` still missing from the tree → WS11.
- In-place IDB patch of liked-songs (vs full remove from #1701) was deferred; revisit only if refetch cost after save/unsave becomes measurable.

---

## Agent operating notes

- Branch from latest `main`; name `cursor/<slug>-26d0` (or the cloud run suffix) when using the cloud branch convention.
- Target PRs at `main`; conventional commits; run `npm test` / `npm run test:run` before push. PRs squash-merge; mark draft ready before merge.
- Staging: workflow **Deploy PR to Staging** (`workflow_dispatch` + `pr_number`). Cloud agent `gh` is often **read-only** for dispatch — equivalent plumbing is rebuild `staging` from `main`, merge `pull/N/head`, `git push --force-with-lease origin staging`.
- Prefer issue-sized PRs; update the epic checklist when closing children (tick #1700/#1701/#1702 on #1699 when editing is available).
- Update **this file** when finishing a WS3 child or switching epics so the next agent has a current pointer.

---

## Quick links

- Label board: https://github.com/smallorbit/vorbis-player/labels/project%3Avorbis-player-architecture-v2  
- WS3 epic: https://github.com/smallorbit/vorbis-player/issues/1699  
- Next issue: https://github.com/smallorbit/vorbis-player/issues/1703  
- Shared IDB foundation: `src/services/idb/`  
