## MODIFIED Requirements

### Requirement: Disconnect Confirmation and Cleanup

Disconnecting a provider SHALL prompt the user for confirmation when its tracks are in the queue. On confirmation, or immediately when no tracks are affected, the app SHALL log the provider out, remove it from the enabled set, and remove its tracks from the queue and playback state.

#### Scenario: Toggle off with queued tracks
- **WHEN** the user toggles off a provider whose tracks are in the queue
- **THEN** a confirmation prompt is shown stating the provider name and the count of tracks that will be removed

#### Scenario: Toggle off with no queued tracks
- **WHEN** the user toggles off a provider that has no tracks in the queue
- **THEN** no confirmation prompt is shown
- **AND** the provider is logged out, removed from the enabled set, and playback state is unchanged

#### Scenario: Confirming disconnect
- **WHEN** the user confirms the disconnect prompt
- **THEN** the provider is logged out, removed from the enabled set, and its tracks are removed from the queue and playback state

#### Scenario: Cancelling disconnect
- **WHEN** the user cancels the disconnect prompt
- **THEN** the enabled set, queue, and playback state are unchanged
