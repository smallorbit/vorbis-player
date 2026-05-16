## MODIFIED Requirements

### Requirement: Single On-Off Toggle per Provider

Each provider SHALL be controlled by a single on/off toggle in settings. There SHALL be no separate reconnect affordance. When a provider's session becomes unrecoverable, the app SHALL toggle the provider off rather than expose a third "reconnect needed" state.

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

#### Scenario: Session expires mid-use
- **WHEN** a provider's session becomes unrecoverable during normal use
- **THEN** the provider is removed from the enabled set so the toggle reads off
- **AND** the re-enable path is the standard "toggle on while not authenticated" flow

### Requirement: Mid-Session Unrecoverable Auth Failure

When a provider's session becomes unrecoverable during normal use, the app SHALL log the provider out automatically, toggle the provider off in settings, and surface an informational "session expired" notification. The notification SHALL NOT carry a reconnect action button — re-enabling flows through the standard toggle path.

#### Scenario: Provider returns terminal auth error during use
- **WHEN** a provider reports an unrecoverable authentication failure during normal use
- **THEN** the provider is logged out automatically
- **AND** the provider is removed from the enabled set
- **AND** an informational "session expired" notification is shown with no action button
