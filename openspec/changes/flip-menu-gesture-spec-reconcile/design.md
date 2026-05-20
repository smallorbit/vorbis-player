## Context

Reported in issue #1560. The spec scenario for opening the flip menu currently reads:

> **WHEN** the user long-presses (touch) or clicks (pointer) the album art with the flip gesture enabled
> **THEN** the flip menu opens

The implementation (`src/components/PlayerContent/GestureLayer.tsx:59-62, 90-108`) only attaches the long-press handler when `zenModeEnabled === true`:

```ts
const longPressHandlers = useLongPress({
  onLongPress: onLongPress ?? (() => {}),
  enabled: zenModeEnabled === true && onLongPress !== undefined,
});

// ...

const activePointerHandlers = zenTouchHandlers
  ? { ...zen play/prev/next handlers... }
  : zenModeEnabled && onLongPress
    ? { ...longPressHandlers... }
    : {};
```

Outside zen mode, touch users open the flip menu via the synthetic `click` event that browsers fire on tap, which lands on `GestureLayer.handleClick` → `AlbumArtSection.handleClick` → `toggleFlip`.

## Decision

Pick **Option B** from the issue: update the spec to describe the shipped UX. No code change.

## Why Option B over Option A

Option A (drop the `zenModeEnabled` gate so long-press is always active) would conflict with the surrounding zen-mode gesture design:

1. **Zen-mode design owns the album-art surface.** When zen mode is on, `ZenClickZoneOverlay` renders three click zones (prev / play-pause / next) on top of the album art. A tap anywhere on the art is intentionally captured by a zone — there is no free tap target for "open flip menu" in zen mode, which is exactly why long-press exists as the escape hatch in zen mode.
2. **Outside zen mode, tap-to-flip is more discoverable** than long-press. There is no competing gesture on the art surface outside zen, so a single tap reliably opens the flip menu and matches the pointer (click) affordance one-to-one.
3. **No bug to fix.** Touch users outside zen mode already open the flip menu reliably via the synthetic `click` event; there is no broken interaction or accessibility regression for end users — only a documentation/spec drift.

The spec scenario was written when the flip-gesture story was simpler (no zen mode); the implementation evolved as zen mode landed and the spec was not refreshed. Reconciling the spec to the implementation captures the real, working UX without churning code that has been in production.

## Spec change shape

The change modifies a single requirement in `visual-effects-menu`:

- Prose: change "long-press on touch, click on pointer" to "tap on touch outside zen mode, long-press on touch inside zen mode, click on pointer".
- "Opening the flip menu" scenario: replace the single WHEN/THEN with three variant clauses — one per input modality — that all converge on the same THEN (album-art card rotates 180° and the menu becomes interactive).

All other requirements (`Accent Color Selection`, `Glow Control`, `Background Visualizer Control`, `Translucence Control`, `Active Controls Reflect Current Accent Color`) and their scenarios are unchanged.

## Risks / Tradeoffs

- Documenting "long-press only in zen mode" makes the long-press affordance contingent on a separate feature. If someone disables zen mode in the future they need to revisit this scenario too. Mitigated by writing it as a three-clause matrix so each modality reads as its own line and the zen dependency is explicit.
- Option B intentionally leaves a latent inconsistency: a touch user who tries to long-press on the album art outside zen mode will see the flip menu open via the synthetic click that fires after they release (or be confused by no immediate feedback). Acceptable because the synthetic click reliably fires and the gesture is short.

## Migration

None. Spec-only change; no consumer of the openspec snapshot reads the file at runtime.
