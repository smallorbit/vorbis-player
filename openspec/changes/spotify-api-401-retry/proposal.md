## Why

Spotify Web API calls in `src/services/spotify/api.ts` (`executeApiRequest`, lines 43-72) throw a generic `Error("Spotify API error: <status> <text>")` on every non-OK response. There is no 401 retry-after-refresh, no terminal-vs-transient distinction, and no path that surfaces a persistent 401 to the auth layer. Downstream code (`src/providers/spotify/spotifyPlaybackAdapter.ts:118, 266`) is forced to parse the status out of the error message string with `.includes('401')` — brittle and easy to break when the message format changes.

Compare with the Dropbox provider (`src/providers/dropbox/dropboxApiClient.ts:74-82`, `dropboxContentApiClient.ts:29-37`): a 401 forces one refresh, retries once, and on a second 401 calls `reportUnauthorized()` which logs out and notifies the UI via the shared `SESSION_EXPIRED_EVENT`.

This gap violates [`openspec/specs/auth-system/spec.md`](../../specs/auth-system/spec.md) Requirements 5 (Transient vs Terminal Failure Handling) and 6 (Mid-Session Unrecoverable Auth Failure): the Spotify provider currently fails an expired-token request once and surfaces a generic error, instead of forcing a refresh, retrying, and — only when the refreshed token is still rejected — performing a terminal logout + session-expired notification.

Tracks issue #1553.

## What Changes

- Export a structured `SpotifyApiError extends Error` from `src/services/spotify/api.ts` carrying `status: number` (and the response status text). Existing call sites that catch generic `Error` continue to work.
- Reuse the existing `AuthExpiredError` (`src/providers/errors.ts`) as the terminal-401 signal so the rest of the provider/playback layer keeps a single auth-expired contract across providers.
- Wrap the public `spotifyApiRequest` with a single retry-after-refresh on 401: on the first 401, force a token refresh via `spotifyAuth.refreshAccessToken()`, re-issue the request with the fresh token; on a second 401 throw `AuthExpiredError('spotify')` and trigger session-expired notification + logout via a new public `spotifyAuth.reportUnauthorized()` (mirroring the Dropbox adapter).
- Promote `notifySessionExpired()` to a public `reportUnauthorized()` on the auth singleton so the api layer can call it without reaching into a private method.
- Replace the brittle `message.includes('401')` checks in `spotifyPlaybackAdapter.ts:118, 266` with `instanceof AuthExpiredError` / `instanceof SpotifyApiError && err.status === 401` checks. Update `apiPlayTrack` in `src/services/spotifyPlayerPlayback.ts` to throw the same `SpotifyApiError` so the structured-error contract reaches the playback adapter.

No public-component change, no UI change, no keyboard shortcut change. The Dropbox provider is not touched.

## Capabilities

### Modified Capabilities

- `auth-system` — Requirement 5 (Transient vs Terminal Failure Handling) and Requirement 6 (Mid-Session Unrecoverable Auth Failure) gain Spotify-specific scenarios that pin down the one-shot retry-after-refresh contract and the terminal-401 handling. The general transient/terminal language stays unchanged.

### New Capabilities

None.

## Impact

- `src/services/spotify/api.ts` — adds `SpotifyApiError`, retry-after-refresh wrapper around `executeApiRequest`, calls `spotifyAuth.refreshAccessToken()` and `spotifyAuth.reportUnauthorized()`.
- `src/services/spotify/auth.ts` — adds public `reportUnauthorized()` (logs out + notifies session expired); existing private `notifySessionExpired()` is now invoked from this public method only.
- `src/services/spotifyPlayerPlayback.ts` — `apiPlayTrack` (and the other `apiPlay*` helpers) throw `SpotifyApiError` instead of a generic `Error` so the structured-error contract reaches `SpotifyPlaybackAdapter`.
- `src/providers/spotify/spotifyPlaybackAdapter.ts` — replaces `.includes('401')` parsing at lines 118 and 266 with `instanceof AuthExpiredError` / `SpotifyApiError && status === 401` checks. Continues to parse 403 / 429 strings until those errors also reach the adapter as structured types (out of scope for this change).
- `openspec/specs/auth-system/spec.md` — adds two Spotify-specific scenarios under Requirements 5 and 6.
- `src/services/spotify/__tests__/` — new test covering `executeApiRequest` retry-after-refresh, terminal-401 logout, and structured-error fields.
- `src/providers/spotify/__tests__/spotifyPlaybackAdapterPrepareTrack.test.ts` — existing 401 test (`probePlayable`) keeps passing under the new error contract.

Out of scope:
- Dropbox provider (`src/providers/dropbox/`): not touched.
- `useProviderPlayback.ts`, `useQueueManagement.ts`: belong to other issues in the same wave.
- 403 / 429 structured-error promotion in the playback adapter: tracked separately; this change only flips 401 to structured.
