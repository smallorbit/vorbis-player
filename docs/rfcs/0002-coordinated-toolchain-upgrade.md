# RFC 0002 — Coordinated toolchain upgrade

| Field | Value |
|-------|--------|
| **Status** | Proposed |
| **Authors** | WS10 / [#1737](https://github.com/smallorbit/vorbis-player/issues/1737) |
| **Findings** | F94 (RFC 0001) |
| **Depends on** | WS10 exit criteria met ([#1729](https://github.com/smallorbit/vorbis-player/issues/1729)): full-repo `tsc -b`, CI unit tests/knip/audit/circular/e2e/chunk gates |

## Summary

Upgrade the core frontend toolchain in **one coordinated effort**: React 19, Vite 8, and Vitest 4+ (likely Vitest 5.x at implementation time if that is the first major clearing advisories). Tailwind 4 and aligned ESLint/TypeScript majors ship in the **same RFC** (same epic / PR stack), not as drive-by bumps.

**Explicitly out of scope for this RFC:** replacing html2canvas (DevBug / WS12), adopting a new state library, or exiting styled-components.

## Motivation

- **F94:** React, Vite, Vitest, and Tailwind are each one or more majors behind stable upstream.
- **Security:** `npm audit` reports moderate Vitest/`@vitest/mocker` issues on the current 3.x line; fixes require a breaking Vitest major — must not land via `npm audit fix --force` on `main` (see `docs/dependency-upgrades.md`).
- **Churn cost:** React 19 changes types and StrictMode semantics; Vite 8 changes build defaults; Vitest 4+ changes pool/config and coverage integration. `@vitejs/plugin-react`, `@testing-library/react`, and `eslint-plugin-react-hooks` must move together.
- **RFC 0001 principle:** *No piecemeal major-version chasing* — routine `npm update` within current majors already runs on `main` ([#1731](https://github.com/smallorbit/vorbis-player/pull/1783)).

## Current baseline (2026-09, `main` after WS10)

| Package | Current | Latest (indicative) |
|---------|---------|---------------------|
| `react` / `react-dom` | ^18.3.1 | 19.x |
| `vite` | ^6.x | 8.x |
| `vitest`, `@vitest/coverage-v8`, `@vitest/ui` | ^3.x | 5.x (4.x also clears mocker advisory — pick newest stable at kickoff) |
| `@vitejs/plugin-react` | ^4.x | 6.x (match Vite major) |
| `tailwindcss` | ^3.4.x | 4.x |
| `@types/react` / `@types/react-dom` | ^18.x | 19.x |
| `eslint` / `@eslint/js` | ^9.x | 10.x (optional same stack; do not bump alone) |
| `typescript` | ~5.8.x | 7.x (optional same stack; do not bump alone) |

Production runtime deps (Radix, styled-components, dnd-kit, etc.) should be **re-checked for React 19 compatibility** during implementation; bump only as needed for peer dependency resolution, still within the same PR stack.

## Goals

1. Land on supported majors with a green CI gate and unchanged product behavior (mock-provider e2e + full unit suite).
2. Clear or document remaining npm advisories affecting dev/test tooling.
3. Update contributor-facing version strings (`docs/contributing.md`, any stale comments).
4. Keep a **single** lockfile diff era — reviewers see one logical upgrade, not six months of drift.

## Non-goals

- Tailwind/shadcn visual redesign (Tailwind 4 migration is mechanical config + token compatibility, not a UI refresh).
- Playwright major bump unless required by Node/engine constraints (track separately if idle).
- html2canvas upgrade/replace (WS12).

## Proposed approach

### Phase 0 — Preflight (no version bumps)

- [ ] Create tracking epic or label `epic:toolchain-upgrade` linked to this RFC.
- [ ] Read upstream migration guides: [React 19](https://react.dev/blog/2024/12/05/react-19), Vite 7→8 changelog, Vitest migration notes for target major.
- [ ] Snapshot bundle stats / chunk layout (`vite.config.ts` manual chunks) for regression comparison.
- [ ] Confirm Spotify SDK + mock e2e still run against `preview:e2e` prod build.

### Phase 1 — Tooling spine (one PR or stacked PRs, merge together)

Order **inside the stack** (each step keeps CI green):

1. **Vitest + coverage + `@vitest/ui`** — update `vite.config.ts` `test` block, fix pool/globals breaking changes.
2. **Vite + `@vitejs/plugin-react`** — align `build`, `server`, `preview`, and e2e `build:e2e` scripts; re-verify manual chunks and `check:circular`.
3. **React 19 + types** — bump `react`, `react-dom`, `@types/react`, `@types/react-dom`; address StrictMode/double-effect tests if behavior changes; run RTL tests with `@testing-library/react` peer bump.
4. **Tailwind 4** (if not deferred by explicit team decision) — postcss/tailwind config, shadcn token CSS, verify Radix primitives unchanged visually via capture or spot-check.

Optional in the **same stack** (only if already touching eslint/tsconfig):

- ESLint 10 + `typescript-eslint` alignment
- TypeScript 7 — only with full `tsc -b` + type-aware lint green

### Phase 2 — Verification

Required before merge:

```bash
npx tsc -b --noEmit
npm run lint
npm run test:run
npm run test:coverage    # informational report
npm run knip
npm run audit:ci
npm run check:circular
npm run build
npm run test:e2e
npm run capture          # if visual/token migration touched CSS
```

Manual smoke (human or staging):

- Spotify OAuth + playback on preview deploy (SDK + CSP unchanged by this RFC unless Vite env handling changes).
- Dropbox HTML5 playback path unchanged.

### Phase 3 — Docs + policy

- [ ] Mark RFC status **Accepted** → **Implemented** in this file.
- [ ] Refresh version lines in `docs/contributing.md` and `CLAUDE.md`.
- [ ] Note any remaining moderate advisories with justification.

## Risks

| Risk | Mitigation |
|------|------------|
| React 19 StrictMode / effect timing breaks hydrate or playback tests | WS10 async-race harness + store tests; fix tests for real behavior, not revert StrictMode |
| Vite 8 changes chunk splitting | CI chunk assertion (if present) + compare `dist/assets` layout |
| Vitest major changes mock/timer semantics | Spotify boundary tests (#1735) and player logic tests are canaries |
| Tailwind 4 breaks shadcn tokens | Limit scope to config migration; use capture specs |
| Peer dependency conflicts | Single lockfile PR; avoid partial merges |

## Decision log

| Date | Decision |
|------|----------|
| 2026-09 | WS10 closes with **policy + Proposed RFC** only; implementation waits until WS11+ or dedicated capacity, per RFC 0001 Phase 5 sequencing. |
| 2026-09 | Vitest target written as **4+** — at kickoff, choose the lowest major that clears GHSA-82fw-gwwq-j7x9 (likely 5.x on npm). |

## Acceptance criteria (RFC complete)

- [ ] All Phase 1 packages at target majors on `main`.
- [ ] All Phase 2 commands pass in CI.
- [ ] `npm run audit:ci` passes **or** remaining findings documented with dev-only scope.
- [ ] `docs/dependency-upgrades.md` updated if process changed.
- [ ] RFC status set to **Implemented**.

## References

- Policy: [`docs/dependency-upgrades.md`](../dependency-upgrades.md)
- RFC 0001 (architecture v2): `docs/rfcs/0001-s-tier-codebase.md` (landing tracked in WS11 [#1757](https://github.com/smallorbit/vorbis-player/issues/1757))
- Issue [#1737 — Set the dependency-upgrade policy](https://github.com/smallorbit/vorbis-player/issues/1737)
