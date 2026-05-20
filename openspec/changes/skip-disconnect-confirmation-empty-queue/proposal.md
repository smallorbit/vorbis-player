## Why

The disconnect-confirmation dialog in `MusicSourcesSection` (`src/components/AppSettingsMenu/SourcesSections.tsx`) opens unconditionally when an enabled provider toggle is turned off, even when that provider has zero tracks in the queue. The dialog body in `src/components/ProviderDisconnectDialog.tsx` already gates the destructive-warning bar on `affectedQueueCount > 0`, so when the queue contribution is empty the user is asked "Are you sure?" without any destructive consequence to confirm.

This diverges from `openspec/specs/auth-system/spec.md` Requirement 3 (Disconnect Confirmation and Cleanup), whose scenarios only describe the path "WHEN the user toggles off a provider **whose tracks are in the queue** THEN a confirmation prompt is shown stating the provider name and the count of tracks that will be removed". The spec does not require a prompt when there is no destructive cleanup to confirm; the implementation prompts anyway.

Fixing the implementation is a one-line gate change, but the spec is currently silent on the empty-queue path. This change codifies the empty-queue behavior in the spec and aligns the implementation with it.

## What Changes

- In `SourcesSections.tsx`, compute `affectedQueueCount` for `descriptor.id` at the moment of toggle-off (currently it is only computed for the already-open dialog). If the count is zero, perform the logout + cleanup path directly without opening the confirmation dialog. If the count is greater than zero, keep the existing dialog-based flow.
- Modify `openspec/specs/auth-system/spec.md` Requirement 3 (Disconnect Confirmation and Cleanup) to document the empty-queue path: when toggling off a provider with no tracks in the queue, the provider is logged out and state is cleaned up immediately, without a confirmation prompt.

No public API changes. No change to `descriptor.auth.logout()` semantics or any provider implementation. No change to `ProviderDisconnectDialog.tsx` (its existing warning-bar gating remains correct). No change to other `AppSettingsMenu` sections or to the reconnect / first-time-login paths.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `auth-system`: Requirement 3 (Disconnect Confirmation and Cleanup) — clarifies that the confirmation prompt is gated on the presence of queued tracks for the disconnecting provider.

## Impact

- `src/components/AppSettingsMenu/SourcesSections.tsx` — toggle-off handler computes `affectedQueueCount` before deciding to open the dialog; existing `handleConfirmDisconnect` is generalized to accept the provider id directly so the empty-queue branch can call it without first setting dialog state.
- `src/components/AppSettingsMenu/__tests__/SourcesSections.test.tsx` — add a Vitest case asserting that toggling off a provider with an empty queue performs logout + `toggleProvider` immediately and does not open `ProviderDisconnectDialog`. Existing cases for the queued-tracks confirmation path remain unchanged.
- `openspec/specs/auth-system/spec.md` — Requirement 3 gains an "Toggle off with no queued tracks" scenario; existing scenarios are unchanged.
- No effect on `src/components/ProviderDisconnectDialog.tsx`.
- No effect on Spotify or Dropbox auth adapters (`logout()` semantics unchanged).
- No effect on Playwright snapshots or visual capture.
