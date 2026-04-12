# Album Art System

## Overview

The album art system handles display, color extraction, accent color propagation, the flip menu (visual effects controls on the back of album art), gesture recognition, and responsive sizing. Album art is also the primary gesture target for opening drawers and zen mode interactions.

## File Map

| File | Role |
|------|------|
| `src/components/AlbumArt.tsx` | Core display component; glow, translucence, image processing |
| `src/components/AlbumArtQuickSwapBack.tsx` | Flip menu back face; hosts `QuickEffectsRow` |
| `src/components/AccentColorBackground.tsx` | Full-viewport gradient tinted by accent color |
| `src/components/AccentColorGlowOverlay.tsx` | Per-art glow overlay with breathing animation |
| `src/components/PlayerContent/AlbumArtSection.tsx` | Composition layer: art + flip + zen overlays + gestures |
| `src/components/PlayerContent/GestureLayer.tsx` | Swipe/click/long-press routing; merges touch + pointer handlers |
| `src/components/PlayerContent/ZenClickZoneOverlay.tsx` | Desktop zen: hover-reveal prev/play/next buttons |
| `src/components/PlayerContent/ZenLikeOverlay.tsx` | Desktop zen: hover-reveal like button |
| `src/components/PlayerContent/styled.tsx` | `FlipInner`, `ClickableAlbumArtContainer`, zen track info styled components |
| `src/hooks/useAccentColor.ts` | Auto-extract color on track change; manages override lifecycle |
| `src/hooks/usePlayerSizing.ts` | Viewport-aware dimensions, breakpoints, device detection |
| `src/hooks/useImageProcessingWorker.ts` | Hook wrapping the web worker for accent-mask image processing |
| `src/hooks/useZenTouchGestures.ts` | Touch gesture recognizer (single tap, double tap, long press) |
| `src/hooks/useSwipeGesture.ts` | Horizontal swipe detection (next/prev track) |
| `src/hooks/useVerticalSwipeGesture.ts` | Vertical swipe detection (queue up, library down) |
| `src/utils/colorExtractor.ts` | Canvas-based dominant color extraction with LRU cache |
| `src/utils/colorCache.ts` | LRU cache (100 entries) for extracted colors |
| `src/utils/colorUtils.ts` | `hexToRgb`, `getRelativeLuminance`, `isLightColor`, `getContrastColor` |
| `src/contexts/ColorContext.tsx` | Global accent color state, overrides, custom colors |
| `src/workers/imageProcessor.worker.ts` | Web worker: pixel-level accent-mask processing |
| `src/constants/zenAnimation.ts` | Zen mode animation timings and dead zone constants |

## AlbumArt Component

**Location:** `src/components/AlbumArt.tsx`

### Props

```ts
interface AlbumArtProps {
  currentTrack: MediaTrack | null;
  objectPosition?: string;
  accentColor?: string;
  glowIntensity?: number;     // 95-125 range, controls glow spread
  glowRate?: number;          // seconds per breathing cycle
  glowEnabled?: boolean;
  zenMode?: boolean;
  translucenceEnabled?: boolean;
  translucenceOpacity?: number;
  onRetryAlbumArt?: () => void;
}
```

### Rendering pipeline

1. `AlbumArtContainer` sets the base box with CSS glow (see below)
2. `AccentColorGlowOverlay` adds a blurred overlay for glow bleed
3. Main image: either processed `canvasUrl` (accent-masked) or raw `currentTrack.image`
4. If `glowIntensity === 0` or worker processing is incomplete, falls back to raw image
5. Missing artwork shows "No image" placeholder with optional retry button

### Glow system (box-shadow)

Four visual states based on `glowEnabled` and `glowIntensity`:

| State | Visual |
|-------|--------|
| `glowEnabled === false` | Subtle edge definition only (white border + depth shadow) |
| `glowEnabled && glowIntensity > 0` | Animated breathing glow via `breatheBorderGlow` CSS animation. Three colored shadow layers with opacities derived from `glowIntensity`. Uses CSS custom properties `--glow-opacity` and `--glow-rate`. |
| `glowEnabled && glowIntensity === 0` | Static full glow (no animation) |
| No accent color | White glow fallback |

The glow intensity range 95-125 is mapped to opacity coefficients via `t = (glowIntensity - 95) / (125 - 95)`.

### Zen mode sizing

In zen mode, `max-width` expands to fill viewport minus margins:
- Desktop: `min(calc(100vw - 96px), calc(100dvh - 196px))`
- Mobile (`<= theme.breakpoints.lg`): `min(calc(100vw - 32px), calc(100dvh - 120px))`

Transition: 1000ms with 300ms enter delay, Material Design easing.

### Image processing

On track/accent color change, the component:
1. Loads the image via `new Image()` with `crossOrigin = 'anonymous'`
2. Draws to a canvas, extracts `ImageData`
3. Sends to `processImage()` (web worker) with `maxDistance = 40`
4. Worker masks pixels close to the accent color (makes them transparent)
5. Result displayed as `canvas.toDataURL()`

The processing spinner shows while the worker is active.

### Custom equality check (arePropsEqual)

The component uses a custom `React.memo` comparator that checks: `currentTrack.id`, `currentTrack.image`, `accentColor`, `glowIntensity`, `glowRate`, `glowEnabled`, `zenMode`, `translucenceEnabled`, `translucenceOpacity`, `onRetryAlbumArt`. This prevents unnecessary re-renders from parent state changes that don't affect album art.

## The Flip Menu

### Architecture

Album art has a front (artwork) and back (visual effects controls). The flip is a CSS 3D transform (`rotateY(180deg)`) applied via `FlipInner` in `src/components/PlayerContent/styled.tsx`.

### Flip state

`isFlipped` state lives in `AlbumArtSection`. Toggled by:
- Click on album art (when not in zen touch mode and not already flipped in zen)
- Long press on album art (zen mode, pointer devices)
- Long press gesture (zen mode, touch devices -- 500ms via `useZenTouchGestures`)

Auto-closes when:
- Track changes (`currentTrack.id` effect resets `isFlipped = false`)
- Click outside the flip container (`mousedown` handler on `document`)
- Explicit close button on the back face

### Back face content (AlbumArtQuickSwapBack)

**Location:** `src/components/AlbumArtQuickSwapBack.tsx`

Renders over a blurred version of the album art (`filter: blur(20px)`) with a dark overlay. Contains:
- Title "Visual Effects" (hidden on mobile)
- `QuickEffectsRow` -- the actual controls (accent color picker, glow toggle/sliders, visualizer controls, translucence toggle)
- Close button (top-right)
- "Retry Artwork" button (when no image is available)
- Tap-to-close on the background area (pointer up within 10px of pointer down, not on controls)

The back face has `backface-visibility: hidden` and `transform: rotateY(180deg)` so it only appears when the container is flipped.

### Click-outside dismissal

An effect in `AlbumArtSection` adds a `mousedown` listener on `document` when `isFlipped === true`. Clicks outside `flipContainerRef` close the menu. Exception: clicks on `[data-eyedropper-overlay]` are ignored (color picker overlay).

## Color Extraction

**Location:** `src/utils/colorExtractor.ts`

### extractDominantColor(imageUrl): Promise<ExtractedColor | null>

1. Check LRU cache (`src/utils/colorCache.ts`, max 100 entries)
2. Load image with `crossOrigin = 'anonymous'`
3. Downscale to max 150px (either dimension)
4. Sample every 4th pixel (stride 16 in RGBA array)
5. Bucket into 8-unit color bins (32 shades per channel)
6. Filter: `isGoodContrast` (lightness 40-85%) AND `isVibrant` (saturation >= 50%)
7. Score: `pixelCount * (saturation/100) * (1 - |lightness - 50| / 50)`
8. Return highest-scoring color as `{ hex, rgb, hsl }`

Returns `null` if no color passes filters.

### extractTopVibrantColors(imageUrl, count = 3): Promise<ExtractedColor[]>

Same algorithm but returns up to `count` colors with a similarity filter: candidates within Euclidean RGB distance < 40 of an already-selected color are skipped.

### ExtractedColor type

```ts
interface ExtractedColor {
  hex: string;   // '#rrggbb'
  rgb: string;   // 'rgb(r, g, b)'
  hsl: string;   // 'hsl(h, s%, l%)'
}
```

### Cache (colorCache.ts)

Simple `Map<string, ExtractedColor | null>` with LRU eviction at 100 entries (deletes oldest key when full). Keyed by image URL.

## Accent Color System

### Flow

```
Track changes (currentTrack.id or currentTrack.image)
  -> useAccentColor effect fires
    -> if albumId has override in accentColorOverrides: use it
    -> else: extractDominantColor(image) -> apply via requestIdleCallback + startTransition
    -> fallback: theme.colors.accent (default teal)

Accent color set via setAccentColor()
  -> ColorContext propagates to all consumers
  -> CSS custom property --accent-color updated on :root
  -> CSS custom property --accent-contrast-color updated (via getContrastColor)
```

### ColorContext

**Location:** `src/contexts/ColorContext.tsx`

```ts
interface ColorContextValue {
  accentColor: string;
  accentColorOverrides: Record<string, string>;   // albumId -> color, persisted in localStorage
  customAccentColors: Record<string, string>;      // albumId -> eyedropper color, separate storage
  setAccentColor: (color: string) => void;
  setAccentColorOverrides: (...) => void;
  handleSetAccentColorOverride: (albumId: string, color: string) => void;
  handleRemoveAccentColorOverride: (albumId: string) => void;
  handleResetAccentColorOverride: (albumId: string) => void;    // alias for remove
  handleSetCustomAccentColor: (albumId: string, color: string) => void;
  handleRemoveCustomAccentColor: (albumId: string) => void;
}
```

Storage keys:
- `accentColorOverrides`: `STORAGE_KEYS.ACCENT_COLOR_OVERRIDES` -- palette selections AND eyedropper picks
- `customAccentColors`: `STORAGE_KEYS.CUSTOM_ACCENT_COLORS` -- eyedropper picks only (so palette clicks don't overwrite the custom swatch display)

All override mutations schedule a Dropbox preferences push (`getPreferencesSync()?.schedulePush()`) for cross-device sync.

### Override priority

In `useAccentColor`:
1. If `albumId` exists in `accentColorOverrides` -> use that color directly (no extraction)
2. If album has image -> extract dominant color
3. Fallback -> `theme.colors.accent`

### Custom color handling in AlbumArtSection

When user picks a custom color (eyedropper or palette):
- `handleSetAccentColorOverride(albumId, color)` -- saves to overrides
- `handleSetCustomAccentColor(albumId, color)` -- saves to custom colors store
- `setAccentColor(color)` -- immediate visual update

When user clears custom color (empty string):
- Both overrides are removed
- Accent color re-extracts from album art

When user picks `'RESET_TO_DEFAULT'`:
- Override is removed
- Auto-extraction resumes on next track change

## AccentColorBackground

**Location:** `src/components/AccentColorBackground.tsx`

A `position: fixed` full-viewport gradient that tints the background based on accent color. Uses `generateColorVariant()` for shifted hues. The gradient is subtle: 0x20 / 0x15 / 0x10 alpha at three stops.

Renders nothing when `enabled === false`. Low z-index (0) so it sits behind all content.

## Album Art as Gesture Target

`AlbumArtSection` wraps art in `GestureLayer`, which composites multiple gesture recognizers.

### GestureLayer

**Location:** `src/components/PlayerContent/GestureLayer.tsx`

Merges:
- `useSwipeGesture` (horizontal: next/prev track) -- touch only
- `useVerticalSwipeGesture` (vertical: swipe up = queue, swipe down = library) -- touch only, 80px threshold
- `useLongPress` (zen mode long press to flip) -- zen + pointer only
- `zenTouchHandlers` (from `useZenTouchGestures`) -- zen + touch only
- Click handler (toggles flip, suppressed during swipe/animation)
- Zone hover tracking for zen mode (pointer devices only)

The component merges refs via `handleRef` callback to share a single DOM element between `albumArtContainerRef` and `drawerSwipeRef`.

### Gesture priority

When zen touch is active (`isTouchDevice && zenModeEnabled && !isFlipped`), the `zenTouchHandlers` from `useZenTouchGestures` override the normal click/long-press handlers. This enables the single-tap/double-tap/long-press gesture set.

When zen mode is active with pointer input, `longPressHandlers` from `useLongPress` are active instead, allowing long press to open the flip menu.

## Image Processing Worker

**Location:** `src/workers/imageProcessor.worker.ts`

### Purpose

Processes album art pixels off the main thread. The primary operation masks pixels whose color is close to the accent color (making them transparent), creating a "glow bleed" effect where the accent color shows through the art.

### Message protocol

Request:
```ts
{ type: 'PROCESS_IMAGE', imageData: ImageData, accentColor: [r, g, b], maxDistance: number, requestId: number }
```

Response:
```ts
{ type: 'IMAGE_PROCESSED', processedImageData: ImageData, success: true, requestId: number }
// or
{ type: 'IMAGE_PROCESSING_ERROR', error: string, success: false, requestId: number }
```

### Algorithm

For each pixel, compute Euclidean RGB distance from `accentColor`. If distance < `maxDistance` (default 40), reduce alpha proportionally: `alpha = alpha * (distance / maxDistance)`. Exact matches become fully transparent; pixels at the threshold retain full opacity.

### Hook wrapper (useImageProcessingWorker)

Not documented in detail here but provides `processImage(imageData, accentColor, maxDistance): Promise<ImageData>` that manages worker lifecycle and request IDs.

## Responsive Sizing

### usePlayerSizing

**Location:** `src/hooks/usePlayerSizing.ts`

Returns viewport-aware dimensions consumed by album art sizing:

```ts
interface UsePlayerSizingReturn {
  dimensions: PlayerDimensions;
  viewport: ViewportInfo;
  isMobile: boolean;        // width < 700
  isTablet: boolean;        // 700 <= width < 1024
  isDesktop: boolean;       // width >= 1024
  hasPointerInput: boolean; // pointer:fine OR hover:hover
  isTouchDevice: boolean;   // !hasPointerInput
  orientation: 'portrait' | 'landscape';
  // ...additional sizing utilities
}
```

### Album art max-width calculation

In `AlbumArt.tsx`, `AlbumArtContainer` uses CSS `max-width`:
- Normal mode: `min(calc(100vw - 48px), calc(100dvh - var(--player-controls-height, 220px) - 120px))`
- Zen mode: `min(calc(100vw - 96px), calc(100dvh - 196px))`
- Zen mode mobile: `min(calc(100vw - 32px), calc(100dvh - 120px))`

The `aspect-ratio: 1` rule ensures square art. The `max-width` constraint is the sole sizing mechanism -- no explicit width or height is set.

### AlbumArtSection bounds reporting

`AlbumArtSection` optionally reports its DOM bounds via `onAlbumArtBoundsChange` callback, using a `ResizeObserver`. This is used by other components (e.g. zen overlays) to position elements relative to the art.

## Invariants and Gotchas

1. **crossOrigin is required**: Both `colorExtractor` and `AlbumArt` set `img.crossOrigin = 'anonymous'`. Without this, canvas `getImageData` throws a security error for cross-origin images (Spotify CDN, Dropbox thumbnails).

2. **Flip auto-resets on track change**: The `isFlipped` state resets to `false` whenever `currentTrack.id` changes. This prevents showing stale back-face controls.

3. **Custom colors vs overrides**: `customAccentColors` and `accentColorOverrides` are separate localStorage entries. Palette swatch selection writes to `accentColorOverrides` only. Eyedropper writes to both. This lets the flip menu display the user's last eyedropper pick even when they select a different palette swatch.

4. **requestIdleCallback + startTransition**: Accent color application uses both to minimize jank. `requestIdleCallback` defers the work, `startTransition` marks it as non-urgent for React's concurrent scheduler. Falls back to immediate application if `requestIdleCallback` is unavailable.

5. **Worker error handling**: If the web worker fails, `canvasUrl` stays `null` and the raw image displays. The "Component unmounted" error is explicitly ignored to prevent console noise during rapid track changes.

6. **Eyedropper overlay exception**: Click-outside-to-close for the flip menu explicitly ignores clicks on `[data-eyedropper-overlay]` elements. Without this, opening the color picker would immediately close the flip menu.

7. **isTouchDevice vs isMobile**: These are different. `isTouchDevice` is input-capability-based (CSS `pointer: coarse`). `isMobile` is viewport-width-based (`< 700px`). A large tablet is `isTouchDevice === true` but `isMobile === false`. Use `isTouchDevice` for interaction decisions, `isMobile`/`isTablet` for layout.
