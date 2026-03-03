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

1. Run the script via Bash:

```bash
cd "$(git rev-parse --show-toplevel)" && bash scripts/new-worktree.sh [name]
```

2. Show the user the output, including the `cd ... && claude` line to open in a new terminal.
