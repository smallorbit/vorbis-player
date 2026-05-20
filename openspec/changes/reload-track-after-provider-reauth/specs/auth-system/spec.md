## MODIFIED Requirements

### Requirement: Single On-Off Toggle per Provider

Each provider SHALL be controlled by a single on/off toggle in settings. There SHALL be no separate reconnect affordance. When the user toggles on a provider whose session previously expired and the queue's current track belongs to that provider, the playback engine SHALL re-prime that track at the user's last known playback position (per the persisted session snapshot) so the player exits its zeroed `0:00 / 0:00` state and resumes at the cursor position the user left off at — without requiring a manual skip.

#### Scenario: Toggle on while already authenticated

- **WHEN** the user toggles on a provider that is already authenticated
- **THEN** the provider is added to the enabled set with no login prompt

#### Scenario: Toggle on while not authenticated

- **WHEN** the user toggles on a provider that is not authenticated
- **THEN** an OAuth flow is initiated immediately
- **AND** the provider is added to the enabled set only after the flow reports success

#### Scenario: OAuth cancelled or failed

- **WHEN** an OAuth flow opened by a toggle is cancelled or fails
- **THEN** the toggle reverts to off and a "couldn't connect" notification is shown

#### Scenario: Re-authentication restores the current track's playability at the last cursor position

- **WHEN** OAuth completes for a provider that previously expired mid-playback AND the queue's current track belongs to that provider
- **THEN** the playback engine re-primes the current track at the persisted `playbackPosition` (per `playback-engine` Requirement: Re-prime After Re-Authentication)
- **AND** the seek bar updates from `0:00 / 0:00` to the track's real duration without user intervention
- **AND** the cursor is positioned where the user left off before navigating to Settings to re-authenticate
- **AND** pressing play resumes from that cursor position
