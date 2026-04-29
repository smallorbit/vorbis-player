# Vorbis Player

A music player with visualizers and multi-provider support (Spotify, Dropbox), built for enjoying music and album art. Features customizable visual effects, animated background visualizers, unified playback, and a fully responsive design.

## See the glow and visualizers in action
<video src="https://github.com/user-attachments/assets/e1c97122-0ef6-4f7a-8e43-1004529d6aa2" controls autoplay loop muted></video>

## Screenshots

#### Normal mode
<img src="public/assets/player-main.png" alt="Vorbis Player (Full)" width="600">

#### Zen mode
<img src="public/assets/zen-mode.png" alt="Vorbis Player - Zen Mode" width="600">

#### Queue drawer
<img src="public/assets/queue-drawer.png" alt="Vorbis Player - Queue" width="600">

#### Library
<img src="public/assets/library-drawer.png" alt="Vorbis Player - Library" width="600">

## Features

- **Multi-Provider Support** — Stream from Spotify or your personal Dropbox music library; enable/disable providers via a single toggle in settings (requires re-auth when not yet connected; disabling removes that provider's tracks from the queue)
- **Unified Cross-Provider Playback** — Keep playback controls consistent across mixed Spotify + Dropbox queues
- **Zen Mode** — Distraction-free playback with hover-activated controls (desktop) or touch gestures (mobile), album art focus, and auto-hiding bottom bar
- **Queue** — See and edit what plays next (reorder, remove, deduplicate) in the queue drawer or mobile sheet
- **Playlists & Albums** — Browse, search, sort, filter, and pin your **library** collections (not the same as the playback queue)
- **Library** — Full-screen library surface organized as scannable rows (Resume, Recently Played, Pinned, Liked, Playlists, Albums) with search, command palette, and per-card context menus
- **All Music shuffle** — Dropbox users get an "All Music" card pinned to the top of the playlist grid that always plays your entire library shuffled
- **Unified Liked Songs** — Merge liked tracks from connected providers into one queue; "Play Liked" and "Queue Liked" filter any collection to just your favorites
- **Track Radio** — Generate a one-shot radio playlist from the current track (Last.fm-powered matching)
- **Visual Effects** — Dynamic glow, configurable album art filters, accent color backgrounds
- **Background Visualizers** — Animated particle and geometric visualizer backgrounds
- **Album Art Flip Menu** — Tap album art to reveal quick-access visual controls
- **Swipe Gestures** — Swipe to change tracks, open the queue, or browse the library
- **Keyboard Shortcuts** — Context-aware controls with device-specific behavior
- **Responsive Design** — Fluid layout from mobile phones to ultra-wide desktops
- **Session Resume** — Pick up where you left off — playback position, queue, and track are restored on reopen
- **Landing Experience** — First-run users get a one-time Welcome screen; returning users see a prominent Resume hero (when the optional Quick Access Panel is enabled) or a hydrated, paused player ready to resume, with a dismiss-on-play resume toast confirming the restored track. Sessions older than 30 days fall back to the Library view.
- **Instant Startup** — IndexedDB-based library cache with background sync

## Quick Start

```bash
git clone git@github.com:smallorbit/vorbis-player.git
cd vorbis-player
npm install
cp .env.example .env.local   # Add your provider credentials
# For local dev, set VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/auth/spotify/callback
npm run dev                   # Open http://127.0.0.1:3000
```

You'll need credentials from at least one provider. See the **[Getting Started Guide](./docs/getting-started.md)** for full setup instructions including provider configuration.

For radio recommendations, also set `VITE_LASTFM_API_KEY` in `.env.local` (see `.env.example`).

## Documentation

| Guide | Description |
|-------|-------------|
| **[Getting Started](./docs/getting-started.md)** | Installation, environment setup, and first run |
| **[User Guide](./docs/user-guide.md)** | All player features, controls, and keyboard shortcuts |
| **[Contributing](./docs/contributing.md)** | Development setup, project structure, coding conventions |
| **[Architecture](./CLAUDE.md#architecture)** | System design, provider model, playback flow |
| **[Troubleshooting](./docs/troubleshooting.md)** | Common issues and solutions |

### Provider Setup

| Provider | Guide | Requirements |
|----------|-------|-------------|
| Spotify | **[Spotify Setup](./docs/providers/spotify-setup.md)** | Spotify Premium + Developer App |
| Dropbox | **[Dropbox Setup](./docs/providers/dropbox-setup.md)** | Dropbox account with audio files |

### Deployment

| Platform | Guide |
|----------|-------|
| Vercel | **[Deploy to Vercel](./docs/deployment/deploy-to-vercel.md)** |

## Testing & Playwright

Unit and integration tests run with Vitest (`npm run test:run`).

End-to-end and visual-capture tests run with Playwright against the **mock provider** — a drop-in replacement for Spotify and Dropbox that serves catalog from committed JSON snapshots and plays bundled audio. No real credentials, no browser login, no SDK required.

### Running Playwright tests

```bash
npm run test:e2e          # run all specs
npm run test:e2e:ui       # Playwright UI mode
```

### Visual capture (screenshots / snapshots)

```bash
npm run capture           # both desktop + mobile
npm run capture:desktop
npm run capture:mobile
```

The dev server starts automatically with `VITE_MOCK_PROVIDER=true`. No login required.

### Mock provider

Activate in any environment:

```bash
VITE_MOCK_PROVIDER=true npm run dev   # env var
# or open http://127.0.0.1:3000?provider=mock
```

The mock provider is tree-shaken from production builds — it only activates when `VITE_MOCK_PROVIDER=true` at build time or the `?provider=mock` URL parameter is present.

### Curating fixtures

Vorbis Player's Playwright tests run against committed JSON snapshots of a real
Spotify/Dropbox library. Because each user's library is different, you curate which
playlists/albums get captured before generating the snapshot.

1. **Enumerate** your library (read-only):
   ```
   npm run dev &
   npm run snapshot:spotify -- --list
   npm run snapshot:dropbox -- --list
   ```
   Each command logs you in interactively (Chromium pops up; log in once and press
   Enter when ready) and prints a list of available playlists / albums / folders
   with their IDs.

2. **Edit `playwright/fixtures/data/snapshot.config.json`** to include the IDs and
   folder paths you want to curate. Aim for a small, representative set — about
   5–10 playlists, a few saved albums, and the most-played folders. The committed
   file ships with empty arrays so you can populate from scratch.

3. **Generate the snapshot** (writes JSON + downloads art):
   ```
   npm run snapshot:spotify
   npm run snapshot:dropbox
   ```
   Personal data is anonymized automatically (display name, owner names, profile
   picture). Public catalog data (album/track/artist names, durations, ISRCs) is
   preserved verbatim.

4. **Review the diff** in `playwright/fixtures/data/*.json` and
   `public/playwright-fixtures/art/` and commit. The PR review is the human gate
   for any PII that slips past the automatic scrubber.

Re-curate any time your library changes substantially. Re-running with the same
`scripts/snapshot/seed.json` produces deterministic diffs (only changed content
shows up).

## Tech Stack

React 18 · TypeScript 5 · Vite 6 · styled-components · Tailwind CSS · shadcn/ui · Radix UI · Vitest

## License

MIT
