---
name: preview-epic
description: Build a local preview branch combining every open PR in an epic's stack so the full feature can be tested end-to-end before any merge. Accepts an epic issue number or an explicit list of PR numbers / branches. Local-only — never pushes.
triggers:
  - "/preview-epic"
  - "preview epic"
  - "build preview branch"
  - "local preview for epic"
  - "combine stacked prs"
allowed-tools: Bash
---

# Preview Epic

Combine every open PR attached to an epic into one local branch so the full feature can be tested (`npm run dev`, manual QA, integration runs) before any merge. Useful when an epic was swarmed as **parallel stacked PRs** and no single branch contains the whole feature — a `gh pr checkout <leaf>` gives only a partial view.

## When to use

- An epic shipped as multiple parallel chains rooted on a shared base branch (common output of `swarmkit:swarm`).
- You want to exercise the full feature locally without merging to `develop` first.
- Any `gh pr checkout <N>` shows incomplete behavior because sibling branches aren't in its history.

## Arguments

Accepts ONE of:

- **Epic issue number** — e.g. `893`. Resolves to every open PR whose body contains `Closes #<child>` for any child issue of the epic. Child issues come from (a) the GitHub sub-issue API, or (b) `#\d+` references in the epic body as a fallback.
- **PR numbers** — e.g. `1063 1064 1065` or `#1063 #1064 #1065`. Use exactly these PRs.
- **Branch names** — e.g. `worktree-agent-885 worktree-agent-886 …`. Use exactly these heads.

Optional flags:

- `--base <branch>` — override the auto-detected stack root (the branch all PRs ultimately stack from).
- `--name <branch-name>` — override preview branch name. Defaults to `preview/epic-<N>` when given an epic number, else `preview/combined-<short-sha>`.
- `--no-test` — skip `npm run test:run` (still runs tsc). For fast iteration when you just want a build.

## Process

### 1. Parse arguments and resolve target PRs

- If arg is purely numeric and a single value: try treating it as an epic issue number first. Query sub-issues:
  ```bash
  gh api repos/:owner/:repo/issues/<N>/sub_issues
  ```
  If that returns a non-empty array, use those children. Otherwise fall back to extracting `#\d+` references from the epic's body:
  ```bash
  gh issue view <N> --json body --jq '.body' | grep -oE '#[0-9]+' | sort -u
  ```
- For each child issue, find its open PR(s):
  ```bash
  gh pr list --state open --json number,headRefName,baseRefName,state,body,title \
    --search "in:body \"Closes #<child>\""
  ```
  Take the first matching open PR per child.
- If multiple numeric args are given (e.g. `1063 1064`), treat them as PR numbers and fetch each directly.
- If args look like branch names, fetch each branch and build the set without PR metadata (stack-root auto-detection may fall back to `--base`).
- Deduplicate. Skip any PR already merged or closed; report which were skipped and why.

### 2. Discover stack root

For each resolved PR, get `headRefName` and `baseRefName`. The **stack root** is the `baseRefName` that:
- At least one resolved PR targets, AND
- Is NOT a `headRefName` of any other PR in the set.

If multiple candidates remain, prefer the one that is an ancestor of all head branches — use `git merge-base --octopus <heads…>` and match it to a remote branch.

If no unique root can be determined (e.g. branches don't share common ancestry), abort and ask the user to supply `--base`.

If `--base` is provided, use that verbatim without auto-detection.

### 3. Stash local work and create preview branch

Preserve any uncommitted local changes:
```bash
if ! git diff --quiet || ! git diff --cached --quiet; then
  git stash push -u -m "preview-epic autosave $(date +%s)"
  STASHED=1
fi
```

Fetch everything needed:
```bash
git fetch origin <stack-root> <head1> <head2> … <headN>
```

Create the preview branch from the stack root (force-recreate if it exists):
```bash
git checkout -B <preview-name> origin/<stack-root>
```

### 4. Merge all heads

Try octopus merge first — fastest and cleanest when there are no conflicts:
```bash
git merge --no-edit origin/<head1> origin/<head2> … origin/<headN>
```

If octopus fails, reset cleanly and fall back to sequential:
```bash
git merge --abort 2>/dev/null || true
# Reset to the stack root (octopus partials can leave index dirty)
git reset --hard origin/<stack-root>

for head in <head1> <head2> … <headN>; do
  if ! git merge --no-edit "origin/$head"; then
    echo "Conflict merging origin/$head"
    # Leave the conflict in place — user can resolve or abort manually
    exit 1
  fi
done
```

Do NOT force-resolve conflicts. If sequential merge conflicts, stop and report the exact pair that conflicted. The user may need to decide whether the stack is actually compatible.

### 5. Verify

```bash
npx tsc -b --noEmit
```

Then tests (unless `--no-test`):
```bash
npm run test:run 2>&1 | tail -20
```

Always pipe test output through `tail` — full output can overflow the agent transcript. If either fails, report the failure but leave the preview branch intact for inspection.

### 6. Restore stash (if we created one) and report

If we stashed in step 3, the stash stays put — the user returns to it manually with `git stash pop` when they leave the preview branch. Do NOT auto-pop onto the preview branch — it would mix uncommitted work with the preview state.

Report:

```
── Preview ready ────────────────────────────
Branch:         preview/epic-893 (checked out)
Stack root:     worktree-agent-885 (auto-detected)
Combined PRs:   #1063, #1064, #1065, #1066, #1067, #1068
Strategy:       octopus
Typecheck:      clean
Tests:          1036/1036 passed
Stashed work:   preview-epic autosave 1234567 (git stash pop to restore)

Next steps:
  • npm run dev             # exercise the feature
  • git checkout develop    # when done — preview branch is disposable
─────────────────────────────────────────────
```

Include skipped PRs if any:

```
Skipped:        #1070 (merged), #1071 (closed)
```

## Constraints

- **Never push** — the preview branch is local-only. If the user wants to share it, they can push explicitly.
- **Never delete source branches** — they are the PRs under review.
- **Never auto-resolve merge conflicts** — if sequential merge conflicts, stop and surface the exact pair.
- **Never auto-pop stashed work** onto the preview branch — restore is a manual step.
- Force-recreate the preview branch if it already exists (`checkout -B`) — it's disposable by design.
- If tsc or tests fail, leave the preview branch in place for inspection; do NOT auto-rollback.
- Pipe `npm run test:run` through `tail` to avoid flooding the agent transcript.

## Failure modes

| Symptom | Cause | Action |
|---------|-------|--------|
| Sub-issues API returns empty and body has no `#N` references | Epic not wired | Ask user for explicit PR list |
| Multiple candidate stack roots | Heterogeneous bases | Ask user for `--base` |
| Octopus + sequential both conflict | Incompatible stack | Report conflicting pair; stop |
| tsc errors | Stack needs a fix not yet on any branch | Report and leave branch for inspection |
| Test failures | Cross-chain integration bug | Report and leave branch for inspection — this is exactly the signal the preview is meant to surface |
