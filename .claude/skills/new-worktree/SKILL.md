---
name: new-worktree
description: Create a new git worktree from the current branch, install dependencies, and copy the env file. Use when the user wants to work in parallel across worktrees.
---

# New Worktree

Run the setup script, then tell the user the path to open in a new terminal.

## Usage

```
/new-worktree [name]
```

`name` is optional — defaults to a timestamp-based name if omitted.

## Steps

1. Get the repo root:

```bash
git rev-parse --show-toplevel
```

2. Run the setup script (use the path from step 1, do NOT chain with `&&`):

```bash
bash /path/to/repo/scripts/new-worktree.sh [name]
```

3. Show the user the output, including the `cd ... && claude` line to open in a new terminal.
