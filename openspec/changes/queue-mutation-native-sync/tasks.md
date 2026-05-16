## 1. Hook plumbing

- [ ] 1.1 In `src/hooks/useQueueManagement.ts`, extend `UseQueueManagementProps` with `getDrivingProviderDescriptor: () => ProviderDescriptor | undefined`.
- [ ] 1.2 Add a private `notifyQueueChanged(nextTracks: MediaTrack[], nextIndex: number)` helper inside the hook that resolves the driving descriptor, checks `capabilities.hasNativeQueueSync`, and forwards to `descriptor.playback.onQueueChanged?.(nextTracks, nextIndex)`.

## 2. Mutator wiring

- [ ] 2.1 `handleAddToQueue`: after the append commit (post-dedup, post-`setTracks`), call `notifyQueueChanged([...tracksRef.current, ...uniqueNewTracks], currentTrackIndex)`.
- [ ] 2.2 `handleRemoveFromQueue`: after the splice commit, call `notifyQueueChanged(nextTracks, adjustedIndex)` using the same locally-computed values used for the setters.
- [ ] 2.3 `handleReorderQueue`: after computing `newTracks` and `newCurrentIndex`, call `notifyQueueChanged(newTracks, newCurrentIndex >= 0 ? newCurrentIndex : 0)`.
- [ ] 2.4 `queueTracksDirectly`: after the append commit, call `notifyQueueChanged([...tracksRef.current, ...uniqueNewTracks], currentTrackIndex)`.
- [ ] 2.5 `insertTracksNext`: after building `nextTracks`, call `notifyQueueChanged(nextTracks, currentTrackIndex)` for the non-empty path; for the empty-queue path, call `notifyQueueChanged(uniqueNewTracks, 0)`.
- [ ] 2.6 `insertCollectionNext`: no direct change — delegates to `insertTracksNext`, which already notifies.

## 3. Caller wiring

- [ ] 3.1 In `src/hooks/usePlayerLogic.ts`, pass the existing `getDrivingProviderDescriptor` into the `useQueueManagement({...})` call.

## 4. Stale comment cleanup

- [ ] 4.1 In `src/hooks/useProviderPlayback.ts`, remove the comment block at lines 97-101 referencing a non-existent `useEffect-based onQueueChanged in usePlayerLogic`. Keep the `descriptor.playback.onQueueChanged?.(tracks, index)` call on line 102.

## 5. Tests

- [ ] 5.1 Extend `src/hooks/__tests__/useQueueManagement.test.ts` to cover: each mutator invokes `onQueueChanged` with the post-mutation tracks and index when the driving descriptor declares `hasNativeQueueSync`.
- [ ] 5.2 Add a negative test: when the driving descriptor lacks `hasNativeQueueSync`, mutators do not call `onQueueChanged`.
- [ ] 5.3 Add a test that mutators which bail early (dedup-empty, out-of-range index) do not call `onQueueChanged`.

## 6. Verify

- [ ] 6.1 `npx tsc -b --noEmit` clean.
- [ ] 6.2 `npm run test:run` green.
- [ ] 6.3 `npm run build` green.
