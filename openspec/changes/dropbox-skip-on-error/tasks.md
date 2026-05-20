## 1. Adapter changes

- [x] 1.1 In `src/providers/dropbox/dropboxPlaybackAdapter.ts`, import `UnavailableTrackError` alongside the existing `AuthExpiredError` import from `@/providers/errors`.
- [x] 1.2 In `playTrack`, after assigning `audio.src` and invoking `audio.play()`, race the play promise against a one-shot `error` listener. On `error` (or `play()` rejection), throw `UnavailableTrackError(track.name)`. Resolve on the first `playing` event.
- [x] 1.3 Use the existing `prepareGeneration` to invalidate the race if a newer `playTrack`/`prepareTrack` supersedes it — stale events from a prior src must not reject the new play.
- [x] 1.4 Confirm `AuthExpiredError` from `catalog.getTemporaryLink()` continues to propagate untouched.

## 2. Tests

- [x] 2.1 In `src/providers/dropbox/__tests__/dropboxPlaybackAdapter.test.ts`, add a test that `playTrack` rejects with `UnavailableTrackError` when the audio element fires `error` during initial play.
- [x] 2.2 Add a test that `playTrack` resolves normally when the `playing` event fires (happy path stays green).
- [x] 2.3 Add a test that `playTrack` rethrows `AuthExpiredError` from `getTemporaryLink` (regression guard — unchanged behavior).
- [x] 2.4 Add a test that a stale `error` event after a superseding `playTrack` does NOT reject the new play promise.

## 3. Verify

- [x] 3.1 `npx tsc -b --noEmit` clean.
- [x] 3.2 `npm run test:run` green (full suite — confirm no regressions in `useProviderPlayback` / `useSpotifyPlayback` tests).
- [x] 3.3 `npm run build` green.
