## Context

`MusicSourcesSection` in `src/components/AppSettingsMenu/SourcesSections.tsx` exposes a single on/off `Switch` per provider. Toggling off currently calls `setDisconnectDialogProviderId(descriptor.id)` unconditionally, which opens `ProviderDisconnectDialog` and waits for the user to confirm or cancel. The dialog computes `affectedQueueCount` by filtering `tracks` for the pending provider id; the dialog body already hides its destructive-warning bar when that count is zero, so an empty-queue prompt asks the user "Are you sure?" with no destructive consequence shown.

`handleConfirmDisconnect` performs the real work: pausing playback, removing the provider's tracks from `tracks` / `originalTracks`, fixing up `currentTrackIndex`, calling `descriptor.auth.logout()`, and finally `toggleProvider(id)`. Today it reads the target id from the dialog state (`disconnectDialogProviderId`).

## Goals / Non-Goals

**Goals**
- Skip the confirmation dialog when the toggled-off provider has zero tracks in the queue.
- Preserve current behavior when the provider has one or more tracks in the queue.
- Update `auth-system` Requirement 3 to make the empty-queue path explicit in the spec.

**Non-Goals**
- Changing the destructive-cleanup logic (track removal, index fix-up, logout). The same cleanup runs in both branches.
- Changing `ProviderDisconnectDialog.tsx`. Its warning-bar gating is already correct and stays.
- Changing the reconnect path or the first-time-login (toggle-on) path.
- Changing `descriptor.auth.logout()` semantics in Spotify or Dropbox adapters.
- Adding an "undo" affordance — the spec explicitly rejects confirmation when there is nothing destructive to confirm.

## Decisions

### Decision 1: Gate the dialog on `affectedQueueCount > 0` in the toggle handler

**What**: At toggle-off time, compute `tracks.filter(t => t.provider === descriptor.id).length`. If `> 0`, set `disconnectDialogProviderId` as today (opens the dialog). If `=== 0`, call the disconnect handler immediately with the provider id and skip the dialog.

**Why**: Cheap (O(n) over the queue, which is bounded). Keeps the dialog state machine intact — the dialog is only opened when there is real destructive cleanup to confirm. Aligns with the existing dialog body, which already hides its warning bar in the empty-queue case.

**Alternatives considered**:
- _Always show the dialog with a generic "Are you sure?" copy._ Rejected: doesn't reduce friction, and the spec explicitly describes confirmation as a guard against destructive queue cleanup, not as a generic logout barrier.
- _Move the gating into `ProviderDisconnectDialog` (auto-confirm on mount when count is 0)._ Rejected: violates the dialog's contract (it would still flash, would still emit `onConfirm` from inside the modal lifecycle). Cleaner to short-circuit at the call site.

### Decision 2: Generalize `handleConfirmDisconnect` to accept the provider id

**What**: Change `handleConfirmDisconnect` from a no-arg callback that reads `disconnectDialogProviderId` to a callback that accepts a `ProviderId` argument. The dialog's `onConfirm` wraps it as `() => handleConfirmDisconnect(disconnectDialogProviderId!)`, and the empty-queue branch calls `handleConfirmDisconnect(descriptor.id)` directly.

**Why**: Avoids round-tripping through React state (`setDisconnectDialogProviderId` → effect → handler) when we already know the id at the call site. Keeps the cleanup logic in one place.

**Alternatives considered**:
- _Set `disconnectDialogProviderId` then immediately call the existing no-arg handler._ Rejected: relies on closure-over-stale-state and either needs a `useEffect` (overcomplication) or a `flushSync` (premature optimization workaround). The id-as-argument approach is the obvious React pattern.

### Decision 3: Spec the empty-queue path explicitly under Requirement 3

**What**: Add a new scenario to Requirement 3: _"Toggle off with no queued tracks → the provider is logged out, removed from the enabled set, and no confirmation prompt is shown."_ Soften the requirement statement to make the gating explicit: _"Disconnecting a provider SHALL prompt the user **when its tracks are in the queue**, and on confirmation (or immediately when no tracks are affected) SHALL log the provider out…"_.

**Why**: The current Requirement 3 already implies the gating ("Disconnecting a provider SHALL prompt the user when its tracks are in the queue"), but only the queued-tracks scenario is documented. Adding the empty-queue scenario closes the gap so future implementations don't drift back to the unconditional-prompt behavior.

## Risks / Trade-offs

- **Risk**: A user expecting the existing prompt may be surprised when toggling off an empty-queue provider logs them out immediately. **Mitigation**: This is the documented behavior the spec was always written toward; the prompt's purpose is to guard against queue loss. Toggling back on requires reauth only when the token has also expired — usually it doesn't, so the user can flip back instantly.
- **Risk**: If a future feature adds destructive cleanup beyond queue tracks (e.g. clearing cached art, signing out of Spotify SDK), the gating-on-queue-count check stops being a proxy for "is there anything destructive to confirm?". **Mitigation**: When that arrives, broaden the gate to a `hasDestructiveCleanup(providerId)` predicate; the current change keeps the gate narrowly scoped to the only destructive consequence today.

## Migration Plan

Single-step change; no migrations or feature flags required. The behavior is opt-out from the user's perspective (it removes a prompt step), not opt-in.

## Open Questions

None.
