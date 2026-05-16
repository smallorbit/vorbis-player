## Context

Spotify's playback adapter sustains a "native queue" via the Web Playback SDK: each `playTrack` call passes an `upcomingUris` array so the SDK can auto-advance without an additional command round-trip. The adapter builds that array from a snapshot of the app queue captured at `onQueueChanged` time (`spotifyPlaybackAdapter.ts:339-341`) and consumes it inside the next `playTrack` (`:82-84`).

Today the only place that pushes a fresh snapshot is `useProviderPlayback.playTrack`, which calls `descriptor.playback.onQueueChanged?.(tracks, index)` immediately before invoking the adapter. That covers the track-transition case (handleNext / handlePrevious / hydrate / auto-advance / fresh collection load). It does **not** cover user-driven queue mutations that happen while a track is already playing: add-to-queue, remove-from-queue, reorder, insert-next, insert-collection-next, queue-direct. After any of those, the SDK keeps the previous upcoming list in mind and can auto-advance into the wrong tracks. The fix pushes the same notification from every mutator.

## Goals / Non-Goals

**Goals:**
- Every user-initiated queue mutation notifies the driving provider when it declares `hasNativeQueueSync`.
- One uniform call site inside `useQueueManagement.ts` (a `notifyQueueChanged` helper) so future mutators inherit the behavior by construction.
- Keep the existing pre-`playTrack` notification — track transitions still need it, and removing it would race with mutations that haven't yet observed the new index.
- Delete the stale comment that points to a non-existent `useEffect`.

**Non-Goals:**
- Notifying providers that have not opted in via `hasNativeQueueSync` (Dropbox, mock).
- Touching the Spotify adapter, Dropbox provider, or anything under `src/services/spotify/` — those areas are in flight in other PRs and the only change required here is on the consumer side.
- Adding a separate notification on every `currentTrackIndex` mutation outside of `useQueueManagement`. The existing `playTrack`-time call already covers index transitions; this change closes the queue-content gap.

## Decisions

**Resolve the descriptor through `getDrivingProviderDescriptor`, not `activeDescriptor`.**
The driving provider is the one actually producing audio and the one whose native queue must stay aligned with the app. `activeDescriptor` reflects the browsing context — for a cross-provider queue (e.g. a Dropbox library view while Spotify drives audio) those two diverge. The hook already gets `activeDescriptor` for catalog calls; we add a sibling `getDrivingProviderDescriptor` accessor and read the driving descriptor at notify time so the snapshot lands on the SDK that needs it.

**Read the driving descriptor lazily per call, not once per render.**
The driving provider can change mid-session (cross-provider handoff). Capturing the accessor (a stable callback) instead of a snapshot ensures every mutation sees the current driver.

**Inline `notifyQueueChanged` helper inside the hook.**
A four-line helper closes over `getDrivingProviderDescriptor` and the latest `tracksRef` / `currentTrackIndex`. Pulling it out into a utility would force passing those refs around. The function stays private to `useQueueManagement.ts` — no other consumer needs it.

**Notify with the post-mutation `tracks` and post-mutation `currentTrackIndex`.**
Mutators build the new array before calling state setters. We pass that local array (and the locally-computed `newCurrentIndex` for reorder, otherwise the existing `currentTrackIndex`) to the notifier rather than waiting for React to commit and re-render. This matches the existing `useProviderPlayback.ts:102` semantics, which also notifies before the playback adapter call.

**Keep the existing pre-`playTrack` notification at `useProviderPlayback.ts:102`.**
That call handles track-transition events that don't pass through `useQueueManagement.ts`: hydrate from session, handleNext/Previous, auto-advance, fresh-collection load at index 0. Removing it would re-open the regressions the comment near it (mistakenly) tries to explain. We delete the misleading prose; the line of code stays.

**Capability gate inside `notifyQueueChanged`, not at each call site.**
Centralizing the `hasNativeQueueSync` check inside the helper keeps mutators free of provider-system concerns and lets a future provider opt-in by flipping the capability without revisiting every mutator.

## Risks / Trade-offs

- **Risk:** Extra `onQueueChanged` calls increase Spotify adapter work on every mutation. **Mitigation:** the adapter's `onQueueChanged` is a pure map-and-slice over the queue array — no I/O, no allocation pressure beyond a fresh URI array. Cheaper than the `playTrack` it precedes.
- **Risk:** A mutation that ultimately bails (e.g. all dedup-filtered tracks rejected) notifies before bailing → notifier sees the pre-mutation queue, which is identical to the post-mutation queue. **Mitigation:** call `notifyQueueChanged` only after a mutation actually commits new state (i.e., past the dedup short-circuits). Each mutator already has a clean "commit point" where the new `tracks` array is in hand.
- **Trade-off:** Reorder notifies twice if the user drags a track between two positions in quick succession. Acceptable — each notification overwrites the previous `pendingUpcomingUris`, so the SDK ends up with the latest snapshot. No correctness issue.
