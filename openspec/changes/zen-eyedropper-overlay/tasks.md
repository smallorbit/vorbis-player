# Tasks — zen-eyedropper-overlay

## 1. New component: ZenEyedropperOverlay

- [x] 1.1 Create `src/components/PlayerContent/ZenEyedropperOverlay.tsx` with props: `image: string`, `isVisible: boolean`, `onPick: (color: string) => void`.
- [x] 1.2 Implement the Pipette trigger button (top-right, positioned absolute, `visibility` toggled by `isVisible && !isPicking`). Style to match the `ZenLikeOverlay` button aesthetic.
- [x] 1.3 Implement `isPicking` state; clicking the trigger sets it to `true`.
- [x] 1.4 Implement the canvas overlay: `position: absolute; inset: 0`, draws the album art via `new Image()` with `crossOrigin = 'Anonymous'`, cursor `crosshair`.
- [x] 1.5 Implement `onMouseMove` handler: sample pixel at scaled coordinates, update `hoverColor` state, position the tooltip near the cursor.
- [x] 1.6 Implement `onClick` handler: sample pixel, call `onPick(hex)`, exit picking mode.
- [x] 1.7 Implement Escape key handler (keydown listener on `document`, active only while `isPicking`) to exit picking mode without picking.
- [x] 1.8 Implement outside-click cancellation: clicking outside the canvas (e.g. on a wrapper backdrop div covering the rest of the viewport) exits picking mode.
- [x] 1.9 Render the color-preview tooltip: floating div near cursor showing hex code + 16×16 color swatch, visible only while `isPicking && hoverColor !== null`.

## 2. Wire into AlbumArtSection

- [x] 2.1 Import `ZenEyedropperOverlay` in `src/components/PlayerContent/AlbumArtSection.tsx`.
- [x] 2.2 Mount `<ZenEyedropperOverlay>` inside the art panel's container (alongside `ZenLikeOverlay` and `ZenClickZoneOverlay`). Pass:
  - `image={currentTrack?.image ?? ''}`
  - `isVisible={zenModeEnabled && hasPointerInput && isHovered && !isFlipped && !!currentTrack?.image}`
  - `onPick={handleCustomAccentColor}`

## 3. Spec delta

- [x] 3.1 Confirm `openspec/changes/zen-eyedropper-overlay/specs/zen-eyedropper/spec.md` matches the implemented behavior; adjust if any edge cases changed during implementation.

## 4. Verification

- [x] 4.1 `npx tsc -b --noEmit` — clean.
- [x] 4.2 `npm run test:run` — green (no existing tests touch `ZenEyedropperOverlay`; no test changes expected unless new tests are added).
- [x] 4.3 `npm run build` — green.
- [x] 4.4 Manual: enable zen mode, hover the art → Pipette icon appears in top-right.
- [x] 4.5 Manual: click Pipette → canvas covers art, crosshair cursor, hex tooltip tracks pointer.
- [x] 4.6 Manual: click a pixel → accent color updates, canvas dismisses.
- [x] 4.7 Manual: enter picking mode, press Escape → canvas dismisses, accent unchanged.
- [x] 4.8 Manual: click outside the canvas while in picking mode → canvas dismisses.
- [x] 4.9 Manual: verify Pipette is absent when no art is loaded and when the panel is flipped.
