## 1. Toggle-off gating

- [x] 1.1 In `src/components/AppSettingsMenu/SourcesSections.tsx`, generalize `handleConfirmDisconnect` to accept a `ProviderId` argument (drop the dependency on `disconnectDialogProviderId` inside the handler body; clear the dialog state at the top of the body only if it is set).
- [x] 1.2 In the `Switch` `onCheckedChange` toggle-off branch, compute `affectedQueueCount = tracks.filter(t => t.provider === descriptor.id).length`. If `> 0`, call `setDisconnectDialogProviderId(descriptor.id)` (existing behavior). If `=== 0`, call `handleConfirmDisconnect(descriptor.id)` directly and skip the dialog.
- [x] 1.3 Update the dialog's `onConfirm` prop to wrap the generalized handler: `onConfirm={() => disconnectDialogProviderId && handleConfirmDisconnect(disconnectDialogProviderId)}`.

## 2. Test coverage

- [x] 2.1 Add a Vitest case in `src/components/AppSettingsMenu/__tests__/SourcesSections.test.tsx` under the `toggle-off: disconnect dialog flow` describe block: "performs logout and toggleProvider immediately without opening the dialog when the provider has no queued tracks". The test seeds `mockTracks` with only the other provider's tracks, clicks the disable toggle for the empty-queue provider, and asserts both `descriptor.auth.logout` and `mockToggleProvider` were called, and that the dialog title text does not appear.
- [x] 2.2 Confirm the existing "opens ProviderDisconnectDialog when an enabled provider toggle is turned off" test still passes — that test seeds an empty queue today, so it will need to be reframed against a queue with at least one matching track to preserve its intent ("dialog opens when there is destructive cleanup to confirm"). Update the `#given` to add a matching track for that provider before clicking the toggle.
- [x] 2.3 Confirm "calls descriptor.auth.logout() and toggleProvider when dialog is confirmed" still passes — same reframing applies (give the disconnecting provider a track in `mockTracks` so the dialog path is exercised).
- [x] 2.4 Confirm "closes the dialog and leaves state unchanged when Cancel is clicked" still passes — same reframing.
- [x] 2.5 Confirm "shows affected-track count in disconnect dialog when provider has queued tracks" still passes unchanged (it already seeds a non-empty queue).

## 3. Verify

- [x] 3.1 Run `npx tsc -b --noEmit` — clean.
- [x] 3.2 Run `npm run test:run` — green.
- [x] 3.3 Run `npm run build` — clean.

## 4. Spec sync

- [x] 4.1 On archive, ensure `openspec/specs/auth-system/spec.md` Requirement 3 is updated from the change's delta: requirement statement softened to make the gating explicit, and the new "Toggle off with no queued tracks" scenario merged in.
