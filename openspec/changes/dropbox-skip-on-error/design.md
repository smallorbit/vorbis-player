## Context

`DropboxPlaybackAdapter` plays audio via an `HTMLAudioElement`. Its `playTrack`:

1. Calls `catalog.getTemporaryLink(path)` to mint a fresh download URL (Dropbox temporary links are short-lived; `dropboxCatalogAdapter` handles refresh transparently).
2. Assigns `audio.src` and awaits `audio.play()`.

The two failure surfaces today:

- **Pre-fetch / catalog**: `getTemporaryLink` rejects. `AuthExpiredError` propagates; everything else is swallowed because the catch site is `useProviderPlayback` which only special-cases `AuthExpiredError` and `UnavailableTrackError` — a generic Error there falls through to the `skipOnError` branch already, but only because `console.error` doesn't swallow re-throw. Actually it does skip via the generic branch (`useProviderPlayback.ts:133-137`). So this path already advances. It is documented for completeness.
- **Post-fetch / media**: `audio.src` is set, then `audio.play()` is awaited. `audio.play()` can resolve before the media element actually starts playing — browsers resolve as soon as the play *intent* is honored, while a media decoding failure may surface asynchronously via the `error` event. The persistent `error` listener at line 60 captures it into `state.playbackError`, but **no subscriber reads that field**, so the queue stalls on the broken track.

## Goals / Non-Goals

**Goals:**
- A post-fetch `<audio>` error during the initial play SHALL cause `playTrack` to reject with `UnavailableTrackError`, so the engine's existing skip path advances the queue.
- Auth expiry continues to throw `AuthExpiredError` (unchanged).
- The `skipOnError` cooldown and ordering already enforced by `useProviderPlayback` is reused — no new engine code.

**Non-Goals:**
- Distinguishing decoder errors from network errors. The user-visible outcome is identical (skip).
- Refreshing the temporary link mid-stream when a long-lived play stalls. That's a separate concern; tracked as a deferred enhancement. Once playback has begun successfully, mid-stream failures should be handled via the existing auto-advance path (track ends), not via a skip.
- Surfacing `state.playbackError` to UI. Out of scope; the field can stay as-is for diagnostics.
- Modifying `useProviderPlayback.ts`. The existing `UnavailableTrackError` branch already does what we need.

## Decisions

**Throw `UnavailableTrackError` from `playTrack` rather than wiring `state.playbackError` through subscriptions.**

Two reasons:

1. **Symmetry with Spotify.** `spotifyPlaybackAdapter` already uses this signal (`spotifyPlaybackAdapter.ts:139`). Using the same shape keeps the engine's recovery branch single-source-of-truth and avoids a second skip-trigger path that subscribers would have to dedupe against.
2. **Minimum blast radius.** Routing `state.playbackError` into a skip would require either a new subscriber hook or extending `usePlaybackSubscription` / `useAutoAdvance` with error-aware logic. Throwing from `playTrack` reuses 100% of the existing infrastructure — the engine's `try/catch` is already there.

**Race `audio.play()` against the next `error` event using a one-shot promise.**

`audio.play()` returning a fulfilled promise does not mean playback succeeded — browsers fulfill it as soon as the play intent is queued; decoding/network failures surface afterward via the `error` event on `HTMLMediaElement`. We need to wait for *one of*:

- The element transitions to actively playing (`playing` event fires) → resolve.
- The element raises `error` → reject with `UnavailableTrackError`.

We attach single-fire listeners for both events, clean them up in `finally`, and return whichever wins. `audio.play()`'s own rejection (e.g. `NotAllowedError` from autoplay policy) is treated as an error too — anything that prevents the element from reaching `playing` is unavailable.

The iOS Safari pre-emptive `audio.play()` call at line 88 is preserved — it's a gesture-activation hack and doesn't interact with the post-`src=...` play race.

**`AuthExpiredError` keeps its dedicated channel.**

Auth expiry is a recoverable user-actionable state, not a track-availability problem. The engine's branch at `useProviderPlayback.ts:120-123` dispatches a re-auth prompt and explicitly does not skip. So we rethrow `AuthExpiredError` as-is from `catalog.getTemporaryLink()` and never wrap it in `UnavailableTrackError`.

**Generic catalog rejections (non-Auth) fall through to the engine's generic-error skip branch.**

`useProviderPlayback.ts:133-137` already skips on any non-Auth/non-Unavailable error from `playTrack`. We do not need to wrap pre-fetch errors in `UnavailableTrackError` — letting them propagate as plain `Error` gives the same outcome and avoids hiding the original stack. The test suite asserts the queue advances either way.

## Risks / Trade-offs

- **Risk**: A transient `error` event during a normally-playing stream (e.g. a momentary network glitch that the browser recovers from) could trigger a spurious skip if it fires during the initial play race. → Mitigation: the race is bounded to the first play; we settle on the first `playing` event and detach both listeners. After that, any later `error` event flows through the persistent listener into `pendingError` as before — no spurious skip mid-track. Mid-stream failures are not the target of this change.
- **Risk**: A track with broken metadata that loads but never starts (`playing` never fires, `error` never fires) would leave `playTrack` hanging. → Mitigation: in practice browsers always emit one of the two within a few seconds for a real file. We intentionally do **not** add a timeout in this pass because picking a timeout that's correct across slow networks and CPU-throttled mobile is its own problem; if real-world telemetry shows hangs we can layer one on in a follow-up.
- **Trade-off**: The race adds a small amount of state-machine glue to `playTrack` but keeps engine-level error recovery centralized.

## Edge Cases

- **Link refresh failure**: `getTemporaryLink` already handles 410/expired-link refresh internally. If refresh ultimately fails (e.g. file deleted), it rejects with a generic Error; the engine's generic-error branch skips. If it rejects with `AuthExpiredError`, we rethrow and the engine surfaces re-auth.
- **Decoder error**: Audio element fires `error` with `MediaError.MEDIA_ERR_DECODE`. Caught by the race, throws `UnavailableTrackError`, skip.
- **Network mid-stream**: Out of scope for the initial-play race. The element will pause and the existing natural-end auto-advance signal may or may not fire depending on browser; this is acknowledged as a separate gap.
- **iOS user-gesture pre-emptive play**: Untouched. The pre-emptive `this.audio!.play().catch(() => {})` at line 88 runs before `audio.src` is set; it activates the element for later programmatic play and any rejection there is irrelevant to the real play that follows the catalog fetch.
- **Subsequent `playTrack` supersedes a pending one**: `prepareGeneration` is already incremented at the top of `playTrack`. We add the same generation check inside the race so a stale `error` from the previous src can't reject the new play.
