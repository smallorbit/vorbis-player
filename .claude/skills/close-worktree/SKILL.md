---
name: close-worktree
description: Rebase a wt/* worktree branch onto the current branch, remove the worktree directory, and delete the temporary branch. Use when the user is done with parallel work in a worktree.
---

# Close Worktree

Run the cleanup script, then confirm what was rebased.

Works correctly whether invoked from inside the worktree or from the main repo.

## Usage

```
/close-worktree [name]
```

`name` is optional — if omitted and the current branch is a `wt/*` branch, the name is auto-detected.

## Steps

1. Run the script via Bash. This captures the current branch name first (before cding to the main worktree), strips the `wt/` prefix, then runs the cleanup from the correct location:

```bash
cd "$(git worktree list --porcelain | awk '/^worktree/{print $2; exit}')" && bash scripts/close-worktree.sh "$(git rev-parse --abbrev-ref HEAD | sed 's|^wt/||')"
```

If `name` was passed as an argument, use it directly instead of auto-detecting:

```bash
cd "$(git worktree list --porcelain | awk '/^worktree/{print $2; exit}')" && bash scripts/close-worktree.sh <name>
```

2. Confirm to the user that the branch was merged and the worktree was removed.
