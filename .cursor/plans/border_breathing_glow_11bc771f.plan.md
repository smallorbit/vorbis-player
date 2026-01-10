---
name: Border Breathing Glow
overview: Add a breathing glow animation to the album art border that synchronizes with the existing AccentColorGlowOverlay animation using the same CSS variables (--glow-rate, --glow-intensity).
todos:
  - id: add-keyframes
    content: Add `@keyframes breathe-border` animation to glow-animations.css
    status: completed
  - id: add-pseudo-element
    content: Add `::after` pseudo-element with breathing animation to AlbumArtContainer
    status: completed
  - id: add-reduced-motion
    content: Update reduced-motion media query to include border animation
    status: completed
---

# Border Breathing Glow Effect

## Current Implementation

The album art has two glow effects:

1. **Static border glow** - A `box-shadow` on `AlbumArtContainer` in [AlbumArt.tsx](src/components/AlbumArt.tsx) (lines 74-101)
2. **Breathing overlay** - `AccentColorGlowOverlay` uses the `.glow-background` class which applies the `breathe-glow` animation from [glow-animations.css](src/styles/glow-animations.css)

The breathing animation is controlled by CSS variables:

- `--glow-rate` - Animation duration (e.g., `4s`)
- `--glow-intensity` - Glow strength (e.g., `110`)
- `--accent-rgb` - RGB color values

## Implementation Approach

Use a pseudo-element (`:after`) with animated opacity for the breathing border glow. This approach is:

- GPU-accelerated (animating opacity is performant)
- Synchronized via the same `--glow-rate` CSS variable
- Non-breaking (keeps existing static glow as a base layer)

## Changes Required

### 1. Add breathing border keyframes in `glow-animations.css`

```css
@keyframes breathe-border {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

### 2. Modify `AlbumArtContainer` styled component in `AlbumArt.tsx`

Add an `::after` pseudo-element that:

- Inherits the same `box-shadow` as the container
- Has `position: absolute` and `inset: 0` to cover the container
- Applies the `breathe-border` animation with `var(--glow-rate)` duration
- Only renders when glow is active (`glowIntensity > 0`)

The base static glow remains, and the pseudo-element adds the breathing variation on top.

### 3. Add reduced-motion support

Update the `@media (prefers-reduced-motion: reduce)` block in `glow-animations.css` to disable the border animation for accessibility.

## Files to Modify

- [src/styles/glow-animations.css](src/styles/glow-animations.css) - Add `@keyframes breathe-border` and reduced-motion rules
- [src/components/AlbumArt.tsx](src/components/AlbumArt.tsx) - Add `::after` pseudo-element to `AlbumArtContainer` styled component