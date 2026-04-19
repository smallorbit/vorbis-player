# Background Visualizers

Four canvas-based animated backgrounds that render behind the player UI. Each is a React component in `src/components/visualizers/` that implements a shared contract via the `useCanvasVisualizer<T>` hook.

## Visualizer Styles

| Style key | Component | File | Item type `T` | Description |
|-----------|-----------|------|---------------|-------------|
| `fireflies` | `ParticleVisualizer` | `src/components/visualizers/ParticleVisualizer.tsx` | `Particle` | Drifting circles with pulsing radius and opacity |
| `comet` | `TrailVisualizer` | `src/components/visualizers/TrailVisualizer.tsx` | `TrailParticle` | A "ship" moves along a curving path, spawning trail particles that fade |
| `wave` | `WaveVisualizer` | `src/components/visualizers/WaveVisualizer.tsx` | `Wave` | Layered sine waves rendered as filled regions from wave crest to canvas bottom |
| `grid` | `GridWaveVisualizer` | `src/components/visualizers/GridWaveVisualizer.tsx` | `GridWaveState` | A dot grid displaced by traveling sine waves |

The type union is `VisualizerStyle` in `src/types/visualizer.ts`:

```ts
export type VisualizerStyle = 'fireflies' | 'comet' | 'wave' | 'grid';
```

## The `useCanvasVisualizer<T>` Hook

**File**: `src/hooks/useCanvasVisualizer.ts`

This is the core abstraction. It implements a Template Method pattern: the hook owns the canvas lifecycle (sizing, animation loop, resize handling), and each visualizer provides four callbacks that define its specific behavior.

### Interface

```ts
interface UseCanvasVisualizerProps<T> {
  accentColor: string;
  isPlaying: boolean;
  intensity: number;
  getItemCount: (width: number, height: number, intensity: number) => number;
  initializeItems: (count: number, width: number, height: number, color: string) => T[];
  updateItems: (items: T[], deltaTime: number, isPlaying: boolean, width: number, height: number) => void;
  renderItems: (ctx: CanvasRenderingContext2D, items: T[], width: number, height: number, intensity: number) => void;
  onColorChange: (items: T[], color: string) => void;
}
```

### Return Value

Returns `React.RefObject<HTMLCanvasElement>`. The caller attaches this to a `<canvas>` element.

### Lifecycle

1. **Initialization** (runs on mount and when `accentColor` or `intensity` changes):
   - Sets `canvas.width = window.innerWidth`, `canvas.height = window.innerHeight`
   - Calls `getItemCount(width, height, intensity)` to determine how many items to create
   - Calls `initializeItems(count, width, height, accentColor)` to populate `itemsRef`
   - Adds a `resize` listener that re-runs the above

2. **Animation loop** (via `useAnimationFrame`):
   - Computes `deltaTime` from `performance.now()` timestamps
   - Skips frames where `deltaTime > 1000` (tab was hidden/backgrounded)
   - Calls `updateItems(items, deltaTime, isPlaying, width, height)`
   - Calls `renderItems(ctx, items, width, height, intensity)`

3. **Cleanup**: Removes resize listener; `useAnimationFrame` cancels `requestAnimationFrame`.

### Invariants and Gotchas

- **Re-initialization on color change**: When `accentColor` changes, the entire item array is re-created (the effect depends on `accentColor`). The `onColorChange` callback is declared in the interface but **not called** by the hook -- it exists for future incremental color updates. Currently, color changes trigger full re-init.
- **Canvas sizing uses `window.innerWidth/Height`**, not CSS dimensions. The canvas element is styled `width: 100%; height: 100%` with `display: block`. The pixel dimensions are set imperatively on the canvas element, so there is **no DPI scaling** (`devicePixelRatio` is not applied). This means on high-DPI screens, the canvas renders at 1x resolution, which is intentional for performance -- these are ambient backgrounds, not crisp UI elements.
- **Delta time normalization**: All visualizers normalize deltaTime by dividing by 16 (`dt = deltaTime / 16`), treating 16ms (~60fps) as the baseline.
- **`useAnimationFrame`** (`src/hooks/useAnimationFrame.ts`) wraps `requestAnimationFrame` with cleanup. It skips the first frame to establish a baseline timestamp. The `callback` is a dependency of its internal effect, so it must be stable (wrapped in `useCallback`).

## `BackgroundVisualizer` Component

**File**: `src/components/BackgroundVisualizer.tsx`

This is the switching layer that renders the correct visualizer based on the selected style.

### Props

```ts
interface BackgroundVisualizerProps {
  enabled: boolean;
  style: VisualizerStyle;
  intensity: number;         // 0-100, from VisualEffectsContext
  speed?: number;            // multiplier, default 1.0
  accentColor: string;       // hex color from current track
  isPlaying: boolean;
  albumArtBounds?: AlbumArtBounds | null;  // only used by 'comet' style
}
```

### Layout Positioning

Wrapped in a `VisualizerContainer` styled-component:
- `position: fixed; top: 0; left: 0; right: 0; bottom: 0`
- `z-index: 1` (below ContentWrapper at z-index 2, above AccentColorBackground at z-index 0)
- `pointer-events: none` -- never intercepts clicks
- `overflow: hidden`

### Wiring in AudioPlayer

`BackgroundVisualizer` is rendered in `src/components/AudioPlayer.tsx`. It receives:
- `enabled` = `backgroundVisualizerEnabled && isMainPlayerActive`
- `style`, `intensity`, `speed` from `VisualEffectsContext`
- `accentColor` from `ColorContext`
- `isPlaying` from player state

Note: `albumArtBounds` is declared in the props interface but is **not currently wired** from `AudioPlayer`. The `TrailVisualizer` supports it (constraining the ship to the album art rect) but falls back to viewport center when not provided.

## Per-Visualizer Details

### Fireflies (`ParticleVisualizer`)

- Each particle has position, velocity, radius, opacity, color, and a pulse phase
- Particles wrap around screen edges (toroidal topology)
- Pulse cycle modulates radius and opacity sinusoidally
- When paused, speed drops to `pausedSpeed` multiplier (default 0.3)
- Color variants generated via `generateColorVariant(baseColor, random)` from `src/utils/visualizerUtils.ts`

### Comet (`TrailVisualizer`)

- Maintains a `ShipState` ref (position, angle, velocity) separate from the particle array
- Ship follows a curving path with random turn rate and wobble
- Trail particles spawn at the ship position, move opposite to ship velocity with perpendicular spread, and fade via `life` countdown
- If `albumArtBounds` is provided, the ship is clamped within the bounds (with 8% inset)
- If no bounds, ship wraps at screen edges with 40px margin
- Ship renders a white radial glow at its position (controlled by `glowRadius` config param)
- Viewport scale factor: `Math.max(0.5, Math.sqrt(width / 1400))` adjusts ship speed for screen size

### Wave (`WaveVisualizer`)

- Creates `waveCount` (default 7) layered sine waves
- Each wave has a unique phase speed distributed via golden ratio (`PHI^(i/count*2)`)
- Waves render back-to-front as filled shapes from the sine curve down to the bottom of the canvas
- `yBase` distributes waves vertically across the canvas (`yBaseStart` to `yBaseStart + yBaseLayerScale`)
- Amplitude scales by 0.65x on mobile (`width < 768`)
- Item count is fixed (always `waveCount`), not dependent on screen area

### Grid (`GridWaveVisualizer`)

- Creates a grid of dots at regular spacing (35px desktop, 22px mobile)
- Multiple `WaveState` objects (default 2) travel through the grid
- Dot displacement is the average of all wave sine projections
- Edge and depth factors create a perspective-like intensity gradient
- **Unusual `T` usage**: The generic type is `GridWaveState[]` but the hook always creates a single-element array (`[{ particles, waves, width, height }]`). The hook's `getItemCount` returns 1 (mobile or desktop), and `initializeItems` returns one `GridWaveState` containing all grid particles and wave states. This is a pattern to pack multiple data structures into the generic slot.
- `void count` on line 87 suppresses the unused-parameter warning for the count arg

## Debug Panel System

### Files
- `src/components/VisualizerDebugPanel/index.tsx` -- the panel UI
- `src/components/VisualizerDebugPanel/styled.ts` -- styled-components for the panel
- `src/contexts/VisualizerDebugContext.tsx` -- context provider and hooks
- `src/constants/visualizerDebugConfig.ts` -- default config values and types

### Activation

The debug panel activates when the URL contains `?debug=visualizer`. This is checked by `isDebugModeEnabled()` in `VisualizerDebugContext.tsx`. It can also be toggled via the Settings menu (Advanced > Visualizer Debug On/Off), which calls `vizDebugCtx.setIsDebugMode()`.

Profiler and Visualizer Debug are mutually exclusive: enabling one disables the other (see `handleVisualizerDebugToggle` and `handleProfilerToggle` in `PlayerControlsSection.tsx`).

### Config Architecture

`VisualizerDebugConfig` has four sections: `particle`, `trail`, `wave`, `grid`. Each maps to a visualizer's tunable parameters.

```ts
interface VisualizerDebugConfig {
  particle: ParticleVisualizerConfig;  // 14 params
  trail: TrailVisualizerConfig;        // 20 params
  wave: WaveVisualizerConfig;          // 12 params
  grid: GridWaveVisualizerConfig;      // 17 params
}
```

Default values are in `DEFAULT_VISUALIZER_DEBUG_CONFIG` (exported from `visualizerDebugConfig.ts`).

### Override Flow

1. Visualizers call `useVisualizerDebugConfig()` which returns:
   - `DEFAULT_VISUALIZER_DEBUG_CONFIG` when debug mode is off
   - Merged config (defaults + overrides) when debug mode is on
2. Overrides are stored in localStorage under `STORAGE_KEYS.VISUALIZER_DEBUG_OVERRIDES` (`vorbis-player-visualizer-debug-overrides`)
3. `mergeVisualizerConfig()` does a shallow merge per section (override keys replace defaults, unset keys keep defaults)
4. The debug panel exposes per-param sliders for `particle` and `trail` sections only (wave and grid are not yet in the panel UI but their overrides are loaded/saved)

### Export/Import

The panel supports:
- **Copy JSON** / **Download JSON**: Exports the full merged config
- **Load from JSON**: Accepts either a full `VisualizerDebugConfig` or partial `VisualizerDebugOverrides`
- **Reset to defaults**: Clears localStorage overrides

## Mobile Considerations

- Particle counts are reduced on mobile (`width < 768`) via separate `countBaseMobile` and `countPixelDivisorMobile` params
- Wave amplitude scales to 0.65x on mobile
- Grid spacing decreases from 35px to 22px on mobile
- All visualizers run at 1x canvas resolution (no `devicePixelRatio` scaling) which helps performance
- The `requestAnimationFrame` loop runs continuously when enabled; there is no frame-skipping or throttling beyond the browser's own vsync

## Album Art Exclusion Zones

Only the `comet` (TrailVisualizer) style has explicit album art awareness via `albumArtBounds`. When provided, the ship is clamped within the album art rect (with 8% inset). Other visualizers draw over the entire viewport, but since they render at `z-index: 1` behind `ContentWrapper` at `z-index: 2`, they appear behind the player UI including album art.

There is no pixel-level exclusion zone system. The visual separation relies entirely on z-index layering.

## Cross-Cutting Concerns

| Feature | Interaction |
|---------|-------------|
| **VisualEffectsContext** | Provides `backgroundVisualizerEnabled`, `backgroundVisualizerStyle`, `backgroundVisualizerIntensity`, `backgroundVisualizerSpeed` |
| **ColorContext** | Provides `accentColor` (extracted from current track's album art) |
| **Keyboard shortcuts** | `V` key cycles through visualizer styles (via `handleCycleVisualizerStyle` in `PlayerControlsSection.tsx`) |
| **Flip menu** | Back of album art card (`AlbumArtQuickSwapBack` > `QuickEffectsRow`) has style selector, intensity slider, speed slider, and enable/disable toggle |
| **Zen mode** | Visualizers continue running in zen mode; no special behavior |
| **Playback state** | All visualizers slow down when `isPlaying` is false (each has a `pausedSpeed`/`pausedSpeedMult` config) |
| **Tab visibility** | `useCanvasVisualizer` skips frames with `deltaTime > 1000ms` to avoid large jumps when returning from a hidden tab |

## Key Files Summary

| File | Role |
|------|------|
| `src/types/visualizer.ts` | `VisualizerStyle` type definition |
| `src/hooks/useCanvasVisualizer.ts` | Generic canvas lifecycle hook (Template Method) |
| `src/hooks/useAnimationFrame.ts` | `requestAnimationFrame` wrapper with cleanup |
| `src/components/BackgroundVisualizer.tsx` | Style switcher component |
| `src/components/visualizers/ParticleVisualizer.tsx` | Fireflies implementation |
| `src/components/visualizers/TrailVisualizer.tsx` | Comet implementation |
| `src/components/visualizers/WaveVisualizer.tsx` | Wave implementation |
| `src/components/visualizers/GridWaveVisualizer.tsx` | Grid implementation |
| `src/constants/visualizerDebugConfig.ts` | Default config values, types, merge function |
| `src/contexts/VisualizerDebugContext.tsx` | Debug mode state, override persistence |
| `src/components/VisualizerDebugPanel/index.tsx` | Debug panel UI |
| `src/utils/visualizerUtils.ts` | `generateColorVariant()` color utility |
| `src/components/AudioPlayer.tsx` | Renders `BackgroundVisualizer` with props from context |
