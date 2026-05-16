## Context

The "Reconnect needed" affordance grew up alongside the multi-provider toggle and the session-expired event flow (`SESSION_EXPIRED_EVENT`). When `useProviderRefresh` detects a terminal 401 it dispatches the event; `ProviderContext` reacts by setting a `reconnectPrompt` (drives a persistent action toast) and a `disconnectToast` (drives a short auto-dismiss toast), and bumping `authRevision` so `connectedProviderIds` recomputes. The provider stays in `enabledProviderIds`, so settings shows a "Reconnect needed" badge and the switch reroutes to a `handleReconnect` callback that opens the OAuth popup directly.

This three-state model — connected / reconnect / disabled — predates the current spec (Requirement 2 of `auth-system/spec.md`) which explicitly forbids a separate reconnect affordance. The standard "toggle on while not authenticated" flow already kicks off OAuth, so the dedicated reconnect path is redundant.

## Goals / Non-Goals

**Goals**
- Make session expiry yield a clean two-state UI: provider is either ON+authed ("Connected") or OFF.
- Preserve the informational session-expired toast.
- Re-enabling uses the existing "toggle on" → OAuth path.

**Non-Goals**
- Changing how `SESSION_EXPIRED_EVENT` is dispatched or which adapters dispatch it.
- Changing `descriptor.auth.logout()` semantics — the adapter already logs itself out when a terminal failure is detected; we are only altering the UI state that accompanies the existing flow.
- Touching `useQueueManagement` or `useProviderPlayback` — queue/playback fallthrough already works on `connectedProviderIds`, which the toggle-off updates correctly.

## Decisions

### Toggle off via ref pattern, not effect deps

The existing `SESSION_EXPIRED_EVENT` listener lives in a `useEffect` with `[]` deps so it attaches once and never re-binds. It must now flip the provider off, which depends on the latest `enabledProviderIds` and the underlying `setStoredEnabledIds` setter. Re-binding the listener on every state change would race the user's own toggle interactions and risk dropping events fired during a re-render.

Standard React pattern: keep a `latestRef` for each function or value the handler needs, update it in a separate `useEffect` on every render, and read `.current` inside the handler.

```ts
const setStoredEnabledIdsRef = useRef(setStoredEnabledIds);
const enabledProviderIdsRef = useRef(enabledProviderIds);
useEffect(() => { setStoredEnabledIdsRef.current = setStoredEnabledIds; }, [setStoredEnabledIds]);
useEffect(() => { enabledProviderIdsRef.current = enabledProviderIds; }, [enabledProviderIds]);
```

Inside `handleSessionExpired`, gate the write on `enabledProviderIdsRef.current.includes(providerId)` so we don't accidentally re-add a provider the user just turned off.

### Session-expired bypasses the "last enabled" guard

The user-facing `toggleProvider` action refuses to disable the last remaining enabled provider — it returns the current set unchanged when `current.length <= 1`. That guard exists to protect against accidental user-initiated zero-providers state (the picker would have nothing to pick from).

Session-expired must not honor that guard. If the sole enabled provider has its auth fail, leaving it enabled would resurrect exactly the forbidden third state the change is removing: enabled + unauthenticated, with no badge or affordance to telegraph what's wrong. So `handleSessionExpired` writes through `setStoredEnabledIds` directly with a custom updater that always removes the expired id, bypassing the guard. The user re-enables via the existing toggle, which kicks off OAuth.

`toggleProvider` retains its guard for the user-driven path; only the forced session-expired path bypasses it.

### Drop `RECONNECT_TOAST_ID` entirely

The reconnect toast was the only consumer of that ID; once the toast effect is gone, the constant is dead.

### Disconnect toast no longer waits for reconnect

The current `disconnectToast` effect guards on `if (!disconnectToast || reconnectPrompt) return` to avoid showing two toasts at once. With reconnect gone, the guard simplifies to `if (!disconnectToast) return`.

### Fallthrough copy

"Reconnect in Settings." was correct under the old model (the expired provider stayed enabled and showed a reconnect badge). Under the new model the provider is fully toggled off, so the user needs to re-enable it. "Re-enable in Settings." is the accurate instruction.

## Risks / Trade-offs

- A user who clears their Spotify token mid-playback will lose the in-toast "Reconnect" shortcut. They must open Settings to flip the toggle back on. This matches the spec and is consistent with the rest of the multi-provider toggle UX (no toast-driven reconnect for any other failure mode).
- Tests that pinned the old behavior need to be rewritten; one new test added at the context layer is enough to lock the new contract.

## Migration Plan

Single PR. No data migration — `enabledProviderIds` is a localStorage list and removing an id from it is the same shape as a user-driven toggle-off, which already round-trips cleanly. No deprecation notice needed (the affordance was internal UI).
