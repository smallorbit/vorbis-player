#!/usr/bin/env bash
# Usage: ./scripts/new-worktree.sh [name]
# Creates a new git worktree on a short-lived branch off the current HEAD.
# When done, push or merge the wt/* branch back into the main branch.
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
PARENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
NAME="${1:-wt-$(date +%s)}"
WT_BRANCH="wt/${NAME}"
WORKTREE_PATH="${REPO_ROOT}/../${REPO_NAME}-${NAME}"

echo "Creating worktree: $WORKTREE_PATH"
echo "Parent branch:     $PARENT_BRANCH"
echo "Worktree branch:   $WT_BRANCH"
echo ""

git worktree add -b "$WT_BRANCH" "$WORKTREE_PATH" HEAD

echo ""
echo "Installing dependencies..."
(cd "$WORKTREE_PATH" && npm install --silent)

echo "Copying environment file..."
if [ -f "${REPO_ROOT}/.env.local" ]; then
  cp "${REPO_ROOT}/.env.local" "${WORKTREE_PATH}/.env.local"
  echo "  .env.local copied."
elif [ -f "${REPO_ROOT}/.env" ]; then
  cp "${REPO_ROOT}/.env" "${WORKTREE_PATH}/.env.local"
  echo "  .env copied as .env.local."
else
  echo "  WARNING: No .env.local or .env found in main repo — copy it manually."
fi

echo "Copying Claude settings..."
mkdir -p "${WORKTREE_PATH}/.claude"
for f in settings.json settings.local.json; do
  if [ -f "${REPO_ROOT}/.claude/${f}" ]; then
    cp "${REPO_ROOT}/.claude/${f}" "${WORKTREE_PATH}/.claude/${f}"
    echo "  .claude/${f} copied."
  fi
done

echo ""
echo "Done! Open a new terminal and run:"
echo ""
echo "  cd \"$WORKTREE_PATH\" && claude"
echo ""
echo "When finished, run /close-worktree from your MAIN session (not the worktree):"
echo ""
echo "  /close-worktree $NAME"
echo ""
echo "Or manually from your main worktree:"
echo ""
echo "  git branch $NAME $WT_BRANCH"
echo "  git push -u \$(git remote | head -1) $NAME"
echo "  git worktree remove \"$WORKTREE_PATH\""
echo "  git branch -d $WT_BRANCH"
echo "  gh pr create --base $PARENT_BRANCH --head $NAME"
echo ""
