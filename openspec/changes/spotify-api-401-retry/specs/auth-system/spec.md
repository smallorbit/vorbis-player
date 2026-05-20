## MODIFIED Requirements

### Requirement: Transient vs Terminal Failure Handling

A provider SHALL distinguish transient failures from terminal authentication failures so that refresh tokens are preserved across retryable network errors and the user is logged out only on terminal failures.

#### Scenario: Transient failure

- **WHEN** a provider request fails with a transient error (network failure or server-side error)
- **THEN** the refresh token is preserved and the user is not logged out

#### Scenario: Terminal authentication failure

- **WHEN** a provider request fails with a terminal authentication error
- **THEN** the provider performs a full logout

#### Scenario: Spotify Web API request receives a 401 with a non-expired refresh token

- **WHEN** a `spotifyApiRequest`-based catalog/library request (i.e. requests routed through the shared API wrapper, excluding the player-playback control endpoints in `spotifyPlayerPlayback.ts`) returns HTTP 401 and the auth singleton holds a refresh token
- **THEN** the provider forces a token refresh, retries the request once with the fresh access token, and treats the result as success if the retry returns a 2xx
- **AND** the user is NOT logged out
- **AND** if the refresh endpoint itself fails with a transient error (network blip, 5xx), the original `SpotifyApiError` carrying `status: 401` is rethrown — the user is NOT logged out and the refresh token is preserved

#### Scenario: Spotify Web API exposes status via structured error

- **WHEN** a Spotify Web API request fails with a non-OK HTTP status (other than the 401-then-refreshed-then-OK path)
- **THEN** the thrown error carries the HTTP `status` (and `statusText`) as structured fields rather than only embedding them in the message string
- **AND** downstream consumers branch on the structured `status` rather than parsing the error message

### Requirement: Mid-Session Unrecoverable Auth Failure

When a provider's session becomes unrecoverable during normal use, the app SHALL log the provider out automatically and notify the user.

#### Scenario: Provider returns terminal auth error during use

- **WHEN** a provider reports an unrecoverable authentication failure during normal use
- **THEN** the provider is logged out automatically and a "session expired" notification is shown

#### Scenario: Spotify Web API returns 401 after a forced refresh

- **WHEN** a Spotify Web API request returns HTTP 401, the auth singleton forces a refresh, and the retried request still returns HTTP 401
- **THEN** the Spotify provider performs a full logout
- **AND** a "session expired" notification is dispatched on the shared `SESSION_EXPIRED_EVENT` bus
- **AND** the call site receives an `AuthExpiredError` carrying `providerId: 'spotify'`
