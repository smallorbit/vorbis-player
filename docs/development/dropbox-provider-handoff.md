# Handoff: Dropbox Provider & Multi-Provider Architecture

**Branch:** `feature--dropbox-as-a-provider`  
**Status:** Planning complete; implementation not started  
**Last updated:** March 2025

---

## What This Is

We're adding **Dropbox as a music source** so users can stream their personal music from Dropbox alongside Spotify. The work is structured as a **multi-provider architecture**: Spotify is abstracted behind pluggable provider interfaces so Dropbox (and later Apple Music or others) can be added as separate modules. Users choose **one active source at a time** in app settings (Connect Spotify / Connect Dropbox, “Use this source”).

---

## What’s Already Done (Scaffolding)

All of the following is committed on `feature--dropbox-as-a-provider`:

| Deliverable | Location | Purpose |
|-------------|----------|---------|
| **PRD** | [`docs/prd-dropbox-provider.md`](../prd-dropbox-provider.md) | Goals, user segments, functional/non-functional requirements, UX flows, out-of-scope for v1 |
| **Provider domain types** | `src/types/domain.ts` | `ProviderId`, `MediaTrack`, `MediaCollection`, `CollectionRef`, `PlaybackState`, `collectionRefToKey` / `keyToCollectionRef` |
| **Provider contracts** | `src/types/providers.ts` | `AuthProvider`, `CatalogProvider`, `PlaybackProvider`, `ProviderDescriptor`, `ProviderRegistry` |
| **Spotify adapter migration plan** | [`docs/implementation-plans/spotify-adapter-migration.md`](../implementation-plans/spotify-adapter-migration.md) | Step-by-step refactor so hooks/components use provider interfaces instead of `spotifyAuth` / `spotifyPlayer` |
| **Settings provider UX plan** | [`docs/implementation-plans/settings-provider-ux.md`](../implementation-plans/settings-provider-ux.md) | Music sources section in app settings (gear drawer): connect/disconnect, “Use this source”, persistence |
| **Dropbox v1 plan** | [`docs/implementation-plans/dropbox-provider-v1.md`](../implementation-plans/dropbox-provider-v1.md) | OAuth, folder listing, metadata indexing, streaming, capability-aware UI |
| **Testing gates** | [`docs/implementation-plans/multi-provider-testing-gates.md`](../implementation-plans/multi-provider-testing-gates.md) | Test strategy and no-regression checkpoints per phase; manual test matrix |

No app behavior has changed yet; the codebase still runs Spotify-only. The new types and contracts are additive.

---

## Recommended Order of Work

Follow the phases in the plans. Dependencies are strict: later phases assume earlier ones are done.

1. **Phase 0 – Domain (optional checkpoint)**  
   Use `domain.ts` and add mapping from Spotify `Track` / `PlaylistInfo` / `AlbumInfo` to `MediaTrack` / `MediaCollection` where you need it. No mandatory new files; you can do this as part of Phase 2.

2. **Phase 1 – Provider registry**  
   Implement `ProviderRegistry` (e.g. `src/providers/registry.ts`) and register no adapters yet (or a stub). Add unit tests for `get` / `getAll` / `has`.

3. **Phase 2 – Spotify adapter migration**  
   - Implement Spotify adapters in `src/providers/spotify/` (auth, catalog, playback) wrapping existing `services/spotify.ts` and `services/spotifyPlayer.ts`.  
   - Add `ProviderContext` (or `ActiveProviderContext`) with `activeProviderId` persisted to `localStorage` (default `"spotify"`).  
   - Refactor hooks and components to use the active provider from context instead of importing `spotifyAuth` / `spotifyPlayer` directly.  
   - **Gate:** All existing tests pass (mocks updated to provider/context); manual Spotify flow unchanged.

4. **Phase 3 – Settings UI**  
   Add the “Music sources” section at the top of the gear drawer; connect/disconnect and “Use this source” per provider; wire to `ProviderContext` and registry.  
   **Gate:** Switching active provider updates library/playback without reload; choice persists.

5. **Phase 4 – Dropbox provider**  
   Implement Dropbox adapter (auth, catalog, playback) per `dropbox-provider-v1.md`; register in registry; handle `/auth/dropbox/callback` in `App.tsx`.  
   **Gate:** Connect Dropbox, pick folder, play tracks; capabilities hide Like / “Open in Spotify” for Dropbox.

6. **Phase 5 – Sync/cache (if needed)**  
   Make library sync and cache provider-aware (Spotify vs Dropbox); keep cache keys isolated per provider.

7. **Phase 6 – QA**  
   Run full test suite and the manual test matrix in `multi-provider-testing-gates.md`.

---

## Next Steps (Where to Start)

**Immediate next steps for the team:**

1. **Read the PRD**  
   [`docs/prd-dropbox-provider.md`](../prd-dropbox-provider.md) — shared source of truth for scope, requirements, and out-of-scope.

2. **Implement the Spotify adapter and provider context**  
   Follow [`docs/implementation-plans/spotify-adapter-migration.md`](../implementation-plans/spotify-adapter-migration.md) Step 1–4 (adapter module, context, auth routing, hooks). This unblocks settings UI and Dropbox.

3. **Add the Music sources section to the settings drawer**  
   Follow [`docs/implementation-plans/settings-provider-ux.md`](../implementation-plans/settings-provider-ux.md). Depends on Step 2 being done.

4. **Implement the Dropbox provider**  
   Follow [`docs/implementation-plans/dropbox-provider-v1.md`](../implementation-plans/dropbox-provider-v1.md). Depends on Steps 2 and 3.

5. **Use the testing gates**  
   Before merging each phase, run the no-regression checklist and tests described in [`docs/implementation-plans/multi-provider-testing-gates.md`](../implementation-plans/multi-provider-testing-gates.md).

---

## Key Files to Touch First

- **New:** `src/providers/registry.ts` — registry implementation.  
- **New:** `src/providers/spotify/*` — Spotify auth, catalog, playback adapters.  
- **New:** `src/contexts/ProviderContext.tsx` (or `ActiveProviderContext.tsx`) — active provider state + persistence.  
- **Refactor:** `App.tsx` — auth callback routing for `/auth/spotify/callback` (and later `/auth/dropbox/callback`).  
- **Refactor:** Hooks that currently import `spotifyAuth` / `spotifyPlayer`: get playback/catalog from `ProviderContext` + active descriptor instead.

See the Spotify adapter migration plan for the full file list and refactor order.

---

## How to Validate

- **Build:** `tsc -b && vite build`  
- **Tests:** `npm run test:run`  
- **Manual:** Sign in with Spotify (and later Dropbox), load library, play/pause/seek, switch provider in settings, confirm persistence and no reload.

---

## Questions / Decisions

- **Dropbox app:** Create a Dropbox app in the [Dropbox Developer Console](https://www.dropbox.com/developers/apps); get app key and set redirect URI (e.g. `http://127.0.0.1:3000/auth/dropbox/callback`). Add `VITE_DROPBOX_APP_KEY` to `.env.local` when implementing Dropbox.  
- **Metadata library:** Dropbox v1 plan suggests a client-side tag parser (e.g. jsmediatags or music-metadata-browser); pick one and add to `package.json` when implementing metadata indexing.

---

## Point of Contact

For scope or architecture questions, refer to the PRD and the four implementation plans; they’re the single source of truth. Update this handoff when the team agrees on owner, timeline, or process changes.
