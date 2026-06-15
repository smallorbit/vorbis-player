## 1. Manual navigation boundary behavior

- [x] 1.1 Update `handleNext` in `src/hooks/usePlayerLogic.ts` to return early when the current track is the last (`currentTrackIndexRef.current >= tracks.length - 1`) instead of wrapping via modulo
- [x] 1.2 Update `handlePrevious` in `src/hooks/usePlayerLogic.ts` to clamp `newIndex` to `0` at the first track instead of wrapping to `tracks.length - 1`

## 2. Tests

- [x] 2.1 Replace the wrap-around test at `src/hooks/__tests__/usePlayerLogic.nextPrevious.test.tsx:246` ("handleNext wraps around to the first track at the end of the queue") with a test asserting handleNext is a no-op on the last track (index unchanged, no playTrack call)
- [x] 2.2 Replace the wrap-around test at `src/hooks/__tests__/usePlayerLogic.nextPrevious.test.tsx:260` ("handlePrevious wraps to the last track from index 0") with a test asserting handlePrevious at index 0 restarts the first track (playTrack called with index 0)
- [x] 2.3 Run the full suite (`npm run test:run`) and TypeScript check (`npx tsc -b --noEmit`); confirm `useAutoAdvance.test.ts` end-of-queue test still passes unchanged

## 3. Spec sync

- [x] 3.1 Verify the delta spec at `openspec/changes/stop-at-queue-end/specs/playback-engine/spec.md` matches the implemented behavior (no-op next at last track, restart-from-start previous at first track, auto-advance stop documented)
