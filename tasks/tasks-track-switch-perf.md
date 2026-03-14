# Track Switching Performance Fixes

Fixes for the ~2.5s main-thread block identified in the performance trace
(`Trace-20260314T123630.json`). Each parent task is independent and can be
handed to a separate agent.

## Relevant Files

- `src/hooks/useSpotifyControls.ts` — duplicate `useVolume` call removed; three `setState` calls batched into `useReducer`
- `src/hooks/useVolume.ts` — hook being called twice in the same render tree
- `src/components/SpotifyPlayerControls.tsx` — broken `areControlsPropsEqual` removed; now uses default React.memo shallow equality
- `src/components/PlayerContent.tsx` — updated to use narrow contexts
- `src/contexts/TrackContext.tsx` — split into `TrackListContext` and `CurrentTrackContext`
- `src/contexts/ColorContext.tsx` — accent color updates now low-priority via startTransition
- `src/hooks/useAccentColor.ts` — narrowed deps; async setAccentColor wrapped in startTransition
- `src/hooks/useLikeTrack.ts` — callbacks verified stable via useCallback

### Notes

- Run `npm run test:run` after each parent task before committing.
- Build check: `npx tsc --noEmit && npm run build`.
- These tasks are ordered by impact (highest first), but each is independent.

---

## Tasks

- [x] 1.0 Remove duplicate `useVolume` from `useSpotifyControls`
  - [x] 1.1 Read `useSpotifyControls.ts` and confirm that none of the volume-related
        return values (`isMuted`, `volume`, `handleMuteToggle`, `handleVolumeButtonClick`,
        `setVolumeLevel`) are consumed by `SpotifyPlayerControls` or any other caller.
  - [x] 1.2 Delete the `useVolume` import and the call to `useVolume` at line 40 of
        `useSpotifyControls.ts`. Remove the volume fields from the hook's return value.
  - [x] 1.3 Verify `SpotifyPlayerControls.tsx` still compiles — it does not use the removed
        fields; volume is managed solely through `PlayerContent` → `useVolume` → `BottomBar`.
  - [x] 1.4 Run `npm run test:run` and fix any failures.

- [x] 2.0 Batch the three `setState` calls in the playback subscription
  - [x] 2.1 In `useSpotifyControls.ts`, replace the three separate state variables
        (`isPlaying`, `currentPosition`, `duration`) with a single `useReducer` or a
        single `useState` object so that `handleProviderStateChange` dispatches one
        update instead of three.
  - [x] 2.2 Update all reads of the old state variables (`isPlaying`, `currentPosition`,
        `duration`) inside the hook to use the new unified state shape.
  - [x] 2.3 Ensure the initial-state `getState()` call (lines 73-83) also dispatches a
        single update.
  - [x] 2.4 Run `npm run test:run` and fix any failures.

- [x] 3.0 Fix the broken memo comparison in `SpotifyPlayerControls`
  - [x] 3.1 Audit `useLikeTrack` — check whether the `handleLikeToggle` callback it
        returns is stable (wrapped in `useCallback`) when `currentTrack?.id` changes.
        If not, stabilise it.
  - [x] 3.2 In `areControlsPropsEqual` (`SpotifyPlayerControls.tsx`), add explicit
        checks for `onPlay`, `onPause`, `onNext`, `onPrevious`, and `onToggleLike` so
        the memo is not silently bypassed when any of these change.
  - [x] 3.3 Alternatively (preferred if 3.1 confirms the callbacks are always stable),
        remove `areControlsPropsEqual` entirely and rely on the default shallow-equality
        memo, adding `// stable via useCallback` comments on the relevant props.
  - [x] 3.4 Run `npm run test:run` and fix any failures.

- [x] 4.0 Split `TrackContext` to stop full re-renders on every track switch
  - [x] 4.1 Analyse all `useTrackContext()` call sites to determine which consumers need
        `tracks` (rarely changes), which need `currentTrack`/`currentTrackIndex`
        (changes every switch), and which need both.
  - [x] 4.2 Split `TrackContext` into two contexts:
        - `TrackListContext` — exposes `tracks`, `setTracks`, `setOriginalTracks`,
          `shuffleEnabled`, `handleShuffleToggle`
        - `CurrentTrackContext` — exposes `currentTrack`, `currentTrackIndex`,
          `setCurrentTrackIndex`, `showPlaylist`, `setShowPlaylist`
  - [x] 4.3 Update `TrackProvider` (or split into two providers) to publish the two
        contexts independently.
  - [x] 4.4 Update all call sites to import from the appropriate narrow context so that
        components receiving only `tracks` no longer re-render when the index changes.
  - [x] 4.5 Run `npm run test:run` and fix any failures. Pay attention to tests that
        render components consuming `TrackContext`.

- [x] 5.0 Eliminate the double render wave caused by accent-color extraction
  - [x] 5.1 In `useAccentColor.ts`, check whether `accentColorOverrides` needs to be a
        dependency of the extraction `useEffect`. The effect only reads
        `accentColorOverrides[currentTrack.album_id]` — if the override exists it
        short-circuits; otherwise it extracts. The dependency can be narrowed to
        `currentTrack?.album_id` + the specific override value for that album, avoiding
        spurious re-runs when unrelated overrides change.
  - [x] 5.2 Wrap the `setAccentColor` call that comes back from `extractDominantColor`
        in `startTransition` so the resulting `ColorContext` update is low-priority and
        does not block the initial track-switch render.
  - [x] 5.3 Confirm the LRU cache in `colorExtractor.ts` is being hit for previously
        seen tracks (cache key is the image URL). If the URL for the same album changes
        between renders, normalise it before calling `extractDominantColor`.
  - [x] 5.4 Run `npm run test:run` and fix any failures.
