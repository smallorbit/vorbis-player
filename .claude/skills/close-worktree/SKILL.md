---
name: close-worktree
description: Rebase a wt/* worktree branch onto the base branch, push as a feature branch, create a PR, remove the worktree, and delete the temporary branch. Use when the user is done with parallel work in a worktree.
---

# Close Worktree

Run the cleanup script from the **main repo session** (not from inside the worktree). The script rebases, pushes a feature branch, and cleans up the worktree. Then create a PR.

## Usage

```
/close-worktree <name>
```

`name` is the same name used when the worktree was created with `/new-worktree`.

## Steps

1. Get the repo root:

```bash
git rev-parse --show-toplevel
```

2. Run the cleanup script (use the path from step 1, do NOT chain with `&&`):

```bash
bash /path/to/repo/scripts/close-worktree.sh <name>
```

3. Create a PR using `gh pr create` with the pushed feature branch against the base branch (shown in the script output).

4. Confirm to the user that the branch was pushed, the PR was created, and the worktree was removed.
