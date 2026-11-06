# Deploying Vorbis Player

Vorbis Player is a fully static single-page app. `npm run build` emits a
self-contained `dist/` directory (HTML, JS, CSS, assets) that any static host
can serve — there is no server runtime and no host-specific code in the repo.

This document defines the **provider-agnostic deploy contract**. The app repo
knows nothing about Vercel, Netlify, S3, nginx, or any other host; it only knows
how to produce `dist/` and how to hand that build to a deploy command you supply.

## The build

```bash
npm run build      # tsc -b && vite build  →  writes ./dist
```

Build-time configuration comes from `VITE_*` environment variables (read from
`.env.local` locally, or from the CI/host environment). See
[Environment Configuration](../CLAUDE.md#environment-configuration):

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SPOTIFY_CLIENT_ID` | yes | Spotify OAuth client id |
| `VITE_SPOTIFY_REDIRECT_URI` | yes | Spotify OAuth callback (must match the deployed origin) |
| `VITE_DROPBOX_CLIENT_ID` | no | enables the Dropbox provider |
| `VITE_LASTFM_API_KEY` | no | enables radio recommendations |

> The build also bakes in provenance constants (`__BUILD_SHA__`,
> `__BUILD_REF__`, `__BUILD_ENV__`) surfaced in Settings → Advanced → About.
> These read from `VERCEL_GIT_*` when present and otherwise fall back to local
> `git`; they are informational only and impose no host requirement.

## Serving `dist/`

Any static file host works. The app is a client-routed SPA, so the host must
**rewrite unknown paths to `/index.html`** (so deep links like
`/auth/spotify/callback` load the app). Beyond that single rule there are no
requirements — no Node runtime, no serverless functions, no build hooks.

## `npm run deploy` — the deploy driver

`scripts/deploy.ts` runs `npm run test:run`, builds once, then invokes a deploy
command you define via environment variables. It is host-agnostic: it never
references a specific provider.

| npm script | Command | `DEPLOY_ENV` passed to target |
|---|---|---|
| `npm run deploy` | `tsx scripts/deploy.ts --prod` | `production` |
| `npm run deploy:preview` | `tsx scripts/deploy.ts` | `preview` |

When `DEPLOY_TARGET` includes both `vercel` and `--prebuilt`, the driver runs
`npx vercel build` (not `npm run build`) so the subsequent `vercel deploy
--prebuilt` does not rebuild the app.

### Contract

| Env var | Required | Meaning |
|---|---|---|
| `DEPLOY_TARGET` | yes | Shell command that publishes `./dist` to your host. |
| `DEPLOY_TARGET_PROD` | no | Production override used by `npm run deploy`; falls back to `DEPLOY_TARGET`. |
| `DEPLOY_ENV` | (set by the driver) | `production` or `preview`, exported into the target command's environment so a wrapper can branch on it. |

If `DEPLOY_TARGET` is unset the driver prints the contract and exits non-zero —
it never assumes a default host.

### Examples

```bash
# Vercel CLI (project-linked; no global install — use npx)
DEPLOY_TARGET="npx vercel deploy --prebuilt" \
  DEPLOY_TARGET_PROD="npx vercel deploy --prod --prebuilt" npm run deploy

# Netlify CLI
DEPLOY_TARGET="netlify deploy --dir=dist" \
  DEPLOY_TARGET_PROD="netlify deploy --dir=dist --prod" npm run deploy

# Plain rsync to a static host
DEPLOY_TARGET="rsync -a --delete dist/ user@host:/srv/vorbis-player" npm run deploy

# AWS S3 + CloudFront
DEPLOY_TARGET="aws s3 sync dist/ s3://my-bucket --delete" npm run deploy
```

The target runs **after** a successful build, with the freshly-built `dist/`
present and `DEPLOY_ENV` exported.

## Staging / preview PR deploys

`.github/workflows/staging-pr.yml` is a manually-triggered workflow that
rebuilds a `staging` branch from `main`, merges a chosen PR onto it, and pushes
it. This is pure git plumbing and carries no host coupling. Turning that branch
into a live URL is the host's job:

- **Git-integration hosts** (Vercel, Netlify, Cloudflare Pages, …) that watch
  the `staging` branch build and serve it automatically — nothing else needed.
- **Other hosts**: set the `STAGING_DEPLOY_TARGET` repository variable to a
  deploy command. The workflow passes it through as `DEPLOY_TARGET` and runs
  `npm run deploy:preview` after pushing the branch. Provide the `VITE_*` build
  values as repository secrets/variables so the CI build can read them.

## Release checklist

Run through this before promoting a build to production. CI covers the unit,
e2e, and accessibility gates; these are the items it cannot judge.

1. **Gates green on the PR into `main`**: `npm run test:run`, `npm run test:e2e`,
   `npm run lint`, `npm run knip`, `npm run check:circular`, `npm run audit:ci`.
2. **Staged and checked by hand**: run the `staging-pr.yml` workflow for the
   release PR, then on the staging URL:
   - log in to Spotify and play a track through the Web Playback SDK;
   - play a Dropbox track;
   - watch the browser console for Content-Security-Policy violations
     (`[Report Only]` while the policy is report-only).
3. **Manifest is current** (`vite.config.ts` → `VitePWA({ manifest })`):
   - `description` names every supported provider and nothing else;
   - no `orientation` lock;
   - `any` and `maskable` icons are listed separately, and the maskable icons
     were regenerated with `npm run pwa-icons` if the app icon changed;
   - `theme_color` / `background_color` still match the app shell.
4. **Security headers travel with the host**: `vercel.json` carries the CSP,
   HSTS, and `Referrer-Policy`. On any other host, port those headers; `vite
   preview` serves the same set (with the CSP enforced), so `npm run test:e2e`
   proves the policy against the build.
5. **Service worker updates**: after the deploy, a reload picks up the new
   worker (`skipWaiting` + `clientsClaim`). Confirm in DevTools → Application
   that `sw.js` shows the new build and Cache Storage holds no `vap-*` caches.
