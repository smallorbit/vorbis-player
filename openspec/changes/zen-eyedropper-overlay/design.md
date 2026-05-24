# Design — zen-eyedropper-overlay

## Context

`AlbumArtSection.tsx` already owns all the ingredients:
- `zenModeEnabled`, `hasPointerInput`, `isHovered`, `isFlipped` — the exact visibility conditions used by the existing zen overlays (`ZenLikeOverlay`, `ZenClickZoneOverlay`)
- `handleCustomAccentColor(color)` — the dual-write accent-color callback (sets both `ACCENT_COLOR_OVERRIDES` and `CUSTOM_ACCENT_COLORS`)
- `currentTrack?.image` — the art URL

The existing `EyedropperOverlay` in Settings is a full-screen fixed backdrop with the album art rendered in a centered modal card. The zen variant intentionally drops the backdrop and card — the art panel itself IS the canvas.

## Goals / Non-Goals

**Goals:**
- Pipette icon visible in top-right of the art panel in zen mode (hover, non-flipped, track-with-art present)
- Clicking enters picking mode: canvas covers the art, crosshair cursor, color preview follows pointer
- Click to pick → `handleCustomAccentColor` → accent updates instantly → picking mode exits
- Escape or second icon click → cancel picking mode

**Non-Goals:**
- Modifying `EyedropperOverlay.tsx` or the Settings flow
- Extracting a shared pixel-sampling utility (the function is three lines; extraction adds indirection with no current benefit)
- Touch/mobile support (zen mode with pointer is desktop-only; the `zenTouchActive` path already hides all zen overlays)

## Decisions

### 1. New component: `ZenEyedropperOverlay`

Create `src/components/PlayerContent/ZenEyedropperOverlay.tsx` alongside `ZenLikeOverlay.tsx`. It receives:
- `image: string` — the art URL
- `isVisible: boolean` — whether the trigger icon should show
- `onPick: (color: string) => void`

It owns its own `isPicking` state. This keeps `AlbumArtSection` lean — same pattern as `ZenLikeOverlay`.

**Why not inline in AlbumArtSection?** `AlbumArtSection` is already 390 lines. Zen overlays are isolated UI concerns; colocating them as sibling files is the established pattern.

### 2. Canvas positioned absolutely inside the art panel

When `isPicking`, render a `<canvas>` with `position: absolute; inset: 0` inside the art panel's container (which already has `position: relative`). The canvas is sized to `100% × 100%` of the container; pixel coordinates are scaled to the drawn image dimensions via `canvas.width / rect.width` — identical to the existing `EyedropperOverlay` math.

**Why not a portal?** A portal would require computing the art panel's screen rect and rebuilding the coordinate math. Absolute positioning inside the container is simpler and correct.

### 3. Pixel sampling inline, not extracted

The sampling logic is:
```ts
const pixel = ctx.getImageData(x, y, 1, 1).data;
const hex = `#${[pixel[0], pixel[1], pixel[2]].map(v => (v ?? 0).toString(16).padStart(2, '0')).join('')}`;
```
Duplicating this three-liner is preferable to adding a utility function for a single new call site. Revisit if a third call site emerges.

### 4. Trigger icon visibility mirrors ZenLikeOverlay

```
isVisible = zenModeEnabled && hasPointerInput && isHovered && !isFlipped && !!currentTrack?.image
```

The trigger hides while `isPicking` (to avoid a confusing double affordance). A subtle cancel hint ("press Esc") is shown in the color-preview tooltip instead.

### 5. Color preview tooltip anchored near the cursor

Same design as `EyedropperOverlay`: a small floating div tracking `mousemove` showing the hex code with a color swatch. Implemented as absolute positioning driven by local `useState<{x,y}>`.

## Risks / Trade-offs

- **CORS on the image URL**: `EyedropperOverlay` already sets `img.crossOrigin = 'Anonymous'` and the app already loads art through a proxy that sets permissive CORS headers. Same approach applies; no new risk.
- **Canvas draw on every picking-mode open**: The image is re-fetched and redrawn each time picking mode is entered. Given art images are typically 300–640px squares and are already in the browser cache, draw time is negligible.
- **Hover state flicker**: `isHovered` is driven by `mouseenter`/`mouseleave` on the panel. If the pointer leaves the panel mid-pick, `isVisible` would drop — but the trigger icon is hidden during `isPicking` anyway, so the only effect would be the trigger not reappearing after a pick. Acceptable.
