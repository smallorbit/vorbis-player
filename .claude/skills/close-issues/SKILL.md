---
name: close-issues
description: Close GitHub issues that were addressed by recently merged PRs. Because PRs target `staging` (not `main`), GitHub never auto-closes issues. Use after merging PRs into staging or after cutting a staging → main release.
---

# Close Issues

Find GitHub issues referenced in recently merged PRs and close any that are still open.

## Usage

```
/close-issues
```

## Steps

1. Get merged PRs from the last batch (recent staging merges or today's work):

```bash
gh pr list --state merged --limit 20 --json number,title,mergedAt,body
```

2. Extract issue references from PR bodies — look for patterns like `Closes #N`, `Fixes #N`, `Resolves #N` (case-insensitive).

3. For each referenced issue number, check if it's still open:

```bash
gh issue view <N> --json number,title,state
```

4. Close any that are still open, with a comment referencing the PR that addressed it:

```bash
gh issue close <N> --comment "Resolved in #<PR> (merged to staging)."
```

5. Report to the user which issues were closed and which were already closed.

## Notes

- PRs in this repo target `staging`, not `main` — GitHub's auto-close only fires when merging to the default branch, so issues stay open even after the fix lands.
- If running after a staging → main release (cut-staging), you can scan the full staging diff: `git log main..origin/staging --oneline` before the merge to catch all referenced issues.
