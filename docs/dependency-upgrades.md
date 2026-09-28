# Dependency upgrades

How Vorbis Player updates npm dependencies. Closes **F94** (RFC 0001 / WS10 [#1737](https://github.com/smallorbit/vorbis-player/issues/1737)).

## Two tracks

| Track | When | What |
|-------|------|------|
| **Routine** | Any time; prefer small PRs | `npm update` within **current major** ranges (`package.json` carets). Patch/minor only. |
| **Coordinated major** | One dedicated epic after WS10 tooling is green | React 19, Vite 8, Vitest 4+ (see [RFC 0002](./rfcs/0002-coordinated-toolchain-upgrade.md)). **Not piecemeal.** |

Do **not** open drive-by PRs that bump React, Vite, or Vitest majors outside the coordinated RFC. Those stacks share config, types, and test runners; splitting them creates churn and hides breakage.

Tailwind 4, ESLint 10, and TypeScript 7 are also multiple majors behind (F94). They ship in the **same RFC window** as the React/Vite/Vitest work — either in the same implementation PR stack or as an immediate follow-up before the RFC closes — not as unrelated one-off bumps.

## Routine workflow

1. On `main`, run `npm update` (respects semver ranges in `package-lock.json`).
2. Run the full gate locally:
   ```bash
   npx tsc -b --noEmit
   npm run lint
   npm run test:run
   npm run build
   npm run knip
   npm run audit:ci
   ```
3. Commit **both** `package.json` and `package-lock.json` when ranges change.
4. CI already runs coverage ratchet, knip, and `audit:ci` (`--audit-level=high`) — see [#1731](https://github.com/smallorbit/vorbis-player/pull/1783).

### Security advisories

- **High / critical:** CI fails (`npm run audit:ci`). Fix with routine `npm update` when the fix stays on the same major. If the advisory requires a **breaking** major (common for Vitest today), track it in RFC 0002 — do not `npm audit fix --force` on `main`.
- **Moderate / low:** Document in the RFC or issue; acceptable until the coordinated upgrade lands unless exploitability is proven in our usage.

As of WS10 close, remaining audit noise is **moderate** Vitest/`@vitest/mocker` ([GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)); dev/test only, not production runtime.

## Adding or removing packages

- Prefer existing stack choices (see `docs/contributing.md` tech stack).
- Run `npm run knip` after removing imports or files — dead exports fail CI.
- New runtime dependencies need justification in the PR; avoid duplicates (F94: **lucide-react** is the icon set — keep it).

## Unmaintained / legacy deps

| Package | Role | Policy |
|---------|------|--------|
| **html2canvas** | DevBug screenshots only (`src/services/devbug/screenshotCapture.ts`) | No new call sites. Replace or drop with [WS12 DevBug](https://github.com/smallorbit/vorbis-player/issues/1728) containment — not a standalone upgrade. |

## Major upgrade RFC

Implementation plan, version targets, verification checklist, and explicit out-of-scope items:

**[RFC 0002 — Coordinated toolchain upgrade](./rfcs/0002-coordinated-toolchain-upgrade.md)**

When that RFC is **Accepted** and implemented, update this doc’s baseline versions in `docs/contributing.md` and `CLAUDE.md` tech references in the same PR stack.

## Related

- Epic [#1729 — Close the toolchain blind spots](https://github.com/smallorbit/vorbis-player/issues/1729) (WS10)
- Agent handoff: `docs/architecture/v2-handoff.md`
