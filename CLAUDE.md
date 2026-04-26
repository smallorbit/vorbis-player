# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI assistants when working with code in this repository.

## Project Overview

**Vorbis Player** is a React/TypeScript music player with customizable visual effects and a pluggable provider architecture. Supports **Spotify** (streaming, Premium required) and **Dropbox** (personal files via HTML5 Audio), including cross-provider queues.

Key capabilities: multi-provider auth/catalog/playback adapters, unified liked songs, cross-provider playback handoff, Last.fm-powered radio queue generation, background visualizers, album art flip menu, bottom bar, swipe gestures (queue drawer / full-screen library — legacy LibraryPage and opt-in LibraryRoute behind useNewLibraryRoute), keyboard shortcuts, IndexedDB caching, responsive layout.

## Architecture docs

Deep-dive references — load on demand:

| Topic | Doc |
|---|---|
| Layout, idle routing, hydrate flow, zen mode, visualizers, responsive sizing | `docs/architecture/layout.md` |
| Multi-provider model, toggle behavior, radio, Spotify/Dropbox internals | `docs/architecture/providers.md` |
| Playback flow + queue mutation flow | `docs/architecture/playback.md` |
| shadcn/ui integration, theme bridge, canonical patterns, z-index | `docs/architecture/shadcn.md` |

User-facing docs live in `docs/features/` and `docs/providers/`. Troubleshooting (provider issues, layout pitfalls, debug logging) is in `docs/troubleshooting.md`.

## Build Verification

Verify the build compiles cleanly after removing dependencies, refactoring imports, or making multi-file changes:

```bash
npx tsc -b --noEmit       # TypeScript check
npm run build             # Full build
```

Check for dangling references in `vite.config.ts`, `tsconfig.json`, etc.

## UI & CSS Guidelines

When modifying CSS layout or styling, avoid making additional 'clever' adjustments beyond what was requested. If the user asks to constrain width or center an element, do exactly that — don't add spacers, override calculated dimensions, or restructure containers unless explicitly asked.

Make the minimal change first, confirm it works visually, then iterate. Do not combine multiple layout changes into a single large edit.

## Git & PR Workflow

Run `npm test` before `git push` and before creating any PR. Feature branches from main (`feature/name`, `fix/name`). Atomic commits with conventional format. Reference issue numbers.

## Worktree Setup

When creating or working in a git worktree:

```bash
npm install
cp ../.env.local .env.local
```

Worktrees don't inherit `node_modules`. `.env.local` contains Spotify credentials needed for tests. Verify with `npm run test:run`.

## Development Commands

```bash
npm run dev            # Start dev server
npm run build          # Build for production
npm run lint           # Lint
npm run test           # Watch mode
npm run test:run       # Run once
npm run test:coverage  # Coverage
npm run deploy         # Deploy to production
npm run deploy:preview # Deploy preview
```

## Source Layout

```
src/
├── components/      # React components; key subdirs: ui/ (shadcn primitives), PlayerContent/, BottomBar/, PlaylistSelection/, QuickAccessPanel/, AppSettingsMenu/, controls/, visualizers/
├── contexts/        # React context providers (TrackContext, ColorContext, etc.)
├── providers/       # Multi-provider system; spotify/ and dropbox/ subdirs
├── hooks/           # Custom hooks
├── services/        # spotify.ts (auth + API), spotifyPlayer.ts (lazy SDK + playback), cache/ (IndexedDB)
├── constants/       # playlist.ts, zenAnimation.ts, storage.ts
├── utils/           # colorExtractor, sizingUtils, playlistFilters, etc.
├── workers/         # imageProcessor.worker.ts
├── types/           # domain.ts, providers.ts, filters.ts
├── styles/          # theme.ts, ThemeProvider, shadcn-tokens.css, global styles
└── lib/utils.ts
```

## Terminology

- **Queue** — tracks scheduled to play next (reorder/remove in `QueueDrawer` / `QueueBottomSheet`; list UI in `QueueTrackList.tsx`).
- **Playlist** — a library **collection** from a provider (Spotify playlist, Dropbox folder-as-album, Liked Songs, etc.), browsed via `PlaylistSelection` (legacy `LibraryPage`) or `LibraryRoute` (opt-in via `useNewLibraryRoute`), and loaded through `usePlaylistManager` / catalog APIs.

## Tech Stack

See README.md for the full tech stack. Build: ES2020, esbuild, manual chunks (vendor/radix/styled).

## Environment Configuration

Required in `.env.local`:

```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```

Optional (enables Dropbox):

```
VITE_DROPBOX_CLIENT_ID="your_dropbox_app_key"
```

Optional (enables radio recommendations):

```
VITE_LASTFM_API_KEY="your_lastfm_api_key"
```

Vite dev server: host `127.0.0.1`, port `3000` (required for Spotify OAuth).
Path alias: `@/` → `./src/` (e.g. `import { x } from '@/hooks/usePlayerState'`).

## Coding Conventions

- Functional components with hooks; `React.memo` for optimization
- One component per file, named exports; keep files under 500 lines
- styled-components with `src/styles/theme.ts`; hardware-accelerated animations
- Container queries as primary responsive strategy, media queries as fallback
- `useLocalStorage` hook for persistence with `'vorbis-player-'` key prefix
- Strict TypeScript; `import type` when possible; types in `src/types/`

## Testing

Run with `npm run test:run`. Tests are colocated with source files in `__tests__/` subdirectories. Verify actual behavior, not mock implementations. See `docs/testing.md` for test utilities (`src/test/`) and the BDD `// #given / #when / #then` comment convention.

## Keyboard Shortcuts

See `docs/keyboard.md` for the full table. Centralized in `useKeyboardShortcuts.ts`.

## Common Issues

See `docs/troubleshooting.md` for layout, provider, and radio issues. Layout invariants are documented in `docs/architecture/layout.md`.

## Command Instructions

- `/commit` — Commit current changes, split into logical commits
- `/doc` — Update README.md
- `/comdoc` — Update README.md then commit

## AI Workflow Rules

For structured feature development, see `.claude/rules/`:

- `generate_prd.md` — PRD creation process: asks clarifying questions, then generates a structured requirements doc
- `generate_tasks_from_prd.md` — breaks a PRD into a detailed parent/subtask list; waits for "Go" confirmation before generating subtasks
- `process_tasks.md` — task execution protocol: one subtask at a time, with test + commit gates before marking parent complete

## Multi-Agent Team Workflows

For epics that benefit from parallel specialist work, this project ships a six-role team (lead + explorer + architect + builder + reviewer + tester). See `.claude/agents/README.md` for spawn/retro skills (`/spawn-team`, `/agent-team-retro`), agent-definition conventions, and when to use the team.
