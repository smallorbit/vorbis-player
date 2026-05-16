---
name: "Sweep (Serena-augmented)"
description: Project-local wrapper around /polishkit:sweep that uses Serena MCP for high-fidelity dead-code detection in Phase 1, then delegates Phase 2 (cruft & git hygiene) to the upstream skill.
category: Workflow
tags: [workflow, hygiene, dead-code, serena]
---

Run a codebase sweep with two layers:

1. **Phase 1 (dead code)** — augmented with Serena's symbol graph (`find_referencing_symbols`, `find_symbol`, `get_symbols_overview`, `search_for_pattern`). `ts-prune` generates broad candidates; Serena verifies each one against actual reference counts before proposing removal.
2. **Phase 2 (cruft & git hygiene)** — delegated to `/polishkit:sweep` with scope `cruft-only`. The upstream tool handles stale docs, build artifacts, duplicate content, and merged-branch detection.

Use this in place of `/polishkit:sweep` whenever Serena MCP is connected (`/mcp` shows `serena` as connected). Without Serena, fall back to `/polishkit:sweep` directly — this wrapper still works but produces the same output as the upstream skill.

## Input

Same scope grammar as `/polishkit:sweep`:

- A path or glob (`src/components/`, `**/*.test.ts`) — restricts both phases to that subtree.
- A category hint (`dead-code-only`, `cruft-only`, `git-only`) — runs just the matching phase.
- Empty — run everything.

## Why this wrapper exists

`ts-prune` flags an export as unused when no file `import`s it by name. That heuristic misses:

- **Dynamic dispatch** — `src/providers/registry.ts` wires Spotify/Dropbox/mock adapters by string id at runtime. Exports referenced only through `providerRegistry.register(...)` look unused to `ts-prune`.
- **Barrel re-exports** — a symbol used through `import { X } from '@/foo'` where `foo/index.ts` re-exports from `foo/x.ts` may not be detected depending on `ts-prune`'s resolution path.
- **String-keyed lookups** — `someMap['exportName']`, `lazy(() => import('./Foo'))` with computed paths.
- **Test-only consumption** — `ts-prune` ignores test files by default; an export used only in tests shows up as "unused" even though deleting it would break the test suite.

Serena's `find_referencing_symbols` answers the actually-correct question: "does any code path reference this symbol?" — across imports, re-exports, type references, and string-keyed lookups it can resolve. The cost is one MCP call per candidate, so the wrapper uses `ts-prune` to narrow the candidate set first.

## Process

### Step 0 — Detect Serena availability

```bash
# A no-op symbol lookup against a known-existing file confirms the MCP server
# is reachable. If it returns an error, fall back to upstream sweep.
SERENA_CHECK=$(echo '' | timeout 5 sh -c 'true' 2>&1; echo $?)
```

In practice, attempt a small `mcp__serena__get_symbols_overview` call against `src/types/domain.ts` (a stable file). If the call fails or times out:

```
Serena MCP not reachable. Falling back to /polishkit:sweep.
```

Then invoke `Skill("polishkit:sweep", "<original-scope>")` and exit. Do **not** continue with the augmented flow — it depends on Serena being live.

### Step 1 — Generate candidate list with ts-prune

Run `ts-prune` over the scope to produce a coarse candidate list of "possibly unused" exports:

```bash
SCOPE_FILTER="$ARGUMENTS"
if [ -n "$SCOPE_FILTER" ] && [ "$SCOPE_FILTER" != "dead-code-only" ] && [ "$SCOPE_FILTER" != "cruft-only" ] && [ "$SCOPE_FILTER" != "git-only" ]; then
  npx ts-prune --ignore "$SCOPE_FILTER" | head -200 > /tmp/ts-prune-candidates.txt
else
  npx ts-prune | head -200 > /tmp/ts-prune-candidates.txt
fi
wc -l /tmp/ts-prune-candidates.txt
```

Each line is `path:line - symbol [used in module]` or similar. Parse out `path` and `symbol` for each candidate.

If `ts-prune` returns empty, skip to Step 4 (no Phase 1 candidates to verify).

### Step 2 — Verify each candidate with Serena

For every candidate `(path, symbol)`:

1. Call `mcp__serena__find_symbol` with the candidate's name and path to confirm the symbol exists and locate its body.
2. Call `mcp__serena__find_referencing_symbols` against the same symbol. This is the gold-standard reference check — it walks the project's symbol graph, including barrels, type references, and JSX usage.
3. Classify by reference count:
   - **0 references** — confirmed dead, propose for removal.
   - **1 reference, in the file itself** — likely self-reference (e.g. a recursive function); confirmed dead at the export boundary.
   - **1+ references in test files only** — flag as "test-only export" — operator decides whether tests are worth keeping the export alive.
   - **2+ references across non-test code** — `ts-prune` false positive (likely dynamic dispatch or barrel re-export); drop from candidate list silently.

Track every classification decision so the final report can show the user *why* each finding survived or didn't.

### Step 3 — Special-case the provider registry pattern

The repo has a known dynamic-dispatch surface: provider adapters self-register at import time via `providerRegistry.register(...)`. Symbols like `spotifyCatalogAdapter`, `dropboxPlaybackAdapter`, etc. look unreferenced to `ts-prune` because nothing imports them by name. Before flagging any `src/providers/<provider>/<provider>Provider.ts` or its adapter files:

1. Call `mcp__serena__search_for_pattern` for `providerRegistry.register` to find the registration sites.
2. If the candidate is referenced as a constructor argument or imported in any registration call (even transitively via the file's top-level side effects), skip it.

This is a project-specific guardrail. Document the same pattern for any future dynamic-dispatch surface (e.g. visualizer registration, plugin loaders) by extending Step 3 with a new sub-check.

### Step 4 — Run Phase 2 via upstream skill

```
Skill("polishkit:sweep", "cruft-only")
```

If the scope passed to this wrapper was `dead-code-only`, skip Step 4 entirely. If the scope was `cruft-only` or `git-only`, skip Steps 1–3 and only run Step 4 with the appropriate scope passthrough.

### Step 5 — Combined findings table

Present a single combined report covering both phases. Distinguish Serena-verified findings from upstream cruft findings:

```
── /sweep-serena findings ─────────────────────────
Phase 1 (dead code, Serena-verified):
  Confirmed unused exports:  <count>
  Test-only exports:         <count>
  ts-prune false positives:  <count>  (filtered, not shown)

Phase 2 (cruft, via /polishkit:sweep):
  <pass-through from upstream>
───────────────────────────────────────────────────
```

For each confirmed Phase 1 finding, show `file:line`, the symbol name, the Serena reference-count breakdown ("0 refs across 0 files"), and a recommended action.

### Step 6 — Confirm via AskUserQuestion

Same shape as `/polishkit:sweep` Step 3: batch related findings into one question per group (up to 4 questions per call). Each question must state the action, give a one-line reason in each option's description, and label the recommended option `(Recommended)`.

### Step 7 — Apply and verify

After approval:

1. Remove each confirmed unused export (delete the function/const declaration AND the `export` keyword AND any trailing barrel re-export in the same file's index).
2. For barrel cleanup: if `src/<dir>/index.ts` re-exports a now-deleted symbol, remove that line too.
3. Re-run `npx tsc -b --noEmit` to confirm the codebase still compiles.
4. Run the project's verify command (`npm run test:run` for tests scoped to the touched files, then a full type-check).
5. Commit with `chore: sweep codebase (serena-verified)` and open a PR targeting develop.

## Constraints

- Never propose removing a symbol with **any** non-test references — Serena is the authority, and a non-zero reference count means the export is alive.
- Never modify the upstream `polishkit:sweep` skill — this wrapper composes it. Bug reports against ts-prune behavior should go upstream to polishkit; bug reports against Serena verification logic stay here.
- Always run `tsc --noEmit` AFTER any deletions, not before. The "before" check is irrelevant — `ts-prune` only flags exports, not type errors.
- Always present findings before deleting. Never auto-apply, even when the candidate list is small.

## When to deprecate

Remove this wrapper if/when:
- `/polishkit:sweep` learns native Serena/LSP integration for reference verification.
- `ts-prune` adds project-aware dynamic-dispatch heuristics (unlikely — its design is one-shot static analysis).
- This project drops the parallel `src/providers/{spotify,dropbox,mock}/` registration pattern (also unlikely).
