# PRD: Provider Toggles & Session Start Flow

## Introduction/Overview

Improve the provider management experience with two related changes: (1) replace the current provider toggle buttons in the settings menu with the same switch-style toggles used for Glow/Visualizer/Translucent in the visual effects flip menu, and (2) redesign the session start flow to intelligently handle first-time users, returning users with valid sessions, and returning users with one or more expired provider connections.

Currently the `MusicSourcesSection` in the settings drawer uses pill-shaped `ProviderButton` components with status dots. The visual effects menu uses `SwitchTrack`/`SwitchKnob` styled components — proper iOS-style toggle switches — which are more intuitive for on/off states. The provider toggles should use this same switch component.

The session start flow currently has two modes: a welcome screen (first visit) and a reconnect screen (expired session). This PRD improves both and adds handling for partial expiry (some providers valid, some expired).

## Goals

1. Extract `SwitchTrack`/`SwitchKnob` into a shared, reusable `Switch` component.
2. Replace the `MusicSourcesSection` provider buttons with the shared switch toggles, showing connection status alongside each toggle.
3. First-time users see a welcome screen with provider cards that include switch toggles and a "Connect" action, letting them enable and authenticate multiple providers before proceeding.
4. Returning users with all tokens valid skip straight to the player with no interruption.
5. Returning users with a single expired provider (but another valid provider available) auto-fall-through to the valid provider, with a non-blocking notification that the other provider needs reconnecting.
6. Returning users with all providers expired see a connection status screen listing each provider's state with reconnect actions.
7. Separate the concepts of "enabled" (user wants this source in their library) from "connected" (OAuth token is valid), so enabling a provider persists across token expiry.

## User Stories

- As a first-time user, I want to see which music providers are available and connect to one or more so I can start listening.
- As a returning user with a valid session, I want to go straight to my music without any setup screens.
- As a returning user with an expired Spotify token but a valid Dropbox token, I want to seamlessly continue listening via Dropbox while being told I can reconnect Spotify when convenient.
- As a returning user with all provider tokens expired, I want to see which providers I had enabled and reconnect them easily.
- As a user managing multiple providers, I want toggle switches (not buttons) in the settings menu so it's visually clear which providers are on or off.

## Functional Requirements

### Shared Switch Component

1. Extract `SwitchTrack` and `SwitchKnob` from `QuickEffectsRow.tsx` into a new shared component at `src/components/controls/Switch.tsx`.
2. The component should accept: `on: boolean`, `onToggle: () => void`, `ariaLabel: string`, and optionally `disabled: boolean`.
3. When `disabled` is true, the switch should appear dimmed and not respond to clicks.
4. Preserve the existing styling: 36×20px track, 16×16px knob, accent color when on, `rgba(255,255,255,0.15)` when off, 0.2s ease transitions, `role="switch"`, `aria-checked`.
5. Update `QuickEffectsRow.tsx` to import and use the shared `Switch` component instead of its inline styled components.

### Settings Menu Provider Toggles

6. Replace the `ProviderButton` pill-style toggles in `MusicSourcesSection` with rows containing: provider name, connection status indicator, and the shared `Switch` component.
7. The switch controls "enabled/disabled" (whether the provider's catalog is included in the library). Connection status is shown separately as a label or badge.
8. When a provider is enabled but not connected, show a "Reconnect" or "Connect" action next to the switch.
9. Clicking the reconnect/connect action initiates the OAuth flow for that provider.
10. The switch toggle itself only controls the enabled state — it does not trigger OAuth. This separates "I want this provider" from "I need to authenticate."
11. Prevent disabling the last enabled provider (existing behavior, preserved).

### First-Time User Welcome Screen

12. When `chosenProviderId` is null and no provider is authenticated, show the welcome screen (existing `ProviderSetupScreen` first-visit branch).
13. Replace the current `ProviderCard` click-to-authenticate interaction with a two-part UI per provider: a `Switch` toggle for enabling, and a "Connect" button for authentication.
14. Once at least one provider is connected, show a "Continue" button that sets the first authenticated provider as active and dismisses the setup screen.
15. If only one provider is registered, simplify: show just that provider's card with a "Connect" button (no toggle needed since there's nothing to toggle between).

### Returning User — Partial Expiry (Auto-Fallthrough)

16. When the active provider's token is expired but at least one other enabled provider is still authenticated, automatically switch `activeProviderId` to the first valid enabled provider.
17. Show a transient, non-blocking notification (toast or banner) informing the user: "{Provider} session expired — switched to {OtherProvider}. Reconnect in Settings."
18. The notification should be dismissible and not block playback.
19. The expired provider remains "enabled" in `enabledProviderIds` so that its position is preserved for when the user reconnects.

### Returning User — All Providers Expired

20. When all enabled providers have expired tokens, show a connection status screen (replaces the current single-provider "Reconnect" screen).
21. List each previously-enabled provider with: provider icon/name, connection status ("Expired" / "Disconnected"), and a "Reconnect" button.
22. Each reconnect button initiates the OAuth flow for that specific provider.
23. Once any provider successfully reconnects, automatically transition to the player with that provider active.
24. If the user had multiple providers enabled previously, the other expired providers remain enabled so they can reconnect them later from Settings.

### State Model Changes

25. Ensure `enabledProviderIds` persists in localStorage independently of authentication state. A provider can be "enabled but disconnected."
26. Add a derived state or helper: `connectedProviderIds` — the subset of `enabledProviderIds` whose `auth.isAuthenticated()` returns true.
27. The `needsSetup` logic in `AudioPlayer.tsx` should use `connectedProviderIds` (not just `enabledProviderIds`) to determine whether to show the setup/reconnect screen vs. the player.

## Non-Goals (Out of Scope)

- Automatic token refresh retry with backoff on the setup screen (providers already handle this internally).
- Provider ordering/priority preferences (always uses first registered order).
- Onboarding tutorial or walkthrough beyond the welcome screen.
- Provider-specific settings on the welcome screen (e.g., Spotify quality, Dropbox folder selection).
- Changing the visual effects menu's own use of the switch component beyond extracting it to a shared module.

## Design Considerations

- **Switch component**: Identical appearance to the Glow/Visualizer/Translucent toggles — `var(--accent-color)` when on, semi-transparent white when off, white knob, 0.2s transitions.
- **Provider rows in settings**: Horizontal layout — provider name on the left, connection status in the middle, switch on the right. Similar to how `SectionHeader` in `QuickEffectsRow` lays out "Glow" + switch.
- **Connection status colors**: Green for connected (existing `theme.colors.success`), orange/amber for expired/needs reconnect, gray for disabled.
- **Toast/notification for auto-fallthrough**: Minimal, non-intrusive. Could use a small banner at the top of the player or a temporary toast that auto-dismisses after 5 seconds.
- **Welcome screen**: Keep the existing card-based layout (`SetupCard`) but add switch toggles within each provider card. The "Connect" button per provider replaces clicking the entire card.
- **All-expired screen**: Similar layout to the welcome screen but with "Reconnect" instead of "Connect" and status badges showing "Expired."

## Technical Considerations

- **Shared component extraction**: `SwitchTrack` and `SwitchKnob` are currently defined as styled-components inside `QuickEffectsRow.tsx` (lines 121–144). Extract to `src/components/controls/Switch.tsx` as a single `Switch` component that renders both internally.
- **ProviderContext changes**: The `needsProviderSelection` and `needsSetup` logic needs updating to account for the new enabled-but-disconnected state. Currently `needsSetup` checks `isAuthenticated()` — it needs to also consider auto-fallthrough to another provider.
- **Auto-fallthrough in ProviderContext**: Add logic in `ProviderContext.tsx` that, when the active provider loses auth, checks `enabledProviderIds` for another authenticated provider and switches automatically. This should happen as a `useEffect` reacting to auth state changes.
- **Toast infrastructure**: The app currently doesn't have a toast/notification system. Options: (a) lightweight custom component with CSS animation and auto-dismiss, (b) a simple state in `AudioPlayer` that renders a temporary banner. Keep it minimal — no need for a full toast library.
- **Backward compatibility**: Existing localStorage keys (`vorbis-player-active-provider`, `vorbis-player-enabled-providers`) should continue to work. The only change is that `enabledProviderIds` no longer gets cleared when a token expires.

## Success Metrics

- First-time users can connect one or more providers and reach the player.
- Returning users with valid tokens see no setup screen.
- When one provider expires but another is valid, the user is not blocked — music continues playing from the valid provider with a notification.
- When all providers expire, the user sees all their previously-enabled providers and can reconnect any of them.
- Switch toggles in settings visually match the visual effects menu toggles.
- No regressions in single-provider mode (only one provider registered).

## Decisions (Resolved)

1. **Auto-fallthrough notification**: Auto-dismissing toast (5 seconds) with a "Reconnect" link that opens Settings. Non-blocking, minimal UI footprint.

2. **Single-provider welcome screen**: Keep the welcome screen for first-time users even with one provider — it sets expectations. The "Connect" button should be prominent and primary.

3. **Default provider enable state**: All registered providers start enabled by default on first visit. Users can disable any they don't want from Settings after setup.
