---
name: deploy-staging
description: Deploy a chosen PR to the staging environment via the staging-pr.yml workflow, wait for Vercel to finish, and report the exact deployed commit SHA the running app should show. Use when the user wants to test a change live on staging or verify what is currently deployed there.
triggers:
  - "deploy <PR> to staging"
  - "put the changes on staging so I can test live"
  - "what's deployed on staging / verify the staging build"
  - "redeploy staging with the latest fix"
allowed-tools: Bash
---

## Context

`staging-pr.yml` ("Deploy PR to Staging") rebuilds the `staging` branch from
`main` and merges ONE chosen PR's head on top, then force-pushes `staging`.
Vercel auto-builds the `staging` branch and serves it at the branch-alias URL.
The build bakes in git provenance (see `feat(build)` / `__BUILD_SHA__`), so the
running app reports its commit at **Settings → Advanced → About**, in a boot
`console.info` banner, and on `window.__BUILD__`.

Live URL: `https://vorbis-git-staging-smallorbit.vercel.app`
(behind Vercel SSO — opens for a logged-in Vercel user).

## Process

1. **Resolve the PR to deploy.** Take it from the user's request, else ask.
   For a stack of PRs, deploy the **tip** PR — staging only ever holds `main` +
   one PR, and the tip branch cumulatively contains the whole stack.

2. **Preflight.** Confirm the PR is deployable and the plumbing exists:
   ```bash
   gh pr view <N> --json state --jq .state           # must be OPEN or MERGED
   gh workflow list | grep -i "Deploy PR to Staging"  # workflow present on main
   git ls-remote --heads origin staging               # staging branch exists
   ```

3. **Dispatch and watch the workflow:**
   ```bash
   gh workflow run staging-pr.yml -f pr_number=<N>
   sleep 10
   RUN=$(gh run list --workflow=staging-pr.yml --limit 1 --json databaseId --jq '.[0].databaseId')
   gh run watch "$RUN" --exit-status
   ```
   If it fails (usually a merge conflict rebuilding `staging` from `main`),
   report the failure and stop — do not retry blindly.

4. **Resolve the deployed SHA.** This is the staging **merge commit**, NOT the
   PR branch HEAD:
   ```bash
   git fetch origin staging -q
   SHA=$(git rev-parse origin/staging)
   echo "${SHA:0:7}"
   ```

5. **Wait for the Vercel deploy of that commit** to finish:
   ```bash
   for i in $(seq 1 20); do
     st=$(gh api repos/:owner/:repo/commits/$SHA/status \
       --jq '.statuses[] | select(.context=="Vercel") | .state' 2>/dev/null | head -1)
     echo "poll $i: $st"
     [ "$st" = "success" ] || [ "$st" = "failure" ] || [ "$st" = "error" ] && break
     sleep 15
   done
   ```

6. **Report** the expected in-app string and how to verify:
   - App shows: **`Build <sha7> · staging · preview`** (Settings → Advanced →
     About, the console banner, or `window.__BUILD__`).
   - URL: `https://vorbis-git-staging-smallorbit.vercel.app`
   - If the change needs a real Spotify session, note the user tests it there
     (staging uses their real Premium session, not the mock provider).

## Constraints

- **Deploy-only. Never merge, rebase, or push `main`** as part of this skill.
- **The reported SHA is `git rev-parse origin/staging`** (the staging merge
  commit), never the PR branch HEAD — the app displays the former.
- **Staging holds `main` + exactly one PR.** Re-running for a different PR
  rebuilds `staging` from `main`, discarding any previously-merged PR. To test
  several stacked PRs together, deploy the tip. Say so if the user expects
  multiple PRs to coexist.
- **Do not retry a failed workflow run automatically** — a failure is a real
  `staging`-from-`main` merge conflict that needs a human.
- The Vercel URL is behind SSO; do not try to fetch/verify it with WebFetch or
  curl (it redirects to `vercel.com/sso-api`). The user verifies in-browser.
- If `VERCEL_GIT_COMMIT_REF`/`ENV` ever differ from `staging`/`preview` in the
  reported line, trust the app's actual output over this doc.
