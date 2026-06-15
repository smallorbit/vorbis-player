# Design: stop-at-queue-end

## Context

Two end-of-queue behaviors coexist. Manual navigation in `src/hooks/usePlayerLogic.ts` wraps: `handleNext` computes `(current + 1) % tracks.length` and `handlePrevious` computes `current === 0 ? tracks.length - 1 : current - 1`. Auto-advance in `src/hooks/useAutoAdvance.ts:87-90` explicitly stops when `currentIdx >= totalTracks - 1`. Issue #1566 selected Option B: both paths stop at the queue boundary.

## Goals / Non-Goals

**Goals:**

- Make manual Next a no-op at the last track, matching auto-advance.
- Make manual Previous clamp at the first track instead of wrapping to the last.
- Document the canonical boundary behavior in the playback-engine spec.

**Non-Goals:**

- No repeat-mode concept (Option C) — flagged in the issue as out of scope.
- No change to auto-advance logic, shuffle, radio queue generation, or provider adapters.
- No UI affordance changes (e.g., disabling the Next button at queue end).

## Decisions

**Next at last track is a no-op.** `handleNext` returns early when `currentTrackIndexRef.current >= tracks.length - 1`, leaving the current track playing (or paused) untouched. Alternative considered: stop playback entirely — rejected because pressing Next mid-track and getting silence is harsher than ignoring the press, and auto-advance's "stop" is just the absence of an advance, which the no-op mirrors exactly.

**Previous at first track restarts the first track.** `handlePrevious` clamps `newIndex` to `0` instead of wrapping to `tracks.length - 1`. Since the existing code path calls `playTrack(newIndex, true)`, clamping to the current index naturally restarts the track from the beginning — the convention in Spotify, Apple Music, and most players. Alternative considered: no-op like Next — rejected because restart-on-previous is the dominant platform convention and falls out of the existing code path for free.

**Spec documents both paths.** The Auto-Advance requirement gains an explicit end-of-queue stop scenario (current behavior, previously unspecified), and a new requirement covers manual navigation boundaries, so the reconciled behavior is durable.

## Risks / Trade-offs

- [Users accustomed to wrap-around lose a shortcut to jump from last to first track] → Acceptable; the behavior was an accident of modulo arithmetic, and queue UI (drawer/bottom sheet) provides direct track selection.
- [Tests asserting wrap-around will fail] → Update them as part of the change; the failures are the verification that the change landed.
