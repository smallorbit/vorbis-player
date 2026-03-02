#!/usr/bin/env bash
# Usage: ./scripts/close-worktree.sh [name]
# Rebases a wt/<name> branch onto the current branch, removes the worktree, and deletes the branch.
# If <name> is omitted and the current branch is a wt/* branch, it is auto-detected.
set -e

# Always resolve paths relative to the main worktree, not the current worktree
REPO_ROOT="$(git worktree list --porcelain | awk '/^worktree/{print $2; exit}')"
REPO_NAME="$(basename "$REPO_ROOT")"

if [ -z "$1" ]; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$CURRENT_BRANCH" == wt/* ]]; then
    NAME="${CURRENT_BRANCH#wt/}"
    echo "Auto-detected worktree name: $NAME"
  else
    echo "Usage: ./scripts/close-worktree.sh <name>"
    echo ""
    echo "Available worktree branches:"
    git branch --list 'wt/*' | sed 's/^/  /'
    exit 1
  fi
else
  NAME="$1"
fi

WT_BRANCH="wt/${NAME}"
WORKTREE_PATH="${REPO_ROOT}/../${REPO_NAME}-${NAME}"

# Ensure we're not running from inside the worktree being closed
CURRENT_DIR="$(pwd -P)"
WT_REAL="$(cd "$WORKTREE_PATH" 2>/dev/null && pwd -P || true)"
if [ -n "$WT_REAL" ] && [ "$CURRENT_DIR" = "$WT_REAL" ]; then
  echo "Error: run this from the main repo, not from inside the worktree."
  exit 1
fi

# Verify the branch exists
if ! git show-ref --verify --quiet "refs/heads/${WT_BRANCH}"; then
  echo "Error: branch '$WT_BRANCH' does not exist."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "Rebasing $WT_BRANCH onto $CURRENT_BRANCH..."
(cd "$WORKTREE_PATH" && git rebase "$CURRENT_BRANCH")

echo "Fast-forwarding $CURRENT_BRANCH..."
git merge --ff-only "$WT_BRANCH"

echo "Removing worktree..."
git worktree remove "$WORKTREE_PATH"

echo "Deleting branch $WT_BRANCH..."
git branch -d "$WT_BRANCH"

echo ""
echo "Done! Worktree '$NAME' has been rebased and cleaned up."
