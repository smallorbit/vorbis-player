# Implementation Plan: App Settings Provider Toggles (Music Sources)

> **Status:** Ready for Implementation  
> **Depends on:** [Spotify Adapter Migration](/Users/roman/src/vorbis-player/docs/implementation-plans/spotify-adapter-migration.md) (provider context and registry in place)  
> **Created:** March 2025

## Overview

Add a **Music sources** (or **Providers**) section to the app settings drawer opened by the gear icon in the bottom bar. Users can connect/disconnect each provider (Spotify, Dropbox) and choose a single **active** source. The active provider drives the library view and playback. Preferences are persisted so the choice survives reloads.

## Goals

- **FR (from PRD):** Users can connect/disconnect providers from app settings; only one provider is active at a time; active provider is persisted.
- **UX:** One place to see status (Connected / Not connected / Error) and to connect, disconnect, or switch active source.
- **State:** Provider connection state and active-provider preference are in a dedicated layer (context + localStorage), not mixed into VisualEffectsContext.

## UX Specification

### Where it lives

- **Drawer:** The same drawer opened by the gear button in the bottom bar (today this shows “Visual Effects” and related controls). Add a new section at the **top** of the drawer content: **Music sources**.
- **No new global button:** Reuse the existing gear; keep “advanced” and visual controls below the new section.

### Section: Music sources

- **Title:** “Music sources” or “Providers”.
- **One row per available provider** (from `ProviderRegistry.getAll()`), e.g.:
  - **Spotify:** label “Spotify”, then:
    - **Status:** “Not connected” | “Connecting…” | “Connected” | “Error” (with short message if applicable).
    - **Primary action:**
      - If not connected: button “Connect” → calls `descriptor.auth.beginLogin()`.
      - If connected: button “Disconnect” → calls `descriptor.auth.logout()` and optionally clear that provider’s cache; confirm if needed.
    - **Active source selector:** When multiple providers are connected, one must be “active”. Use a control per row: “Use this source” / “Active” (e.g. radio or chip). Selecting a provider sets it as active and persists; the app then uses that provider for library and playback.
- **Dropbox:** Same structure (label “Dropbox”, Connect/Disconnect, status, “Use this source” when connected).
- **Single active provider:** When user selects “Use this source” for provider B while A was active, set active provider to B, persist, and update app state (e.g. clear or replace current queue, switch library to B). No full page reload.

### Persistence

- **Active provider:** `localStorage` key e.g. `vorbis-player-active-provider`, value `"spotify"` | `"dropbox"`. Default `"spotify"` if missing or invalid.
- **Do not persist** OAuth tokens in this flow; tokens stay in each provider’s auth implementation (e.g. existing `spotify_token`; future Dropbox token storage).

### Empty / error states

- **Not connected:** Show “Not connected” and “Connect” button.
- **Connecting:** After user taps Connect and redirects, on return show “Connecting…” until auth completes or errors.
- **Error:** After failed auth or API error, show “Error” and optional short message; “Retry” or “Connect” again.
- **No providers:** If registry is empty (shouldn’t happen in product), section can hide or show “No music sources available.”

## State and Context

- **Provider connection state:** Use the existing `ProviderContext` (from Spotify adapter migration plan):
  - `activeProviderId`, `setActiveProviderId` (persisted via `useLocalStorage` or equivalent).
  - For each provider: `isAuthenticated(providerId)` from `registry.get(providerId).auth.isAuthenticated()`; optional `connectionError(providerId)` for displaying errors.
- **Do not** add provider state into `VisualEffectsContext`; keep that for visual/UI toggles only.

## Implementation Steps

### Step 1: Persist active provider

- Ensure `ProviderContext` (or equivalent) persists `activeProviderId` to `localStorage` (`vorbis-player-active-provider`) and restores on load. Default to `"spotify"` when key is missing or invalid.

### Step 2: Add Music sources section to the drawer

- In the component that renders the gear-opened drawer (e.g. the same tree that renders `VisualEffectsMenu` or the parent that composes it), add a **Music sources** section at the top of the drawer content.
- Data: from `useProviderContext()` (or equivalent), get `registry.getAll()` and `activeProviderId` / `setActiveProviderId`. For each descriptor:
  - `isConnected = descriptor.auth.isAuthenticated()`
  - Status text and Connect/Disconnect from `isConnected` and optional error state.
  - “Use this source” only when `isConnected`; when clicked, call `setActiveProviderId(descriptor.id)` and persist.
- Use existing drawer styling (e.g. `FilterSection`, `SectionTitle`, `ControlGroup`, `ControlLabel`, `OptionButton` / `ResetButton` from Visual Effects menu) for consistency.

### Step 3: Connect / Disconnect actions

- **Connect:** Call `descriptor.auth.beginLogin()`. For Spotify this redirects; for Dropbox same idea. After redirect, the auth callback (handled in `App.tsx` or adapter) will set token state; on next render, `isAuthenticated()` will be true and status will show “Connected”.
- **Disconnect:** Call `descriptor.auth.logout()`. Optionally clear that provider’s cached library data (e.g. for Spotify clear IndexedDB for Spotify keys; for Dropbox clear Dropbox cache). If the disconnected provider was active, switch active provider to another connected one, or to a default (e.g. `spotify`) and show “Select a source” until user picks one.

### Step 4: Switching active provider

- When user selects “Use this source” for a different provider:
  - Update `activeProviderId` and persist.
  - Notify the rest of the app (library + playback) to use the new provider: clear or replace current queue, reload library for the new provider, and update any “selected collection” state so the library view reflects the new source. No full page reload.

## File-Level Summary

| Action   | File(s) |
|----------|---------|
| Add / extend | `ProviderContext` (or equivalent): ensure active provider is read/written from/to `localStorage`. |
| Refactor | Component that renders the gear-opened drawer: add **Music sources** section at top; consume `ProviderContext` and registry. |
| Optional | Small helper hook e.g. `useProviderConnectionStatus(providerId)` that returns `{ isConnected, error, connect, disconnect }` for cleaner UI code. |

## Acceptance Criteria

- [ ] Music sources section appears at the top of the app settings (gear) drawer.
- [ ] Each registered provider (Spotify, and Dropbox when implemented) shows label, status (Not connected / Connecting / Connected / Error), and Connect or Disconnect.
- [ ] User can set one provider as “active”; only that provider’s library and playback are used.
- [ ] Active provider choice is persisted and restored on reload.
- [ ] Switching active provider updates library and playback without full reload.
- [ ] Disconnecting the active provider switches to another connected provider or prompts user to connect/select.

## Dependencies

- Provider registry and descriptors (Spotify adapter) must be in place.
- `ProviderContext` (or equivalent) must expose `activeProviderId`, `setActiveProviderId`, and registry.
- Auth callbacks for each provider must be handled in app bootstrap so that “Connected” reflects after OAuth redirect.
