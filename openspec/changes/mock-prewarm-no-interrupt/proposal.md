## Why

`MockPlaybackAdapter.prepareTrack` unconditionally executed `audio.src = clipUrlForTrack(track.id); audio.load();` before checking `options?.positionMs`. For a single-provider mock queue, `nextDescriptor === currentDescriptor` during the pre-warm call in `useProviderPlayback`, so the pre-warm wiped the currently-playing src and halted audio — violating `playback-engine` Requirement 6 (Next-Track Pre-Warm: "Pre-warming SHALL NOT change the current-track index or any visible state").

The Dropbox adapter's `primeAudioForHydrate` already short-circuits when `audio.src && this.currentTrack`. The mock was the outlier.

## What Changes

- Move the `audio.src` / `audio.load()` mutation in `MockPlaybackAdapter.prepareTrack` inside the `if (options?.positionMs !== undefined)` (hydrate) branch, mirroring Dropbox's no-op-when-already-playing behavior. Pre-warm calls become a no-op for the audio element.
- Within the hydrate branch, also guard the load when `audio.src` is already set for the same track id, so a hydrate retargeted at the currently-playing track does not restart it.
- Extend `mockPlaybackAdapter.test.ts` with one assertion that `audio.src` is preserved (and `audio.load()` is not called) during a pre-warm call.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
<!-- No spec-level requirement is changing. The existing playback-engine spec already declares Requirement 6 ("Next-Track Pre-Warm: Pre-warming SHALL NOT change the current-track index or any visible state"). This change brings the mock adapter into conformance with that requirement — no delta spec needed. -->

## Impact

- `src/providers/mock/mockPlaybackAdapter.ts` — guard `audio.src`/`audio.load()` behind the positionMs check.
- `src/providers/mock/__tests__/mockPlaybackAdapter.test.ts` — extend pre-warm coverage with a src-preservation assertion.
- No production code changes outside the mock provider; no API changes; no new dependencies.
- Resolves [#1563](https://github.com/smallorbit/vorbis-player/issues/1563).
