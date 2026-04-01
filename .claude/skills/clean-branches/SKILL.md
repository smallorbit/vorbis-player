---
name: clean-branches
description: Bulk-delete orphaned local branches and remote branches whose PRs have been merged or closed. Run after a merge cycle to keep the branch list clean.
---

# Clean Branches

Remove stale local branches and remote branches that have had their PRs merged or closed.

## Usage

```
/clean-branches
```

## Steps

### 1. Fetch and prune remote tracking refs

```bash
git fetch --prune
```

This removes remote-tracking refs for branches deleted on the remote.

### 2. Find orphaned local branches

Local branches with no remote tracking ref are orphaned:

```bash
git branch -vv | grep -v 'origin/'
```

Also check for branches merged into main (safe to delete):

```bash
git branch --merged main | grep -v '^\* main$'
```

### 3. Delete orphaned local branches

Use `-d` for merged branches, `-D` for unmerged ones (backup/* branches, old feature branches with no remote):

```bash
git branch -D <branch1> <branch2> ...
```

For branch names with spaces (common in backup/* branches), use a loop:

```bash
git branch | grep 'backup/' | while IFS= read -r branch; do
  branch="${branch#  }"
  git branch -D "$branch"
done
```

### 4. Find remote branches with merged/closed PRs

Get all merged PR branch names:

```bash
gh pr list --state merged --limit 100 --json headRefName --jq '.[].headRefName'
```

Get all current remote branches (excluding protected):

```bash
gh api repos/{owner}/{repo}/branches --paginate --jq '.[].name' | grep -vE '^(main|staging)$'
```

Cross-reference: delete remote branches that appear in the merged PR list.

### 5. Delete merged remote branches

```bash
git push origin --delete <branch1> <branch2> ...
```

Or in a loop for many branches:

```bash
for branch in branch1 branch2; do
  git push origin --delete "$branch" && echo "deleted: $branch" || echo "failed: $branch"
done
```

### 6. Report what was skipped

List any remote branches with **no PR at all** — these may be long-lived feature branches or abandoned work. Present them to the user and ask before deleting.

## Notes

- Never delete `main`, `staging`, or any branch the user is actively working on.
- Branches without PRs (e.g. `apple-music-integration`, `feature/vorbis-mode`) should be flagged to the user rather than auto-deleted.
- `backup/*` branches are created automatically by Claude Code worktree scripts — safe to force-delete.
