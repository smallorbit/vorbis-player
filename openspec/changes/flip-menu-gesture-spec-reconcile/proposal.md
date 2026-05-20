## Why

Issue #1560: the `visual-effects-menu` Flip-Menu Surface requirement currently asserts that touch users open the flip menu via long-press. The implementation in `src/components/PlayerContent/GestureLayer.tsx` only attaches the long-press handler when `zenModeEnabled === true`; outside zen mode, touch users open the flip menu via the same synthetic-click path as pointer users (`AlbumArtSection.tsx` wires `onClick` → `toggleFlip`). The spec and the implementation disagree.

The implementation behavior is intentional: in zen mode, the album-art surface is occupied by play-zone overlays (`ZenClickZoneOverlay` renders prev / play-pause / next click zones), so a tap on the art would trigger zone behavior rather than the flip menu. Long-press is the escape hatch from those zones to the flip menu. Outside zen mode there are no zones competing for the tap, and tap-to-flip is the more discoverable affordance. Option B from the issue applies: update the spec to describe the shipped UX.

## What Changes

- Modify the `Flip-Menu Surface` requirement in `openspec/specs/visual-effects-menu/spec.md` (via a delta in this change) so the prose and the "Opening the flip menu" scenario describe the actual gesture matrix:
  - Pointer: click on the album art.
  - Touch, outside zen mode: tap on the album art.
  - Touch, inside zen mode: long-press on the album art (because zen-mode tap is reserved for the play / prev / next click zones).
- No production code changes — implementation already matches the new spec.

No public APIs, no keyboard shortcuts, no provider behavior, no playback behavior change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `visual-effects-menu`: the `Flip-Menu Surface` requirement's surface description and its "Opening the flip menu" scenario are reworded to capture the shipped pointer / touch / zen-mode gesture matrix.

## Impact

- `openspec/specs/visual-effects-menu/spec.md` — `Flip-Menu Surface` requirement prose and "Opening the flip menu" scenario reworded; all other requirements and scenarios unchanged.
- No effect on any source file, test, fixture, or Playwright snapshot.
