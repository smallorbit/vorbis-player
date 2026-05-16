## Why

The settings UI currently exposes a third provider status — "Reconnect needed" (`isEnabled && !isConnected`) — as a separate visual and interaction affordance:

- `src/components/AppSettingsMenu/SourcesSections.tsx` renders a "Reconnect needed" status badge and branches the switch's `onCheckedChange` to a dedicated `handleReconnect` flow.
- `src/components/AudioPlayer.tsx` surfaces a persistent reconnect-action toast via `acceptReconnectPrompt`.
- `src/contexts/ProviderContext.tsx` manages `reconnectPrompt` state and exposes `acceptReconnectPrompt` / `dismissReconnectPrompt`.

This third state violates `openspec/specs/auth-system/spec.md` Requirement 2 (Single On-Off Toggle per Provider): "Each provider SHALL be controlled by a single on/off toggle in settings. There SHALL be no separate reconnect affordance."

It also creates a real user-visible bug (reported May 16 2026): when Spotify's access token is cleared mid-playback in a dual-provider session, the Spotify toggle stays ON with the "Reconnect needed" badge instead of toggling OFF. The user has to flip it off and back on to trigger the OAuth flow — exactly the sort of "third state" the spec already forbids.

## What Changes

- When a `SESSION_EXPIRED_EVENT` fires for a provider, `ProviderContext` SHALL fully toggle that provider OFF (remove it from `enabledProviderIds`) in addition to dispatching the existing disconnect toast.
- Remove the "Reconnect needed" status badge, the `handleReconnect` branch on the toggle, the `needsReconnect` flag, and the "Reconnect <name>" aria-label from `SourcesSections.tsx`. Status simplifies to `'connected' | 'disabled'`.
- Remove `reconnectPrompt` state, `acceptReconnectPrompt`, `dismissReconnectPrompt` from `ProviderContext` and `ProviderContextValue`.
- Remove the reconnect-action toast from `AudioPlayer.tsx` and the `RECONNECT_TOAST_ID` constant. Drop the `|| reconnectPrompt` gate on the disconnect-toast effect.
- Update the auto-fallthrough notification copy from "Reconnect in Settings." to "Re-enable in Settings." (the provider is no longer in a special "reconnect" state — it's plainly off).
- Re-enabling is the standard Requirement 2 scenario: toggling the provider back ON while not authenticated kicks off OAuth — no special path required.

No changes to provider auth adapters (`spotify`, `dropbox`), no changes to the `SESSION_EXPIRED_EVENT` dispatch itself, no changes to `useQueueManagement` or `useProviderPlayback`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `auth-system`: Requirement 2 clarifies that session expiry MUST toggle the provider off (no separate reconnect state). Requirement 6 clarifies that the session-expired notification is informational only — no action button.

## Impact

- `src/contexts/ProviderContext.tsx` — `handleSessionExpired` toggles the provider off via a ref pattern; `reconnectPrompt` state + accept/dismiss callbacks deleted; fallthrough copy updated.
- `src/components/AppSettingsMenu/SourcesSections.tsx` — `handleReconnect`, `needsReconnect`, the `'reconnect'` status branch, and the `Reconnect <name>` aria-label all removed.
- `src/components/AppSettingsMenu/styled.ts` — `ProviderStatusBadge` `$status` union narrowed to `'connected' | 'disabled'`; reconnect color branch removed.
- `src/components/AudioPlayer.tsx` — reconnect-toast effect + `RECONNECT_TOAST_ID` deleted; disconnect-toast effect no longer gates on `reconnectPrompt`.
- `src/components/AppSettingsMenu/__tests__/SourcesSections.test.tsx` — token-expired tests replaced with an assertion that the toggle is unchecked when the provider is enabled-but-unauth (matches the new spec) and a baseline "no Reconnect button visible" assertion stays.
- `src/components/SettingsV2/sections/__tests__/SourcesSection.test.tsx` — stale "Reconnect needed" badge test deleted.
- `src/contexts/__tests__/ProviderContext.test.tsx` — new test asserting that a `SESSION_EXPIRED_EVENT` removes the provider id from `enabledProviderIds`.
