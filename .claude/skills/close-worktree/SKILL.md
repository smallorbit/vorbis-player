---
name: close-worktree
description: Rebase a wt/* worktree branch onto the current branch, remove the worktree directory, and delete the temporary branch. Use when the user is done with parallel work in a worktree.
---

# Close Worktree

Run the cleanup script from the **main repo session** (not from inside the worktree). The script needs to run `git merge` and `git worktree remove` from the main repo context.

## Usage

```
/close-worktree <name>
```

`name` is the same name used when the worktree was created with `/new-worktree`.

## Steps

1. Run the script via Bash, passing the worktree name:

```bash
cd "$(git rev-parse --show-toplevel)" && bash scripts/close-worktree.sh <name>
```

2. Confirm to the user that the branch was merged and the worktree was removed.
