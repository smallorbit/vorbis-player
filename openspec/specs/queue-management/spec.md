# queue-management Specification

## Purpose

Vorbis Player SHALL maintain an ordered queue of provider-neutral tracks that can be loaded from a collection, appended to, reordered, and pruned — preserving the user's place in playback throughout — and SHALL support a shuffle mode that can be toggled without losing the original ordering.

## Requirements

### Requirement: Loading a Collection

Loading a collection SHALL replace the queue with the collection's tracks, reset the current-track index to the start, and begin playback from the first track. When a new load begins before an earlier one completes, the newest load SHALL win: the superseded load SHALL be cancelled and SHALL NOT alter the queue, playback, or the active provider.

#### Scenario: Loading a collection with tracks

- **WHEN** the user loads a collection
- **THEN** the queue is replaced by the collection's tracks
- **AND** the current-track index resets to the start
- **AND** playback begins from the first track

#### Scenario: Loading an empty collection

- **WHEN** the user loads a collection that returns no tracks
- **THEN** the queue remains empty and playback does not begin

#### Scenario: Newer load supersedes an in-flight load

- **WHEN** the user loads collection B while collection A is still loading
- **THEN** the queue and playback reflect collection B
- **AND** collection A's late-arriving results are discarded without altering the queue, playback, or the active provider
- **AND** collection A's in-flight catalog requests are cancelled

### Requirement: Adding to the Queue

Adding a collection to the queue SHALL append its tracks to the existing queue without resetting the current-track index, deduplicating by track id so a track already in the queue is not added twice. When the queue is empty, adding SHALL behave as loading a collection.

#### Scenario: Adding to a non-empty queue

- **WHEN** the user adds a collection to a non-empty queue
- **THEN** the collection's tracks are appended to the existing queue
- **AND** the current-track index is unchanged
- **AND** any tracks already in the queue are skipped

#### Scenario: Adding to an empty queue

- **WHEN** the user adds a collection to an empty queue
- **THEN** the queue is loaded with the collection's tracks and playback begins from the first track

### Requirement: Removing from the Queue

Removing a queued track SHALL preserve the playing track's position. Removing the currently playing track SHALL be blocked. Removing the last track SHALL reset the queue to its empty state.

#### Scenario: Removing a track before the current one

- **WHEN** a track positioned before the currently playing track is removed
- **THEN** the current-track index decrements so the same track continues playing

#### Scenario: Removing a track after the current one

- **WHEN** a track positioned after the currently playing track is removed
- **THEN** the current-track index is unchanged

#### Scenario: Removing the currently playing track

- **WHEN** the user attempts to remove the currently playing track
- **THEN** the removal is blocked and the queue is unchanged

#### Scenario: Removing the last track

- **WHEN** the only remaining track in the queue is removed
- **THEN** the queue resets to its empty state

### Requirement: Reordering the Queue

Reordering the queue SHALL move a track from one position to another and SHALL keep the currently playing track's index aligned with its new position.

#### Scenario: Reordering relative to the current track

- **WHEN** a track is moved to a new position in the queue
- **THEN** the track order reflects the move
- **AND** the current-track index now points to the same track that was playing before the reorder

### Requirement: Shuffle Mode

Shuffle SHALL be a persisted toggle. Enabling shuffle SHALL randomize the queue order while keeping the currently playing track at the front; disabling shuffle SHALL restore the queue's original order with the current track's index pointing at its original position. The user's preference SHALL persist across sessions.

#### Scenario: Enabling shuffle

- **WHEN** the user enables shuffle
- **THEN** the queue's non-current tracks are shuffled
- **AND** the currently playing track is placed at the front of the queue
- **AND** the current-track index becomes zero

#### Scenario: Disabling shuffle

- **WHEN** the user disables shuffle
- **THEN** the queue's original order is restored
- **AND** the current-track index points to the currently playing track's position in the original order

#### Scenario: Shuffle preference persists

- **WHEN** the user enables or disables shuffle
- **THEN** the preference persists across sessions
