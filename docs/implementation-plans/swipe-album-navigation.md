# Plan: Swipe Album Art to Navigate Tracks (Mobile)

## Context

On mobile, users have no gesture-based way to navigate tracks — they must tap small prev/next buttons. Adding horizontal swipe on the album art (swipe left = next, swipe right = previous) provides a natural, discoverable navigation method. The album art is already the dominant visual element and has an existing tap handler (toggles controls visibility) that must be preserved.

## Approach

Create a new `useSwipeGesture` hook and wire it into the existing `ClickableAlbumArtContainer` in `PlayerContent.tsx`. No external libraries needed — native touch events with `requestAnimationFrame`-batched transforms.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/hooks/useSwipeGesture.ts` | **Create** — custom hook for swipe gesture detection |
| `src/components/PlayerContent.tsx` | **Modify** — wire hook into `ClickableAlbumArtContainer` |
| `src/hooks/__tests__/useSwipeGesture.test.ts` | **Create** — tests for gesture logic |

## Implementation Steps

### Step 1: Create `src/hooks/useSwipeGesture.ts`

New hook (~150 lines) that:

- **Accepts**: `{ onSwipeLeft, onSwipeRight, onTap }` handlers + options object
- **Returns**: `{ offsetX, isSwiping, isAnimating, gestureHandlers }`
- **Touch event flow**:
  1. `onTouchStart` — record start position + timestamp in refs
  2. `onTouchMove` — lock direction (horizontal vs vertical) after 10px movement. If horizontal, update `offsetX` state via `requestAnimationFrame` with 0.8x dampening
  3. `onTouchEnd` — evaluate gesture:
     - **Tap**: duration < 250ms AND distance < 10px → call `onTap()`
     - **Swipe**: distance ≥ 50px OR velocity ≥ 0.3 px/ms → animate off-screen, call `onSwipeLeft`/`onSwipeRight`, reset
     - **Below threshold**: snap back to `offsetX = 0` with transition
- **Direction locking**: if vertical movement dominates, set `verticalRef = true` and stop tracking (allows native scroll)
- **Animation guard**: ignore new touches while `isAnimating` is true (prevents rapid double-swipe)
- **Cleanup**: cancel `requestAnimationFrame` on unmount

Reuse patterns from:
- `useKeyboardShortcuts.ts` — handler interface + options pattern
- `useAnimationFrame.ts` — ref-based rAF management

### Step 2: Modify `src/components/PlayerContent.tsx`

1. **Import** `useSwipeGesture`
2. **Expand** `usePlayerSizing()` destructuring to include `isDesktop` (already returned by the hook)
3. **Invoke the hook** after the sizing hook:
   ```tsx
   const { offsetX, isSwiping, isAnimating, gestureHandlers } = useSwipeGesture({
     onSwipeLeft: handlers.onNext,
     onSwipeRight: handlers.onPrevious,
     onTap: toggleControls,
   }, { enabled: !isDesktop });
   ```
4. **Update `ClickableAlbumArtContainer` styled component** — add `$swipeEnabled` transient prop:
   ```css
   touch-action: pan-y;
   user-select: none;
   -webkit-user-select: none;
   ```
5. **Update JSX** at line 291:
   - Desktop: keep `onClick={toggleControls}`, no gesture handlers
   - Mobile/tablet: spread `{...gestureHandlers}`, no `onClick` (hook calls `onTap` instead)
   - Apply inline styles for transform/transition/willChange:
     ```tsx
     style={{
       transform: `translateX(${offsetX}px)`,
       transition: isAnimating ? 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
       willChange: isSwiping ? 'transform' : undefined,
     }}
     ```

### Step 3: Create `src/hooks/__tests__/useSwipeGesture.test.ts`

Test cases using `renderHook` + synthetic touch events:
- Tap triggers `onTap`, not swipe handlers
- Swipe left (past threshold) triggers `onSwipeLeft`
- Swipe right (past threshold) triggers `onSwipeRight`
- Fast flick below distance threshold but above velocity threshold still triggers swipe
- Vertical gesture does not trigger swipe or tap
- Below-threshold horizontal gesture snaps back (no handler called)
- `enabled: false` disables all gesture handling
- `offsetX` updates during touchmove

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Mobile + tablet only** (viewport < 1024px) | Desktop users use keyboard arrows or buttons; mouse drag feels unnatural |
| **No external library** | Simple gesture detection doesn't warrant a dependency; matches existing zero-dependency pattern |
| **Hook replaces `onClick` on mobile** | Cleanly separates tap vs swipe without event conflicts; desktop `onClick` preserved unchanged |
| **`touch-action: pan-y`** | Tells browser to handle vertical scroll natively while we handle horizontal gestures |
| **Transform on parent container** | `ClickableAlbumArtContainer` wraps the album art + glow — everything moves together. Side panels are hidden on mobile (`!isMobile` guard) so no visual issue |
| **No slide-in animation for new track** | Keep it simple — old track slides out, new track appears at center. The album art component already handles image crossfade |

## Gesture Thresholds

| Parameter | Value | Notes |
|-----------|-------|-------|
| Swipe distance | 50px | ~13% of 375px screen |
| Velocity | 0.3 px/ms | Quick flick triggers even with shorter distance |
| Tap max duration | 250ms | Generous for accessibility |
| Tap max distance | 10px | Allows natural finger jitter |
| Animation duration | 300ms | Matches existing `transitionDuration` |
| Dampening factor | 0.8 | Slight resistance during drag |

## Hook Interface

```typescript
export interface SwipeGestureHandlers {
  onSwipeLeft?: () => void;   // Next track
  onSwipeRight?: () => void;  // Previous track
  onTap?: () => void;         // Toggle controls (replaces onClick)
}

export interface SwipeGestureOptions {
  swipeThreshold?: number;    // Min distance (px) for swipe. Default: 50
  velocityThreshold?: number; // Min velocity (px/ms) for swipe. Default: 0.3
  tapMaxDuration?: number;    // Max time (ms) for tap. Default: 250
  tapMaxDistance?: number;     // Max distance (px) for tap. Default: 10
  enabled?: boolean;          // Enable/disable. Default: true
  animationDuration?: number; // Slide-out duration (ms). Default: 300
}

export interface SwipeGestureReturn {
  offsetX: number;            // Current horizontal offset for translateX
  isSwiping: boolean;         // Finger is actively dragging
  isAnimating: boolean;       // Slide-out or snap-back animation in progress
  gestureHandlers: {          // Spread onto the container element
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}
```

## Internal State Machine

```
IDLE → (touchstart) → TRACKING → (touchend, threshold met) → ANIMATING_OUT → (timeout) → IDLE
                     → TRACKING → (touchend, below threshold) → SNAPPING_BACK → (timeout) → IDLE
                     → (touchend, short tap) → TAP → IDLE
```

## Core Logic Sketch

```typescript
// Touch Start: record origin
startRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

// Touch Move: lock direction after 10px, update offsetX
if (!lockedRef.current) {
  if (|deltaY| > |deltaX| && |deltaY| > 10) → lock vertical, abort
  if (|deltaX| > |deltaY| && |deltaX| > 10) → lock horizontal, start tracking
}
if (tracking) setOffsetX(deltaX * 0.8); // via rAF

// Touch End: evaluate
if (elapsed < 250ms && distance < 10px) → onTap()
else if (|deltaX| >= 50 || velocity >= 0.3) → animate out, call onSwipeLeft/Right
else → snap back to 0
```

## Verification

1. `npm run test:run` — all existing + new tests pass
2. `tsc -b && vite build` — no type errors, production build succeeds
3. Manual testing scenarios:
   - Short tap on album art toggles controls (existing behavior preserved)
   - Swipe left on album art → next track plays, album art slides out left
   - Swipe right on album art → previous track plays, album art slides out right
   - Slow/short drag → snaps back, no track change
   - Quick flick → triggers navigation even with short distance
   - Vertical scroll on album art area → page scrolls normally, no swipe triggered
   - Desktop click → toggles controls as before, no swipe behavior

## Agent Parallelization Guide

For Claude Code Agent Teams, the work can be parallelized as follows:

**Parallel Group 1** (no dependencies):
- **Agent A**: Create `src/hooks/useSwipeGesture.ts` — full hook implementation
- **Agent B**: Create `src/hooks/__tests__/useSwipeGesture.test.ts` — tests based on the interface spec above

**Sequential Group 2** (depends on Agent A completing):
- **Agent C**: Modify `src/components/PlayerContent.tsx` — import hook, wire into JSX, update styled component

**Sequential Group 3** (depends on all above):
- **Agent D**: Run `npm run test:run` and `tsc -b && vite build`, fix any issues
