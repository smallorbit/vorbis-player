# PRD: Provider Setup UX Improvements

## Introduction/Overview

Users who are authenticated with one provider but not the other face a friction-heavy flow when trying to set up their second provider. Currently, they must pick a track and start playback before they can access the settings menu where provider management lives. Additionally, the OAuth flow navigates away from the app entirely, losing the user's context.

This PRD covers three interconnected improvements: making provider management accessible earlier in the user journey, surfacing provider controls in the library view, and moving OAuth authentication to a popup/new-tab flow so users never leave their current screen.

## Goals

1. Allow users to manage providers (connect, enable/disable) from the setup screen and library drawer — before committing to playback.
2. Add inline provider toggle controls to the library drawer for quick access.
3. Move OAuth authentication to a new-tab/popup flow so the original tab remains intact.
4. Support mid-playback provider addition — music continues while the user authenticates a second provider in another tab.
5. Silently fall back to same-tab redirect when popup is blocked (mobile Safari, etc.).

## User Stories

- **As a user on the setup screen**, I want to open settings or browse my library so I can configure my second provider without having to start playing music first.
- **As a user browsing my library**, I want to see which providers are active and toggle them on/off inline so I don't have to navigate to a separate settings screen.
- **As a user connecting a new provider**, I want the OAuth flow to open in a new tab so I don't lose my place in the app.
- **As a user listening to music**, I want to connect a second provider without interrupting playback.
- **As a mobile user**, I want the auth flow to work seamlessly even if my browser blocks popups.

## Functional Requirements

### FR1: Setup Screen Enhancements
1.1. Add a gear/settings icon to the `ProviderSetupScreen` that opens the existing settings menu (VisualEffectsMenu).
1.2. Add a "Browse Library" button/link that opens the library drawer from the setup screen, allowing users to explore available content before choosing to play.
1.3. Both actions should be available when at least one provider is authenticated.

### FR2: Library Drawer Provider Controls
2.1. Add a provider filter/config bar at the top of the library drawer.
2.2. Each registered provider shows its name, connection status (connected/expired/disabled), and a toggle switch.
2.3. Unauthenticated providers show a "Connect" button that triggers the popup auth flow.
2.4. Expired providers show a "Reconnect" button.
2.5. The control bar should be collapsible or unobtrusive so it doesn't dominate the library view.

### FR3: Popup/New-Tab OAuth Flow
3.1. `beginLogin()` on each auth adapter must support opening the OAuth URL via `window.open()` instead of `window.location.href`.
3.2. The callback handler (`/auth/<provider>/callback`) must detect when it's running in a popup/child tab:
  - Complete the token exchange as normal.
  - Send a `postMessage` to `window.opener` with `{ type: 'vorbis-auth-complete', provider: '<id>' }`.
  - Display a brief "Authentication complete" message.
  - Call `window.close()` to close the popup tab.
3.3. The originating tab must listen for the `postMessage` event, validate the origin, and refresh its provider auth state.
3.4. PKCE verifiers are already in `localStorage` (shared across same-origin tabs), so no changes needed for the token exchange itself.

### FR4: Silent Popup Fallback
4.1. If `window.open()` returns `null` (blocked by browser), silently fall back to the current `window.location.href` redirect behavior.
4.2. No user-facing message needed for the fallback — it should be seamless.

### FR5: Mid-Playback Provider Addition
5.1. The popup auth flow (FR3) naturally supports this — music continues in the original tab while auth happens in another.
5.2. When the `postMessage` is received during active playback, update the provider state and library without interrupting the current track.
5.3. The settings menu and library drawer provider controls should be fully functional during playback (they already are for toggles; this extends to the new "Connect" buttons triggering popup auth).

## Non-Goals (Out of Scope)

- Changing the visual design of the setup screen beyond adding the new controls.
- Multi-window audio playback (only one tab plays audio).
- Provider-specific onboarding tutorials or walkthroughs.
- Changing the token refresh or auto-fallthrough logic.

## Design Considerations

- The gear icon on the setup screen should be subtle (top-right corner or near the title) — the setup card's primary purpose remains connecting providers.
- The library drawer provider bar should use the same `ProviderCardContainer` styling patterns from the setup screen for visual consistency.
- The popup auth "complete" screen should be minimal — just a checkmark and "You can close this tab" message, auto-closing after a short delay.
- Provider controls in the library should be compact — think a horizontal row of provider chips/pills with status indicators and toggles, not full cards.

## Technical Considerations

- **PKCE compatibility**: Both Spotify and Dropbox store PKCE verifiers in `localStorage`, which is shared across same-origin tabs. The popup tab can complete the token exchange using the verifier stored by the original tab.
- **`window.opener` security**: Validate `event.origin` matches `window.location.origin` before trusting `postMessage` data.
- **Spotify `beginLogin`**: Currently lives in `SpotifyAuthAdapter.beginLogin()` which calls `spotifyAuth.redirectToAuth()`. Need to thread the popup option through.
- **Dropbox `beginLogin`**: Lives in `DropboxAuthAdapter.beginLogin()`. Same pattern — thread popup option.
- **Callback detection**: In `App.tsx`, the callback handler needs to check `window.opener` to decide whether to `postMessage` + close vs. the current `replaceState` behavior.
- **State refresh**: After receiving `postMessage`, the original tab needs to trigger a re-render. Since auth state is in `localStorage` and checked via `isAuthenticated()`, a simple state toggle or event dispatch should suffice.
- **Mobile Safari**: `window.open` may be blocked even on user gesture in some contexts. The fallback (FR4) handles this.

## Success Metrics

- Users can connect a second provider without leaving the setup screen or interrupting playback.
- Zero regression in the existing single-provider auth flow.
- Popup auth works on desktop browsers (Chrome, Firefox, Safari, Edge).
- Fallback redirect works transparently on mobile when popups are blocked.

## Open Questions

- Should the library drawer auto-refresh its collection list when a new provider is connected via popup, or require a manual refresh?
- Should the "Browse Library" option on the setup screen show content from all authenticated providers, or only the currently-selected one?
