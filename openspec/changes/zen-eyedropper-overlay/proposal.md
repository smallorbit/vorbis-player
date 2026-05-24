# zen-eyedropper-overlay

## Why

In zen mode the album art fills the screen, making it the natural surface for color picking — yet the only way to sample a pixel today is through Settings → Appearance, which dismisses zen mode entirely. This change brings the eyedropper directly to the art panel so the interaction stays in-context and frictionless.

## What Changes

- A `Pipette` icon button appears in the top-right corner of the album art panel when zen mode is active, the pointer is present, and a track with art is playing (mirrors the existing `ZenLikeOverlay` visibility pattern).
- Clicking the icon enters **picking mode**: the album art panel itself becomes the canvas — a `<canvas>` is absolutely positioned over the art, reusing `EyedropperOverlay`'s pixel-sampling logic but without the full-screen fixed backdrop or the centered modal card.
- Picking a pixel applies the color via `handleCustomAccentColor` (the same dual-write path used by the Settings eyedropper).
- Pressing Escape or clicking the icon again exits picking mode without picking.
- The existing `EyedropperOverlay` full-screen modal in Settings is unchanged.

## Capabilities

### New Capabilities

- `zen-eyedropper`: In-context eyedropper triggered from the zen-mode album art panel — no modal, no navigation away from zen mode.

### Modified Capabilities

_(none — the existing `AccentColorManager` eyedropper flow and its spec are unaffected)_

## Impact

- **New component**: `src/components/PlayerContent/ZenEyedropperOverlay.tsx` — the in-panel canvas picker.
- **Modified**: `src/components/PlayerContent/AlbumArtSection.tsx` — mount the icon trigger and overlay, wire accent-color callback.
- **Pixel-sampling logic**: extracted from `EyedropperOverlay.tsx` into a shared util or duplicated inline (decision deferred to design).
- No changes to `EyedropperOverlay.tsx`, `AccentColorManager.tsx`, `ColorContext`, or any provider/service layer.
