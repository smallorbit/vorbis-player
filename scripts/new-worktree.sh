#!/usr/bin/env bash
# Usage: ./scripts/new-worktree.sh [name]
# Creates a new git worktree from the current branch, installs deps, and copies env.
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
NAME="${1:-wt-$(date +%s)}"
WORKTREE_PATH="${REPO_ROOT}/../${REPO_NAME}-${NAME}"

echo "Creating worktree: $WORKTREE_PATH"
echo "Branch: $BRANCH"
echo ""

git worktree add "$WORKTREE_PATH" "$BRANCH"

echo ""
echo "Installing dependencies..."
(cd "$WORKTREE_PATH" && npm install --silent)

echo "Copying environment file..."
if [ -f "${REPO_ROOT}/.env.local" ]; then
  cp "${REPO_ROOT}/.env.local" "${WORKTREE_PATH}/.env.local"
  echo "  .env.local copied."
else
  echo "  WARNING: No .env.local found in main repo — copy it manually."
fi

echo ""
echo "Done! Open a new terminal and run:"
echo ""
echo "  cd \"$WORKTREE_PATH\" && claude"
echo ""
