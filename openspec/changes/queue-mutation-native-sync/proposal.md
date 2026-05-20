## Why

`onQueueChanged` is invoked in exactly one place today — `src/hooks/useProviderPlayback.ts:102`, immediately before each `playTrack` call. Every user-initiated queue mutator in `src/hooks/useQueueManagement.ts` (add, remove, reorder, insert-next, insert-collection-next, queue-direct) skips the notification. Until the next `playTrack` fires, the Spotify SDK's "upcoming URIs" buffer (`pendingUpcomingUris`, consumed at adapter line 82-84) reflects a stale snapshot of the app queue, so the SDK's own auto-advance can play tracks that no longer match the user's reordered/cleared queue.

The behavior violates `openspec/specs/playback-engine/spec.md` Requirement 8 (Native Queue Sync), which says any provider declaring `hasNativeQueueSync` SHALL be notified when the app's queue or current index changes — not only at track-transition time.

The existing comment at `src/hooks/useProviderPlayback.ts:97-101` claims a "persistent useEffect-based onQueueChanged in usePlayerLogic" handles the steady-state case. No such effect exists, and the comment misdirects future readers.

## What Changes

- Push `onQueueChanged` notifications from every user-initiated queue mutator in `useQueueManagement.ts` (`handleAddToQueue`, `handleRemoveFromQueue`, `handleReorderQueue`, `insertTracksNext`, `queueTracksDirectly`, `insertCollectionNext`).
- Gate each call on the driving provider's `hasNativeQueueSync` capability; resolve the descriptor via the existing `getDrivingProviderDescriptor` accessor so cross-provider queues notify the actual audio-producing provider, not the currently-active-for-browsing one.
- Centralize the call site behind a small `notifyQueueChanged(tracks, currentTrackIndex)` helper inside the hook so every mutator routes through the same gate.
- Remove the stale comment at `useProviderPlayback.ts:97-101`. Keep the existing pre-`playTrack` notify at line 102 — it covers track-transition events not driven by `useQueueManagement.ts` (handleNext/handlePrevious, hydrate, auto-advance).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `playback-engine`: tightens Requirement 8 (Native Queue Sync) by enumerating the queue events that MUST trigger `onQueueChanged` (append, remove, reorder, insert-next, insert-collection-next, queue-direct, manual `playTrack` transitions) and clarifying that the notification follows the **driving** provider's capability flag, not the active provider's.

## Impact

- `src/hooks/useQueueManagement.ts` — accepts a `getDrivingProviderDescriptor` accessor in props; adds `notifyQueueChanged` helper; invokes it in every mutator.
- `src/hooks/usePlayerLogic.ts` — passes the existing `getDrivingProviderDescriptor` accessor into `useQueueManagement`.
- `src/hooks/useProviderPlayback.ts` — removes stale comment at lines 97-101 (the `onQueueChanged` call itself stays in place).
- `src/hooks/__tests__/useQueueManagement.test.ts` — adds coverage for the notify-on-mutation behavior and the capability gate.
- No public API change. No provider-adapter change. Performance: each notification is an O(remaining-queue) URI build inside the Spotify adapter, which is what the codebase already pays on every `playTrack`.
