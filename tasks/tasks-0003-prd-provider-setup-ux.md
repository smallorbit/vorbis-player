## Relevant Files

- `src/types/providers.ts` - AuthProvider interface — add `beginLogin(options?)` signature with popup support
- `src/services/spotify.ts` - SpotifyAuth class — add `getAuthUrl()` public access and popup support to `redirectToAuth()`
- `src/providers/spotify/spotifyAuthAdapter.ts` - SpotifyAuthAdapter — update `beginLogin()` to support popup mode
- `src/providers/dropbox/dropboxAuthAdapter.ts` - DropboxAuthAdapter — update `beginLogin()` to support popup mode, handle sessionStorage CSRF state across tabs
- `src/App.tsx` - Callback handler — detect popup context, postMessage to opener, auto-close
- `src/hooks/usePopupAuth.ts` - New hook for managing popup auth lifecycle and message listening
- `src/components/ProviderSetupScreen.tsx` - Add gear icon and "Browse Library" button
- `src/components/LibraryDrawer.tsx` - Add provider bar at top of drawer
- `src/components/LibraryProviderBar.tsx` - New component: compact inline provider controls for library drawer
- `src/components/AuthCallbackPage.tsx` - New component: "Authentication complete" landing for popup tab
- `src/components/VisualEffectsMenu/index.tsx` - Update MusicSourcesSection to use popup auth for Connect/Reconnect
- `src/contexts/ProviderContext.tsx` - Add `refreshAuthState()` method and auth-complete event handling
- `src/components/AudioPlayer.tsx` - Wire up settings/library access from setup screen

### Notes

- PKCE verifiers are in localStorage (shared across tabs), so the popup tab can complete token exchange without changes.
- Dropbox stores CSRF state in sessionStorage (NOT shared across tabs) — need to move to localStorage or pass via postMessage.
- Unit tests should be colocated in `__tests__/` subdirectories.
- Use `npm run test:run` to run tests.

## Tasks

- [ ] 1.0 Popup/New-Tab OAuth Infrastructure
  - [ ] 1.1 Update `AuthProvider` interface in `src/types/providers.ts` to accept optional `{ popup?: boolean }` in `beginLogin()`
  - [ ] 1.2 Add `getAuthUrl()` public method to `SpotifyAuth` in `src/services/spotify.ts` (it's currently public, just ensure it returns the URL string)
  - [ ] 1.3 Update `SpotifyAuthAdapter.beginLogin()` to accept popup option — use `window.open()` when popup is true, fall back to redirect if blocked
  - [ ] 1.4 Update `DropboxAuthAdapter.beginLogin()` to accept popup option — move CSRF state from sessionStorage to localStorage so the popup tab can access it, use `window.open()` when popup is true
  - [ ] 1.5 Create `src/components/AuthCallbackPage.tsx` — a minimal "Authentication complete" UI that shows when running in a popup context
  - [ ] 1.6 Update `App.tsx` callback handler to detect popup context (`window.opener`), postMessage auth result to opener, render `AuthCallbackPage`, and auto-close after brief delay
  - [ ] 1.7 Create `src/hooks/usePopupAuth.ts` — hook that listens for `postMessage` events from popup tabs, validates origin, and triggers auth state refresh

- [ ] 2.0 Auth State Refresh After Popup Completion
  - [ ] 2.1 Add a `refreshAuthState()` method or event-driven re-check to `ProviderContext` that re-evaluates `isAuthenticated()` for all providers
  - [ ] 2.2 Wire `usePopupAuth` into `ProviderContext` (or a top-level component) so popup completions trigger state refresh
  - [ ] 2.3 Ensure the library auto-refreshes collections when a new provider becomes connected (dispatch `LIBRARY_REFRESH_EVENT`)

- [ ] 3.0 Setup Screen Enhancements
  - [ ] 3.1 Add a gear/settings icon button to `ProviderSetupScreen` (top-right of the setup card) that opens the settings drawer
  - [ ] 3.2 Add a "Browse Library" button to `ProviderSetupScreen` (shown when at least one provider is authenticated) that opens the library drawer
  - [ ] 3.3 Update `AudioPlayer.tsx` to pass settings/library open handlers down to `ProviderSetupScreen` (or use context/callbacks)
  - [ ] 3.4 Update `ProviderSetupScreen` Connect buttons to use popup auth flow

- [ ] 4.0 Library Drawer Provider Controls
  - [ ] 4.1 Create `src/components/LibraryProviderBar.tsx` — compact horizontal bar with provider chips showing name, status badge, toggle, and connect button
  - [ ] 4.2 Integrate `LibraryProviderBar` at the top of `LibraryDrawer` (between header and content)
  - [ ] 4.3 Wire connect/reconnect buttons in `LibraryProviderBar` to use popup auth flow via `usePopupAuth`
  - [ ] 4.4 Only render the provider bar when 2+ providers are registered

- [ ] 5.0 Update Existing Settings Menu
  - [ ] 5.1 Update `MusicSourcesSection` Reconnect button and any future Connect buttons to use popup auth
  - [ ] 5.2 Ensure settings menu works correctly when opened from the setup screen (before any provider is active for playback)

- [ ] 6.0 Testing
  - [ ] 6.1 Add tests for `usePopupAuth` hook — message handling, origin validation, cleanup
  - [ ] 6.2 Add tests for popup fallback behavior in auth adapters
  - [ ] 6.3 Add tests for `AuthCallbackPage` component
  - [ ] 6.4 Add tests for `LibraryProviderBar` component
  - [ ] 6.5 Add tests for setup screen new controls (gear icon, browse library button)
  - [ ] 6.6 Run full test suite to verify no regressions
