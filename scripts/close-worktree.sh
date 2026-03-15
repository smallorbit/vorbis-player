#!/usr/bin/env bash
# Usage: ./scripts/close-worktree.sh <name>
# Rebases a wt/<name> branch onto the base branch, pushes it as a feature branch,
# removes the worktree, and deletes the local wt/ branch.
# Must be run from the main repo, not from inside the worktree.
set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/close-worktree.sh <name>"
  echo ""
  echo "Available worktree branches:"
  git branch --list 'wt/*' | sed 's/^/  /'
  exit 1
fi

# Resolve paths relative to the main worktree, not the current directory
REPO_ROOT="$(git worktree list | head -1 | awk '{print $1}')"
REPO_NAME="$(basename "$REPO_ROOT")"
NAME="${1#wt/}"

WT_BRANCH="wt/${NAME}"
FEATURE_BRANCH="$NAME"
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

BASE_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "Rebasing $WT_BRANCH onto $BASE_BRANCH..."
(cd "$WORKTREE_PATH" && git rebase "$BASE_BRANCH")

echo "Creating feature branch $FEATURE_BRANCH..."
git branch "$FEATURE_BRANCH" "$WT_BRANCH"

echo "Pushing $FEATURE_BRANCH to remote..."
REMOTE="$(git remote | head -1)"
git push -u "$REMOTE" "$FEATURE_BRANCH"

echo "Removing worktree..."
git worktree remove "$WORKTREE_PATH"

echo "Deleting local branch $WT_BRANCH..."
git branch -d "$WT_BRANCH"

echo ""
echo "Done! Branch '$FEATURE_BRANCH' has been pushed to $REMOTE."
echo "Base branch: $BASE_BRANCH"
echo ""
echo "Create a PR with:"
echo "  gh pr create --base $BASE_BRANCH --head $FEATURE_BRANCH"
