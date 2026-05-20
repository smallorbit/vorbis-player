## 1. Implementation

- [x] 1.1 In `src/contexts/ProviderContext.tsx`, add `toggleProviderRef` and `enabledProviderIdsRef` and keep them current via per-deps `useEffect`s.
- [x] 1.2 In `handleSessionExpired`, after dispatching `disconnectToast` and bumping `authRevision`, if `enabledProviderIdsRef.current.includes(providerId)` call `toggleProviderRef.current(providerId)`.
- [x] 1.3 Delete `reconnectPrompt` state, `setReconnectPrompt`, `dismissReconnectPrompt`, `acceptReconnectPrompt`, and their entries on `ProviderContextValue` + the memoized context value.
- [x] 1.4 Change the fallthrough notification copy from "Reconnect in Settings." to "Re-enable in Settings.".
- [x] 1.5 In `src/components/AudioPlayer.tsx`, drop `reconnectPrompt`, `acceptReconnectPrompt`, `dismissReconnectPrompt` from the `useProviderContext()` destructure; delete the reconnect-toast `useEffect`; delete `RECONNECT_TOAST_ID`; remove the `|| reconnectPrompt` guard on the disconnect-toast effect.
- [x] 1.6 In `src/components/AppSettingsMenu/SourcesSections.tsx`, remove `handleReconnect`, `needsReconnect`, the `'reconnect'` status branch, and the `Reconnect <name>` aria-label. Simplify `onCheckedChange` to two branches: `if (!isEnabled) handleToggleOn; else setDisconnectDialogProviderId`.
- [x] 1.7 Narrow `ProviderStatusBadge` `$status` union to `'connected' | 'disabled'` in `src/components/AppSettingsMenu/styled.ts` and drop the reconnect color branch.

## 2. Tests

- [x] 2.1 Replace the `'token-expired reconnect flow'` test block in `src/components/AppSettingsMenu/__tests__/SourcesSections.test.tsx` with assertions that match the new behavior (toggle is unchecked when the provider is enabled-but-unauth after a SESSION_EXPIRED_EVENT propagates; no `"Reconnect needed"` text in DOM).
- [x] 2.2 Remove the stale `"Reconnect needed" badge` test from `src/components/SettingsV2/sections/__tests__/SourcesSection.test.tsx`.
- [x] 2.3 Add `src/contexts/__tests__/ProviderContext.test.tsx` asserting that dispatching `SESSION_EXPIRED_EVENT` removes the provider id from `enabledProviderIds`.

## 3. Verify

- [x] 3.1 `npx tsc -b --noEmit` clean.
- [x] 3.2 `npm run test:run` green.
- [x] 3.3 `npm run build` green.
- [x] 3.4 `grep -rn "reconnectPrompt\|acceptReconnectPrompt\|dismissReconnectPrompt\|handleReconnect\|'Reconnect needed'\|needsReconnect\|Tap to reconnect" src/` returns no production-code hits.
