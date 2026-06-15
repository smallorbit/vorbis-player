# Proposal: stop-at-queue-end

## Why

Manual next/previous (`handleNext`/`handlePrevious` in `src/hooks/usePlayerLogic.ts`) wrap around the queue via modulo arithmetic, while auto-advance (`src/hooks/useAutoAdvance.ts`) stops at the end of the queue. The asymmetry is surprising: letting the last track finish stops playback, but pressing Next on the last track jumps back to track 1. Issue #1566 asks for one canonical end-of-queue behavior; Option B (both stop) was chosen — it matches most music apps and respects the queue as finite.

## What Changes

- `handleNext` no longer wraps from the last track to the first; at the end of the queue it becomes a no-op.
- `handlePrevious` no longer wraps from the first track to the last; at the start of the queue it restarts the current (first) track from the beginning, matching platform conventions.
- Auto-advance behavior is unchanged (already stops at queue end) but becomes spec-documented as the canonical behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `playback-engine`: Auto-Advance gains an explicit end-of-queue stop scenario, and a new requirement documents manual next/previous boundary behavior (no wrap-around).

## Impact

- `src/hooks/usePlayerLogic.ts` — `handleNext` / `handlePrevious` index computation.
- Unit tests covering manual navigation boundaries (update wrap expectations to stop expectations).
- No provider adapter, queue-management, or UI surface changes.
