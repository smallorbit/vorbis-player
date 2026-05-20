---
name: "Swarm OpenSpec"
description: Project-local wrapper around /swarmkit:swarm-plus tuned for vorbis-player's OpenSpec workflow. Forces flat-to-develop topology and auto-archives changes after merge.
category: Workflow
tags: [workflow, openspec, swarm]
---

Run `/swarmkit:swarm-plus` configured for OpenSpec changes in this project, then close the loop with `/opsx:bulk-archive` and an archive PR.

Use this for runs that involve OpenSpec-labeled issues. For non-OpenSpec runs, invoke `/swarmkit:swarm-plus` directly.

**Input**: Same grammar as `/swarmkit:swarm-plus` (no args | label | issue numbers | range). The `--no-epic` flag is always injected — do not override.

## Why this wrapper exists

Upstream `/swarmkit:swarm-plus` is general-purpose. This wrapper layers vorbis-player conventions on top without modifying the plugin:

- **Topology**: every OpenSpec change is its own independent PR. Epic mode adds friction with no benefit for these.
- **Archive closure**: after the code PRs merge, the OpenSpec change directories under `openspec/changes/<name>/` need to be moved to `archive/`. Doing this manually is `2N` PRs for `N` issues. Bundling it auto-cuts the count to `N+1`.

What this wrapper does NOT do (left to swarm-plus + reviewer-flagged fix rounds):

- Inject `/opsx:verify` into builder prompts — the issue body should convey it.
- Strip empty `specs/` placeholders from change directories — see `/opsx:propose-clean` for that convention.

If reviewer-fix-round coverage of those gaps turns out to be unreliable across runs, revisit the design (probably by introducing a third "opsx-verify pass" subagent rather than re-implementing swarm-plus).

## Process

### 1. Run swarm-plus with `--no-epic` injected

```
Skill("swarmkit:swarm-plus", "--no-epic $ARGUMENTS")
```

If `$ARGUMENTS` already contains `--no-epic`, do not add a duplicate. If it contains `--epic <slug>` or `--base <branch>`, abort with an explanation — those flags are incompatible with this wrapper's flat-to-develop contract. Suggest the operator invoke `/swarmkit:swarm-plus` directly if they need a different topology.

Let swarm-plus run its full lifecycle: spawn → review → fix-round → leave PRs open.

### 2. Run `/swarmkit:merge-stack`

After swarm-plus returns control:

```
Skill("swarmkit:merge-stack")
```

This squash-merges every open `worktree-agent-*` PR into develop and deletes the remote branches. Worktrees persist locally — `/swarmkit:clean-worktrees` is a later step.

### 3. Detect OpenSpec changes that just merged

```bash
openspec list --json | jq -r '.changes[].name'
```

This is the set of changes that have implementations on develop but have not been archived yet. If the list is empty, skip to step 6 — there is nothing to archive.

For each change name, sanity-check by reading `openspec/changes/<name>/tasks.md` — if any incomplete `- [ ]` checkboxes remain, do NOT archive it; warn and leave it active.

### 4. Run `/opsx:bulk-archive`

```
Skill("openspec-bulk-archive-change")
```

When the skill prompts for selection, select **all** ready-to-archive changes from step 3.

When a change has no delta specs (the common case for test-only changes), use `--skip-specs` (the skill handles this internally per the conflict-resolution flow).

### 5. Commit the archive moves and open a PR

```bash
git checkout -b chore/archive-openspec-$(date +%Y-%m-%d)
git add openspec/changes/
git commit -m "chore(openspec): archive <list of change names> for <issue refs>"
git push -u origin chore/archive-openspec-$(date +%Y-%m-%d)
gh pr create --base develop \
  --title "chore(openspec): archive <list of change names>" \
  --body "$(cat <<'EOF'
## Summary

- Moves <N> completed OpenSpec change(s) from `openspec/changes/` to `openspec/changes/archive/YYYY-MM-DD-<name>/`
- Companion to the code PRs that just merged (list them with `#<N>` references and the issue they closed)
- No delta specs to sync OR delta specs synced via /opsx:bulk-archive (state which)

## Test plan

- [x] `openspec list --json` returns `{"changes":[]}` after archive (or lists only changes intentionally left active)
- [x] New directories present under `openspec/changes/archive/YYYY-MM-DD-*/`
- [x] `git status` shows only renames — no content loss
EOF
)"
```

Report the archive PR URL.

### 6. Clean up

```
Skill("swarmkit:clean-worktrees")
```

Removes the `worktree-agent-*` worktrees and prunes orphan local branches. The archive PR's branch stays — it belongs to this session.

### 7. Report

```
── swarm-openspec complete ─────────────────────
Code PRs merged: #A #B #C  (issues #X #Y #Z)
Archive PR:      #N
Cleanup:         <count> worktrees reaped
Next:            Review and merge #N to close the loop.
────────────────────────────────────────────────
```

## Constraints

- Never enable epic mode. The whole point of this wrapper is flat-to-develop for independent OpenSpec changes.
- Never archive a change with incomplete tasks. Warn and skip.
- Never modify `/swarmkit:swarm-plus` or the openspec-* skills — this wrapper composes them.
- If the auto-archive step fails (e.g. PR creation rejected), surface the error and leave the archive branch in place for manual recovery. Do not retry blindly.

## When to deprecate

Remove this wrapper if/when any of the following lands upstream:
- `/swarmkit:swarm-plus` learns a `--post-merge <skill>` hook.
- `/opsx:bulk-archive` learns to auto-open a chore PR.
- `/swarmkit:swarm-plus` gains OpenSpec-aware prompt injection (unlikely — that would couple it to OpenSpec).
