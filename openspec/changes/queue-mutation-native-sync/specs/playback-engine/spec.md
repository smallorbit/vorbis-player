## MODIFIED Requirements

### Requirement: Native Queue Sync

A provider that declares a native-queue-sync capability SHALL be notified when the app's queue or current index changes, so the provider can keep its native queue aligned with the app. The notification SHALL be dispatched on every queue mutation that updates the app's tracks array or current index — specifically: appending tracks via add-to-queue, removing a track, reordering tracks, inserting tracks at the play-next slot, inserting a collection at the play-next slot, queueing tracks directly, and the implicit current-index change at every track transition (next, previous, hydrate-resume, auto-advance, fresh-collection load). The notification SHALL target the **driving** provider (the provider currently producing audio), not the active-for-browsing provider; for a cross-provider queue these two MAY differ.

#### Scenario: App queue changes while a native-sync provider is driving
- **WHEN** the app's queue or current-track index changes and the driving provider declares the native-queue-sync capability
- **THEN** the provider is notified of the new queue and current index

#### Scenario: Provider without native-sync capability
- **WHEN** the app's queue changes and the driving provider does not declare native-queue-sync
- **THEN** no native-sync notification is dispatched

#### Scenario: Tracks appended via add-to-queue
- **WHEN** the user adds a collection to a non-empty queue and the driving provider declares native-queue-sync
- **THEN** the provider is notified with the post-append tracks array and the unchanged current-track index

#### Scenario: Track removed from queue
- **WHEN** the user removes a track from the queue and the driving provider declares native-queue-sync
- **THEN** the provider is notified with the post-removal tracks array and the adjusted current-track index

#### Scenario: Queue reordered
- **WHEN** the user reorders the queue and the driving provider declares native-queue-sync
- **THEN** the provider is notified with the post-reorder tracks array and the current-track index recomputed to follow the still-playing track

#### Scenario: Tracks inserted at the play-next slot
- **WHEN** the user inserts tracks at `currentTrackIndex + 1` (insert-next or insert-collection-next) and the driving provider declares native-queue-sync
- **THEN** the provider is notified with the post-insert tracks array and the unchanged current-track index

#### Scenario: Tracks queued directly
- **WHEN** the user queues tracks directly into the app queue and the driving provider declares native-queue-sync
- **THEN** the provider is notified with the post-append tracks array and the unchanged current-track index

#### Scenario: Mutation bails without changing state
- **WHEN** a mutator short-circuits before committing new state (empty input, dedup-empty, out-of-range index, removing the currently-playing track)
- **THEN** no native-sync notification is dispatched

#### Scenario: Track transition fires before adapter playback
- **WHEN** the engine calls `playTrack` to start a new track on a driving provider that declares native-queue-sync
- **THEN** the provider is notified with the current tracks array and the new index before the adapter's playback call
