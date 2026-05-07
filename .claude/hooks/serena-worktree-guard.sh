#!/usr/bin/env bash
# PreToolUse hook: deny Serena write tools when the agent's session cwd is not
# the Serena MCP project root.
#
# Why: Serena MCP launches once with `--project .` relative to Claude Code's
# initial cwd (the main worktree). All sub-agents share that single MCP
# connection, so Serena write tools (replace_symbol_body, insert_*_symbol,
# rename_symbol, safe_delete_symbol, replace_content) silently land in the
# main worktree's files even when the calling agent works in
# .claude/worktrees/agent-*.
#
# This hook reads the session cwd from the hook payload, compares it against
# the main worktree (= Serena project root), and denies the call if they
# differ. Read tools (find_symbol, get_symbols_overview,
# find_referencing_symbols) remain unaffected.

set -euo pipefail

payload="$(cat)"

cwd_raw="$(printf '%s' "$payload" | jq -r '.cwd // empty')"
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // empty')"

if [[ -z "$cwd_raw" ]]; then
  exit 0
fi

main_worktree="$(git -C "$cwd_raw" worktree list --porcelain 2>/dev/null | awk '/^worktree / {print $2; exit}')"
if [[ -z "$main_worktree" ]]; then
  exit 0
fi

session_canonical="$(cd "$cwd_raw" 2>/dev/null && pwd -P || printf '%s' "$cwd_raw")"
main_canonical="$(cd "$main_worktree" 2>/dev/null && pwd -P || printf '%s' "$main_worktree")"

if [[ "$session_canonical" == "$main_canonical" ]]; then
  exit 0
fi

cat <<EOF >&2
[serena-worktree-guard] DENIED: $tool_name

Serena MCP is pinned to the main worktree:
  $main_canonical

Your session cwd is:
  $session_canonical

Serena write tools (replace_symbol_body, insert_*_symbol, rename_symbol,
safe_delete_symbol, replace_content) resolve relative paths against Serena's
project root, so calling them from this worktree would silently edit files in
the main worktree instead of yours.

Use the Read + Edit tools instead — they respect this worktree's cwd.

Navigation tools (find_symbol, find_referencing_symbols,
get_symbols_overview, search_for_pattern) are still allowed; just remember
the absolute paths in their output point to the main worktree.
EOF
exit 2
