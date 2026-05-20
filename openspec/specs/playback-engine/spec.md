# playback-engine Specification

## Purpose

The playback engine SHALL turn user playback intent into audio output across multiple providers — routing each control to the provider currently driving audio, automatically advancing on track end, pre-warming the next track, recovering from playback errors, and keeping React state synchronized with the driving provider.

## Requirements

### Requirement: Active vs Driving Provider Roles

The app SHALL distinguish two provider roles at any moment: an **active provider** used for browsing and catalog actions, and a **driving provider** producing audio. The two MAY differ when the queue mixes tracks from multiple providers. Exactly one provider SHALL hold the driving role at any time.

#### Scenario: Queue contains a single provider
- **WHEN** every track in the queue belongs to the same provider
- **THEN** that provider holds the driving role

#### Scenario: Queue mixes providers
- **WHEN** the queue contains tracks from multiple providers
- **THEN** the driving role belongs to the provider owning the currently playing track

### Requirement: Cross-Provider Handoff

When playback advances to a track whose provider differs from the current driving provider, the outgoing provider SHALL be paused before the incoming provider begins playback. Only one provider SHALL produce audio at a time.

#### Scenario: Advancing to a track from a different provider
- **WHEN** the next track belongs to a different provider than the current driving provider
- **THEN** the outgoing provider is paused
- **AND** the incoming provider takes the driving role
- **AND** the incoming provider begins playback of the new track

### Requirement: Control Routing to Driving Provider

Play, pause, next, and previous controls SHALL be dispatched to the driving provider, regardless of which provider is active for browsing.

#### Scenario: Control invoked while driving and active differ
- **WHEN** the user invokes play, pause, next, or previous while the driving provider differs from the active provider
- **THEN** the control is dispatched to the driving provider

### Requirement: Auto-Advance on Track End

The engine SHALL detect track end and advance to the next track in the queue. Track end SHALL be recognized from either of two signals: a near-end signal when remaining time falls below a threshold, or a natural-end signal when the driving provider transitions from playing to paused at position zero.

#### Scenario: Near-end signal
- **WHEN** the driving provider reports remaining time below the near-end threshold
- **THEN** the engine advances to the next track

#### Scenario: Natural-end signal
- **WHEN** the driving provider transitions from playing to paused at position zero
- **THEN** the engine advances to the next track

#### Scenario: Cooldown suppresses false trigger
- **WHEN** an auto-advance signal fires within the cooldown window of a fresh track start
- **THEN** the signal is ignored

### Requirement: Error Recovery

The engine SHALL handle playback adapter errors without leaving the queue stuck on an unplayable track.

#### Scenario: Track is unavailable
- **WHEN** the driving provider reports a track as unavailable
- **THEN** the engine skips to the next track

#### Scenario: Provider authentication expired during playback
- **WHEN** the driving provider reports authentication has expired
- **THEN** the engine surfaces a re-authentication prompt and does not auto-skip

### Requirement: Next-Track Pre-Warm

After a track begins playing successfully, the engine SHALL pre-warm the next track on its owning provider so playback transitions have minimal latency. Pre-warming SHALL NOT change the current-track index or any visible state.

#### Scenario: Pre-warming next track
- **WHEN** a track begins playing successfully and a next track exists in the queue
- **THEN** the engine pre-warms the next track on its owning provider
- **AND** the current-track index is unchanged
- **AND** no visible state changes as a result of pre-warming

### Requirement: Driving-Provider State Synchronization

UI play status, playback position, and current-track index SHALL track the driving provider's emitted state. State from non-driving providers SHALL be ignored.

#### Scenario: Non-driving provider emits state
- **WHEN** a registered but non-driving provider emits a playback state
- **THEN** the UI state is not updated

#### Scenario: Tab returns to foreground
- **WHEN** the browser tab returns to foreground while audio is playing
- **THEN** the engine resyncs from the driving provider so track info, artwork, and position match audio output

### Requirement: Native Queue Sync

A provider that declares a native-queue-sync capability SHALL be notified when the app's queue or current index changes, so the provider can keep its native queue aligned with the app.

#### Scenario: App queue changes while a native-sync provider is driving
- **WHEN** the app's queue or current-track index changes and the driving provider declares the native-queue-sync capability
- **THEN** the provider is notified of the new queue and current index

#### Scenario: Provider without native-sync capability
- **WHEN** the app's queue changes and the driving provider does not declare native-queue-sync
- **THEN** no native-sync notification is dispatched
