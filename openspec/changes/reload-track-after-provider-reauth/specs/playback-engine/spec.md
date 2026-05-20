## ADDED Requirements

### Requirement: Re-prime After Re-Authentication

When a provider transitions from `not authenticated` to `authenticated` while the queue's current track belongs to that provider, the engine SHALL re-prime that track on the provider's playback adapter at the user's last known playback position without auto-playing. The "last known position" is the `playbackPosition` value from the persisted session snapshot (the same snapshot used by the on-reload hydrate path) when the snapshot's `trackId` matches the current track; otherwise the engine SHALL re-prime at position `0`.

The re-prime SHALL produce a `state` notification carrying the track's real duration so the seek bar paints correctly, and SHALL leave the player in a `paused` state at the resolved position. No queue mutation, current-track index change, toast, or scroll SHALL occur as a side effect of the re-prime.

#### Scenario: Current track's provider re-authenticates from Settings, persisted position available

- **WHEN** a provider whose id matches the current track's `provider` field transitions from `isAuthenticated() === false` to `isAuthenticated() === true` (e.g., the user re-toggles it on in Settings and OAuth completes)
- **AND** the persisted session snapshot's `trackId` matches the current track's id
- **THEN** the engine invokes `descriptor.playback.prepareTrack(currentTrack, { positionMs: snapshot.playbackPosition })` on that provider's adapter
- **AND** within one render cycle the seek bar reflects the track's real duration with the cursor positioned where the user left off
- **AND** the play button resumes functioning for the current track from that position
- **AND** no auto-play, toast, or queue mutation occurs

#### Scenario: Current track's provider re-authenticates but no persisted position is available

- **WHEN** the same auth transition occurs AND the persisted session snapshot is absent OR its `trackId` does not match the current track OR its `playbackPosition` is missing
- **THEN** the engine invokes `descriptor.playback.prepareTrack(currentTrack, { positionMs: 0 })`
- **AND** the seek bar reflects the track's real duration with the cursor at position `0`

#### Scenario: Non-current-track provider re-authenticates

- **WHEN** a provider re-authenticates but the queue's current track belongs to a different provider
- **THEN** the engine does NOT re-prime any track
- **AND** the player state is unchanged

#### Scenario: Re-authentication during initial mount

- **WHEN** the application first mounts and a provider is already authenticated at render time
- **THEN** the engine does NOT treat the initial authenticated state as a `false → true` transition
- **AND** the persisted-session hydrate path (per #1394 / #1478) is the sole authority over the current track's initial primed state
