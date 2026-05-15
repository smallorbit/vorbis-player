# auth-system Specification

## Purpose

Vorbis Player SHALL authenticate each music provider independently, expose a single on/off affordance per provider in settings, refresh access tokens before expiry, distinguish transient failures from terminal failures so refresh tokens are preserved across retryable errors, and recover gracefully when a session becomes unrecoverable mid-use.

## Requirements

### Requirement: Connected Provider Set

The app SHALL derive a **connected** provider set defined as the intersection of the enabled-provider set and the providers currently reporting authenticated. Cross-provider features SHALL operate on the connected set.

#### Scenario: Enabled but not authenticated
- **WHEN** a provider is enabled but reports not authenticated
- **THEN** it is excluded from the connected set and from cross-provider features

#### Scenario: Enabled and authenticated
- **WHEN** a provider is enabled and reports authenticated
- **THEN** it is included in the connected set

### Requirement: Single On-Off Toggle per Provider

Each provider SHALL be controlled by a single on/off toggle in settings. There SHALL be no separate reconnect affordance.

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

### Requirement: Disconnect Confirmation and Cleanup

Disconnecting a provider SHALL prompt the user when its tracks are in the queue, and on confirmation SHALL log the provider out, remove it from the enabled set, and remove its tracks from the queue and playback state.

#### Scenario: Toggle off with queued tracks
- **WHEN** the user toggles off a provider whose tracks are in the queue
- **THEN** a confirmation prompt is shown stating the provider name and the count of tracks that will be removed

#### Scenario: Confirming disconnect
- **WHEN** the user confirms the disconnect prompt
- **THEN** the provider is logged out, removed from the enabled set, and its tracks are removed from the queue and playback state

#### Scenario: Cancelling disconnect
- **WHEN** the user cancels the disconnect prompt
- **THEN** the enabled set, queue, and playback state are unchanged

### Requirement: Token Refresh Lifecycle

Each provider SHALL refresh its access token before expiry, within a per-provider refresh window, so authenticated requests do not fail due to expiry.

#### Scenario: Token nearing expiry
- **WHEN** an access token is within its provider's refresh window
- **THEN** the token is refreshed before the next authenticated request

### Requirement: Transient vs Terminal Failure Handling

A provider SHALL distinguish transient failures from terminal authentication failures so that refresh tokens are preserved across retryable network errors and the user is logged out only on terminal failures.

#### Scenario: Transient failure
- **WHEN** a provider request fails with a transient error (network failure or server-side error)
- **THEN** the refresh token is preserved and the user is not logged out

#### Scenario: Terminal authentication failure
- **WHEN** a provider request fails with a terminal authentication error
- **THEN** the provider performs a full logout

### Requirement: Mid-Session Unrecoverable Auth Failure

When a provider's session becomes unrecoverable during normal use, the app SHALL log the provider out automatically and notify the user.

#### Scenario: Provider returns terminal auth error during use
- **WHEN** a provider reports an unrecoverable authentication failure during normal use
- **THEN** the provider is logged out automatically and a "session expired" notification is shown
