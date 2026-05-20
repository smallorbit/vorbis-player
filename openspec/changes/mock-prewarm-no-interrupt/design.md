## Context

The mock provider serves as the testing harness for Playwright specs and `?provider=mock` dev runs. It must mirror the observable behavior of the real Spotify and Dropbox adapters; otherwise tests that exercise queue transitions against the mock will diverge from production behavior.

`playback-engine` Requirement 6 already declares: "Pre-warming SHALL NOT change the current-track index or any visible state." The Dropbox adapter implements this by short-circuiting `primeAudioForHydrate` when `audio.src && this.currentTrack` (see `dropboxPlaybackAdapter.ts:235`). The mock implementation did not — it unconditionally reset the audio src before checking the hydrate intent.

## Goals / Non-Goals

**Goals:**
- Bring `MockPlaybackAdapter.prepareTrack` into conformance with Requirement 6.
- Match Dropbox's pre-warm pattern: load the audio element only when the call is a hydrate (positionMs supplied).
- Add a regression test that exercises the single-provider pre-warm path (current track === next track) and asserts `audio.src` is preserved.

**Non-Goals:**
- Changing `useProviderPlayback.ts` or the broader pre-warm caller — the contract is "pre-warm is best-effort and idempotent against the current src," and the fix lives in the adapter that violates it.
- Changing Spotify or Dropbox adapters.
- Adding new spec requirements — the existing Requirement 6 already covers the behavior.

## Decisions

**No delta spec.** Requirement 6 in `openspec/specs/playback-engine/spec.md` already states the invariant verbatim. This change brings an existing implementation into conformance; it does not modify the requirement. Adding an empty delta would be noise.

**Guard inside the hydrate branch as well.** The original code had a latent bug: even a hydrate call retargeted at the currently-playing track would have reset its src. The Dropbox guard (`audio.src && this.currentTrack`) covers both pre-warm and same-track-hydrate. The mock now mirrors that: it skips the load inside the hydrate branch when `audio.src && this.currentTrack?.id === track.id`.

**Pre-warm becomes a true no-op for the audio element.** Mirrors Dropbox's behavior — the adapter only `prefetchTemporaryLink`s during pre-warm, which has no mock-side analog (the clip URL is deterministic from the track id). So the mock's pre-warm is a literal no-op, which is fine: `playTrack` will load the src when the transition actually fires.

## Risks / Trade-offs

- The mock pre-warm no longer warms the `<audio>` element at all. This is intentional and matches Dropbox semantics — the real cost (network fetch) doesn't exist for the mock, and the previous "warm" was actively harmful (interrupted current playback).
- If a future test relied on `audio.src` being set after a pre-warm without positionMs, it would need to call `playTrack` instead. No such test exists today.
