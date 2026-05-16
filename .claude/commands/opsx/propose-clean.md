---
name: "OPSX: Propose (clean)"
description: Wraps /opsx:propose with the vorbis-player convention that no-delta changes omit the specs/ directory entirely.
category: Workflow
tags: [workflow, openspec, experimental]
---

Wraps `/opsx:propose` with one project convention: **if no spec-level behavior changes, do not create a `specs/` directory or any delta file**. Narrate the rationale in `design.md` instead.

Use this when you know up front that the change is test-only, doc-only, refactor-only, or otherwise non-behavioral. For changes with actual spec deltas, use `/opsx:propose` directly — this wrapper adds nothing.

**Input**: Same as `/opsx:propose` (kebab-case name or free-text description).

## Why this wrapper exists

In `/swarmkit:swarm-plus --label openspec` runs against test-only issues, builders sometimes shipped `specs/<capability>/spec.md` files containing prose like "## No Requirement Changes — no new or modified requirements…". These tripped two tools:

- `openspec archive` aborted: `Delta parsing found no operations for <capability>. Provide ADDED/MODIFIED/REMOVED/RENAMED sections`. Required `--skip-specs` workaround.
- `openspec validate` emitted a warning every time the change was inspected.

Changes that simply omitted `specs/` entirely (when no delta was needed) archived cleanly with `--skip-specs` and validated quietly. This wrapper enforces that pattern.

## Process

### 1. Call `/opsx:propose` to produce the initial artifacts

```
Skill("openspec-propose", "$ARGUMENTS")
```

Let the underlying skill drive the interview, derive the kebab-case name, and create the change directory under `openspec/changes/<name>/` with `proposal.md`, `design.md`, `tasks.md`, and (potentially) `specs/<capability>/spec.md`.

### 2. Detect a no-op delta and prune it

After the underlying skill returns, inspect every file under `openspec/changes/<name>/specs/`:

- If a file is empty (0 bytes) OR contains no `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, or `## RENAMED Requirements` heading, treat it as a no-op delta.
- Delete the no-op file. After deletion, if `openspec/changes/<name>/specs/<capability>/` is empty, remove the capability directory. After that, if `openspec/changes/<name>/specs/` is empty, remove it too.

### 3. Update `design.md` to narrate the no-spec decision

If any pruning happened in step 2, append (or update) a section in `design.md`:

```markdown
## Why no spec delta

This change does not modify any provider-system spec requirement. The behavior
being added is <test coverage / documentation / refactor / etc.> for an existing
requirement (<reference the spec scenario by name>). No `specs/` directory is
included in this change by design.
```

Use the underlying interview's notes to fill in the specifics. If the interview did not capture a rationale, prompt the user with `AskUserQuestion` for a one-sentence reason before writing.

### 4. Re-run validation

```bash
openspec validate <name>
```

The change should pass without the "at least one delta" parser warning (a non-blocking warning is acceptable; an error is not).

### 5. Report

```
── opsx:propose-clean complete ─────────────────
Change: <name>
Artifacts: proposal.md, design.md, tasks.md
Spec deltas: none (pruned <N> empty/no-op file(s))
Next: /opsx:apply <name>
────────────────────────────────────────────────
```

## Constraints

- Never modify the underlying `openspec-propose` skill — this wrapper composes it.
- Never delete a non-empty delta file. If a `specs/` file contains real ADDED/MODIFIED/REMOVED/RENAMED content, keep it.
- Always update `design.md` when pruning so the rationale is preserved in the change directory rather than lost to git history.
- If the user genuinely needs a spec delta, they should invoke `/opsx:propose` directly. Do not "auto-detect" that the user changed their mind.

## When to deprecate

Remove this wrapper if/when upstream `openspec-propose` learns to skip empty `specs/` files on its own, OR `openspec archive` learns to silently treat no-op deltas as `--skip-specs`.
