# Visual Effects System

The visual effects system controls ambient visual enhancements around the player: glow behind album art, background color tinting, translucence/opacity of the player card, and the master on/off for all visual effects. This is distinct from the [visualizer system](./visualizers.md), which handles the canvas-based animated backgrounds.

## VisualEffectsContext

**File**: `src/contexts/VisualEffectsContext.tsx`

Central state store for all visual effect preferences. Wraps the app and provides both state values and setters.

### State Shape

```ts
interface VisualEffectsContextValue {
  // Persisted via useLocalStorage
  visualEffectsEnabled: boolean;                  // master toggle for glow
  perAlbumGlow: Record<string, { intensity: number; rate: number }>;
  backgroundVisualizerEnabled: boolean;
  backgroundVisualizerStyle: VisualizerStyle;
  backgroundVisualizerIntensity: number;          // 0-100
  backgroundVisualizerSpeed: number;              // multiplier, default 1.0
  accentColorBackgroundPreferred: boolean;        // user preference
  translucenceEnabled: boolean;
  translucenceOpacity: number;                    // 0-1
  zenModeEnabled: boolean;

  // Derived / transient
  accentColorBackgroundEnabled: boolean;          // computed from preferred + master toggle
  showVisualEffects: boolean;                     // whether settings menu is open (transient)

  // Setters (all accept value or updater function)
  setVisualEffectsEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  // ... one setter per state field
}
```

### Persistence

All persisted fields use `useLocalStorage` with keys from `src/constants/storage.ts`.

| Field | localStorage key | Default |
|-------|-----------------|---------|
| `visualEffectsEnabled` | `vorbis-player-visual-effects-enabled` | `true` |
| `perAlbumGlow` | `vorbis-player-per-album-glow` | `{}` |
| `backgroundVisualizerEnabled` | `vorbis-player-background-visualizer-enabled` | `true` |
| `backgroundVisualizerStyle` | `vorbis-player-background-visualizer-style` | `'fireflies'` |
| `backgroundVisualizerIntensity` | `vorbis-player-background-visualizer-intensity` | `40` |
| `backgroundVisualizerSpeed` | `vorbis-player-background-visualizer-speed` | `1.0` |
| `accentColorBackgroundPreferred` | `vorbis-player-accent-color-background-preferred` | `false` |
| `translucenceEnabled` | `vorbis-player-translucence-enabled` | `true` |
| `translucenceOpacity` | `vorbis-player-translucence-opacity` | `0.8` |
| `zenModeEnabled` | `vorbis-player-zen-mode-enabled` | `false` |

### Derived State

`accentColorBackgroundEnabled` is not directly persisted. It is computed:
- `false` when `visualEffectsEnabled` is `false` (master toggle off disables accent background)
- Otherwise equals `accentColorBackgroundPreferred`

### Migration

On mount, the context runs a one-time migration for old style names:
- `'particles'` -> `'fireflies'`
- `'trail'` -> `'comet'`
- `'geometric'` -> `'fireflies'`

It also removes the deprecated `vorbis-player-album-filters` key.

## Glow Effect

The glow is a pulsing colored layer rendered behind album art. It uses the track's accent color and animates with a "breathing" effect.

### Components

**`AccentColorGlowOverlay`** (`src/components/AccentColorGlowOverlay.tsx`):
- Renders a `GlowBackgroundLayer` div positioned absolutely behind album art
- Uses the `--accent-color` CSS variable as its `background`
- Animates via the `breatheGlow` keyframes (`src/styles/animations.ts`): cycles between full brightness and 0.9 brightness
- Respects `prefers-reduced-motion`: disables animation entirely

Props:
```ts
interface AccentColorGlowOverlayProps {
  glowIntensity: number;   // 0-200, maps to opacity (intensity/100)
  glowRate?: number;        // animation duration in seconds, default 4.0
  backgroundImage?: string; // if falsy or intensity is 0, renders null
}
```

**Defaults**: `DEFAULT_GLOW_INTENSITY = 110`, `DEFAULT_GLOW_RATE = 4.0` (exported from the component file).

### Glow State Management

**`useVisualEffectsState`** hook (`src/hooks/useVisualEffectsState.ts`):
- Manages `glowIntensity` and `glowRate` with localStorage persistence
- Keys: `vorbis-player-glow-intensity`, `vorbis-player-glow-rate`
- Maintains separate `savedGlowIntensity`/`savedGlowRate` in React state for restoration when toggling effects back on
- Returns `effectiveGlow: { intensity: number; rate: number }` and handlers

### Per-Album Glow

`perAlbumGlow` in `VisualEffectsContext` is a `Record<string, { intensity: number; rate: number }>` keyed by some track/album identifier. This allows different glow settings per album. The data is persisted but the per-album override logic lives in the consuming components.

### Master Toggle Behavior

The `visualEffectsEnabled` flag is the master glow toggle:
- When toggled off: glow intensity passed to `AccentColorGlowOverlay` becomes 0
- When toggled back on: `restoreGlowSettings()` restores the last user-set intensity/rate
- Keyboard shortcut: `G` key (via `handleGlowToggle` in `PlayerControlsSection.tsx`)

## Translucence

Controls the opacity of the player card, making the background visualizer and accent color visible through the UI.

### State

- `translucenceEnabled: boolean` (default `true`)
- `translucenceOpacity: number` (default `0.8`, range 0-1)

Both persisted via `useLocalStorage`.

### Keyboard Shortcut

`T` key toggles `translucenceEnabled` (via `handleTranslucenceToggle` in `PlayerControlsSection.tsx`).

### UI Control

Available on the flip menu back (`QuickEffectsRow`) as a toggle switch.

## AccentColorBackground Component

**File**: `src/components/AccentColorBackground.tsx`

A subtle full-viewport gradient tinted by the current track's accent color. Independent from the animated visualizers.

### Props

```ts
interface AccentColorBackgroundProps {
  enabled: boolean;
  accentColor: string;
}
```

### Rendering

- `position: fixed; z-index: 0` (below everything, including the visualizer at z-index 1)
- `pointer-events: none`
- Renders a diagonal linear gradient using the accent color at very low alpha values (`20`, `15`, `10` hex alpha suffixes)
- Uses `generateColorVariant()` from `src/utils/visualizerUtils.ts` to create darker tints at gradient stops
- 0.5s CSS transition on `background` for smooth color changes between tracks

### Activation

Controlled by `accentColorBackgroundEnabled` in `VisualEffectsContext`, which requires both:
1. `accentColorBackgroundPreferred` is `true` (user opted in)
2. `visualEffectsEnabled` is `true` (master toggle is on)

Default is disabled (`accentColorBackgroundPreferred` defaults to `false`).

## Speed Multiplier

The `backgroundVisualizerSpeed` value (default `1.0`) is a global speed multiplier passed to all visualizers. Each visualizer applies it to its own speed calculations. It multiplies with the per-visualizer `pausedSpeedMult` when playback is paused.

Controlled via a slider on the flip menu back (`QuickEffectsRow`). Persisted under `vorbis-player-background-visualizer-speed`.

## Settings Menu (VisualEffectsMenu)

**File**: `src/components/VisualEffectsMenu/index.tsx`

Despite the name, this is the **app settings drawer**, not just visual effects. It renders as a right-side drawer via `createPortal` to `document.body`.

### What It Contains

- **Music Sources**: Provider connection management
- **Native Queue Sync**: Spotify queue sync toggle
- **Quick Access Panel**: On/Off toggle
- **Advanced** (collapsible):
  - Clear Library Cache (with sub-options for likes, pins, accent colors)
  - Performance Profiler toggle
  - Visualizer Debug toggle
  - Per-provider data operations (export/import likes, refresh metadata, clear art cache)

### Visual Effects Controls Are NOT Here

The glow, visualizer style, visualizer speed/intensity, translucence, and accent color controls live on the **flip menu back** (`AlbumArtQuickSwapBack` > `QuickEffectsRow`), not in this settings drawer. The settings drawer is accessed via the gear icon; the flip menu is accessed by long-pressing or clicking the album art.

### Opening

- Gear icon in player controls
- `O` keyboard shortcut
- `showVisualEffects` state in `VisualEffectsContext` (transient, not persisted)

## Keyboard Shortcuts

| Key | Action | Handler location |
|-----|--------|-----------------|
| `V` | Cycle visualizer style (fireflies -> comet -> wave -> grid -> fireflies) | `PlayerControlsSection.tsx` `handleCycleVisualizerStyle` |
| `G` | Toggle glow (master visual effects toggle) | `PlayerControlsSection.tsx` `handleGlowToggle` |
| `T` | Toggle translucence | `PlayerControlsSection.tsx` `handleTranslucenceToggle` |
| `O` | Toggle settings menu | `PlayerControlsSection.tsx` `handleToggleVisualEffectsMenu` |
| `Z` | Toggle zen mode | `PlayerControlsSection.tsx` |

## Z-Index Stacking

From back to front:
1. `AccentColorBackground` -- `z-index: 0`, fixed
2. `BackgroundVisualizer` -- `z-index: 1`, fixed
3. `ContentWrapper` -- `z-index: 2`, relative
4. Drawers, modals, overlays -- higher z-indexes

## Cross-Cutting Concerns

| Feature | Interaction |
|---------|-------------|
| **ColorContext** | Provides `accentColor` used by glow overlay and accent background gradient |
| **Visualizers** | Speed multiplier and enabled/style/intensity flow from this context to `BackgroundVisualizer` |
| **Zen mode** | `zenModeEnabled` stored here; glow and translucence remain active in zen mode |
| **Flip menu** | Primary UI surface for effect controls (`QuickEffectsRow` in `AlbumArtQuickSwapBack`) |
| **Player sizing** | Settings drawer width adapts to viewport via `usePlayerSizingContext` |
| **Dropbox preferences sync** | Clearing accent colors triggers a Dropbox preferences sync reset |

## Key Files Summary

| File | Role |
|------|------|
| `src/contexts/VisualEffectsContext.tsx` | Central state provider for all visual effect settings |
| `src/hooks/useVisualEffectsState.ts` | Glow intensity/rate state with save/restore |
| `src/components/AccentColorGlowOverlay.tsx` | Pulsing glow layer behind album art |
| `src/components/AccentColorBackground.tsx` | Full-viewport accent color gradient |
| `src/components/VisualEffectsMenu/index.tsx` | Settings drawer (gear icon) |
| `src/components/AlbumArtQuickSwapBack.tsx` | Flip menu back face, hosts `QuickEffectsRow` |
| `src/components/controls/QuickEffectsRow.tsx` | Actual effect controls (glow, visualizer, translucence, accent color) |
| `src/styles/animations.ts` | `breatheGlow` keyframes for glow animation |
| `src/constants/storage.ts` | All localStorage key constants |
