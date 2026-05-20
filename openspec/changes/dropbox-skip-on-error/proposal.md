## Why

Dropbox playback failures other than auth expiry have no recovery path today. `DropboxPlaybackAdapter.playTrack` only throws `AuthExpiredError`; every other error mode — file moved out from under us, temporary link expired beyond catalog refresh, HTML5 audio decoder failure, network mid-stream drop — is captured into `state.playbackError` but no consumer reads that field, so the queue stalls on the unplayable track. This violates `openspec/specs/playback-engine/spec.md` Requirement 5 ("Error Recovery"), which says the engine SHALL skip an unavailable track.

Spotify already follows the spec: `SpotifyPlaybackAdapter` throws `UnavailableTrackError` from `playTrack` on terminal failures (e.g. 403 "Restriction violated"), and `useProviderPlayback` handles it via the `skipOnError` branch (`src/hooks/useProviderPlayback.ts:125-131`) which advances to the next track after `SKIP_ON_ERROR_DELAY_MS`. Dropbox should plug into the same engine path so error recovery is uniform across providers.

Tracked in #1561.

## What Changes

- Detect unrecoverable Dropbox playback failures inside `playTrack` and throw `UnavailableTrackError` so the existing engine skip path advances the queue. Two failure modes are covered:
  - The `<audio>` element raises an `error` event during the initial play (decoder failure, network stall, terminal 4xx/5xx on the temporary link).
  - `catalog.getTemporaryLink()` rejects with anything other than `AuthExpiredError` (file moved, deleted, link generation failed beyond retry).
- Race the `<audio>` element's `playing` event against an `error` event after `audio.play()` is invoked, so the promise returned by `playTrack` resolves only when audio actually starts, and rejects with `UnavailableTrackError` otherwise.
- Keep the existing `pendingError` capture on the persistent `error` listener for diagnostics, but the new race owns the throw decision during the initial play.
- Add unit tests covering both failure modes plus the happy path.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `playback-engine`: clarifies that "unavailable" for the Dropbox HTML5-audio path includes audio-element error events and post-fetch link failures, not just auth expiry. The existing Requirement 5 scenario gains a Dropbox-specific clause documenting what counts as unavailable.

## Impact

- `src/providers/dropbox/dropboxPlaybackAdapter.ts` — race audio error vs `playing` in `playTrack`; throw `UnavailableTrackError` on failure; rethrow `AuthExpiredError` from the catalog promise.
- `src/providers/dropbox/__tests__/dropboxPlaybackAdapter.test.ts` — new tests for the error race.
- No change to `useProviderPlayback.ts`, no change to Spotify, no auth-flow changes.
- No public API surface change.
