## 1. Guard pre-warm in MockPlaybackAdapter

- [x] 1.1 Move `audio.src = clipUrlForTrack(track.id)` and `audio.load()` inside the `if (options?.positionMs !== undefined)` branch in `MockPlaybackAdapter.prepareTrack`.
- [x] 1.2 Within the hydrate branch, skip the load when `audio.src && this.currentTrack?.id === track.id`, mirroring Dropbox's `primeAudioForHydrate` guard.

## 2. Test coverage

- [x] 2.1 Extend `mockPlaybackAdapter.test.ts` with an assertion that `audio.src` is unchanged and `audio.load` is not called when `prepareTrack` is invoked without `positionMs` against an already-playing track.

## 3. Verify

- [x] 3.1 `npx tsc -b --noEmit` clean.
- [x] 3.2 `npm run test:run` green.
- [x] 3.3 `npm run build` green.
