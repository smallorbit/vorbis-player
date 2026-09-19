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
- **AND** the provider's persisted data is purged under the same contract as an explicit logout

### Requirement: Provider Logout Purges Persisted Data

`AuthProvider.logout` SHALL remove all provider-scoped persisted data for that provider so a later login on the same device cannot read the previous account's tokens, caches, or IndexedDB stores. App-global preferences (volume, visual effects, enabled-provider set ownership by the disconnect caller, etc.) SHALL NOT be wiped by a single-provider logout.

The same purge SHALL run when a provider reports an unrecoverable mid-session auth failure (`reportUnauthorized` / session-expired path), so a forced expiry cannot leave the previous account's library cache or liked-count snapshot for the next login.

Logout MAY complete IndexedDB deletion asynchronously; observers that require an empty store (tests, strict disconnect verification) MUST await the returned promise when one is provided.

#### Scenario: Spotify logout leaves no Spotify-scoped storage

- **WHEN** the Spotify provider is logged out
- **THEN** Spotify auth tokens and OAuth leftovers are removed from localStorage
- **AND** Spotify in-memory API caches are cleared
- **AND** Spotify rows are removed from the shared library IndexedDB cache
- **AND** the Spotify liked-count snapshot entry is removed

#### Scenario: Spotify session expiry purges the same data as logout

- **WHEN** Spotify reports an unrecoverable authentication failure during use
- **THEN** the Spotify provider-scoped purge runs (tokens, in-memory caches, library-cache rows, liked-count snapshot)
- **AND** a session-expired notification is shown

#### Scenario: Dropbox logout leaves no Dropbox-scoped storage

- **WHEN** the Dropbox provider is logged out
- **THEN** Dropbox auth tokens and OAuth leftovers are removed from localStorage
- **AND** Dropbox preferences-sync bookkeeping keys are removed
- **AND** the Dropbox IndexedDB database is deleted
- **AND** Dropbox rows are removed from the shared library IndexedDB cache
- **AND** the Dropbox liked-count snapshot entry is removed

### Requirement: Typed App Event Registry

Window CustomEvents owned by the app SHALL be registered in `constants/events.ts` as an `AppEventMap` with typed `detail` payloads. Dispatch and subscribe SHALL go through `dispatchAppEvent` / `onAppEvent`, which own the single sanctioned `detail` cast. Call sites SHALL NOT mint ad-hoc event name strings or cast `CustomEvent` details for registry events.

`AUTH_COMPLETE_EVENT` is a popup→opener `postMessage` type and is intentionally outside `AppEventMap`.

#### Scenario: Session expiry carries a typed provider id

- **WHEN** a provider reports an unrecoverable session
- **THEN** `SESSION_EXPIRED_EVENT` is dispatched with `{ providerId }` via `dispatchAppEvent`
- **AND** listeners receive the typed detail without casting

#### Scenario: Event names live in one module

- **WHEN** a feature needs a new window CustomEvent
- **THEN** its name and detail type are added to `AppEventMap` in `constants/events.ts`
- **AND** providers do not import event name constants from hooks modules

### Requirement: Prefixed Storage Key Registry

Every durable localStorage key and shared IndexedDB database name owned by the app SHALL be registered in `constants/storage.ts` as `STORAGE_KEYS` and SHALL use the `vorbis-player-` prefix. Production modules SHALL import `STORAGE_KEYS` rather than hardcoding `vorbis-player-*` string literals. Writers SHALL go through `persistedStorage` helpers so same-tab listeners stay in sync.

Unprefixed legacy Spotify auth keys (`spotify_token`, `spotify_code_verifier`) SHALL be migrated once to the prefixed keys on load and included in the Spotify logout purge set until no longer present on disk.

#### Scenario: Spotify tokens use the prefix

- **WHEN** Spotify auth reads or writes its token or PKCE verifier
- **THEN** the keys are `vorbis-player-spotify-token` and `vorbis-player-spotify-code-verifier`
- **AND** a leftover unprefixed `spotify_token` / `spotify_code_verifier` is migrated or purged

#### Scenario: New keys go through the registry

- **WHEN** a feature needs a new localStorage key
- **THEN** the key string is added to `STORAGE_KEYS` under the `vorbis-player-` prefix
- **AND** call sites reference `STORAGE_KEYS.*` rather than a hardcoded literal
