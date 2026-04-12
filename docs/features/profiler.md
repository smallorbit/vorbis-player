# Profiling and Debug Tools

The app has four independent debug/profiling systems. They are activated differently and serve different purposes.

## 1. Performance Profiler

### What It Does

Wraps React components in `React.Profiler` boundaries to collect render timing data. Also tracks FPS, long tasks (via `PerformanceObserver`), and JS heap memory (Chrome only).

### Activation

Three ways to enable:
- Settings drawer: Advanced > Performance Profiler > On
- URL parameter: `?profile=true`
- Keyboard: `Ctrl+Shift+P`

State is persisted in localStorage at `vorbis-player-profiling` (raw string `'true'`/`'false'`, not JSON).

### Architecture

**Context**: `src/contexts/ProfilingContext.tsx`

- `ProfilingProvider` wraps the app (in `src/App.tsx` via context providers)
- `useProfilingContext()` returns `{ enabled, collector, toggle }`
- When disabled, `collector` is `null` and `ProfiledComponent` renders children without a `React.Profiler` wrapper (zero overhead)

**Collector**: `MetricsCollector` class (private to `ProfilingContext.tsx`)

Tracks:
- **Component renders**: count, mount vs update, average/max duration, "unnecessary renders" (heuristic: `actualDuration / baseDuration > 0.8`)
- **Context updates**: count and last-update timestamp per context name (via `recordContextUpdate`)
- **Operations**: named timed operations (via `recordOperation`)
- **FPS**: sampled every 1 second via `requestAnimationFrame` loop
- **Long tasks**: count, total duration, max duration via `PerformanceObserver({ entryTypes: ['longtask'] })`
- **Memory**: `performance.memory.usedJSHeapSize` (Chrome-only, non-standard)

Note: `recordContextUpdate` and `recordOperation` are available on the collector API but currently only `recordRender` is called (from `ProfiledComponent`). The context update and operation tracking infrastructure exists but has no active callers in production code.

**Instrumented components** (`ProfiledComponent` wrapper):

| Profiler ID | Location |
|---|---|
| `app-settings-menu` | `VisualEffectsMenu/index.tsx` |
| `PlayerStateRenderer` | `AudioPlayer.tsx` |
| `PlayerContent` | `AudioPlayer.tsx` |
| `AccentColorBackground` | `AudioPlayer.tsx` |
| `BackgroundVisualizer` | `AudioPlayer.tsx` |
| `QueueBottomSheet` | `PlayerContent/DrawerOrchestrator.tsx` |
| `QueueDrawer` | `PlayerContent/DrawerOrchestrator.tsx` |
| `LibraryDrawer` | `PlayerContent/DrawerOrchestrator.tsx` |
| `SpotifyPlayerControls` | `PlayerContent/PlayerControlsSection.tsx` |
| `BottomBar` | `PlayerContent/PlayerControlsSection.tsx` |
| `AlbumArt` | `PlayerContent/AlbumArtSection.tsx` |

### Overlay

Component: `src/components/ProfilingOverlay.tsx`

Fixed-position panel at top-left (`z-index: 999980`). Polls the collector every 500ms. Shows:
- Total render count
- Render heatmap table (top 15 components by render count, color-coded: green < 4ms, yellow < 16ms, red >= 16ms)
- Context update counts
- FPS (current, average, min)
- Heap size (Chrome only)
- Long task count and max duration
- Recent render events (last 20)
- Buttons: Reset, Export JSON, Copy to clipboard

### Mutual Exclusivity with Visualizer Debug

Enabling the profiler disables visualizer debug mode. Enabling visualizer debug disables the profiler. This is enforced in `PlayerControlsSection.tsx`:

```ts
const handleProfilerToggle = useCallback(() => {
  if (!profilerEnabled) {
    vizDebugCtx?.setIsDebugMode(false);
  }
  profilerToggle();
}, [profilerEnabled, profilerToggle, vizDebugCtx]);

const handleVisualizerDebugToggle = useCallback(() => {
  if (!visualizerDebugEnabled && profilerEnabled) {
    profilerToggle();
  }
  vizDebugCtx?.setIsDebugMode(prev => !prev);
}, [visualizerDebugEnabled, profilerEnabled, profilerToggle, vizDebugCtx]);
```

## 2. Visualizer Debug Panel

### What It Does

Live-editable parameter sliders for the Fireflies (particle) and Comet (trail) background visualizers. Allows tuning visual parameters without code changes, with export/import of configurations.

### Activation

URL parameter only: `?debug=visualizer`

The panel also toggleable from Settings > Advanced > Visualizer Debug (which sets `isDebugMode` on the context, though the URL param is the primary trigger).

### Architecture

**Context**: `src/contexts/VisualizerDebugContext.tsx`

- `VisualizerDebugProvider` wraps the app
- `useVisualizerDebug()` returns full context or `null` if outside provider
- `useVisualizerDebugConfig()` returns `VisualizerDebugConfig` -- defaults when debug is off, merged config when on
- Overrides are persisted in localStorage at `vorbis-player-visualizer-debug-overrides`

**Panel**: `src/components/VisualizerDebugPanel/index.tsx`

Fixed panel with collapsible sections for Fireflies and Comet parameters. Each parameter has a slider + number input. Supports:
- Reset to defaults
- Copy JSON to clipboard
- Download JSON file
- Load config from pasted JSON

**Config source**: `src/constants/visualizerDebugConfig.ts` -- `DEFAULT_VISUALIZER_DEBUG_CONFIG`, `mergeVisualizerConfig()`, type definitions.

**Consumers**: All four visualizer components (`ParticleVisualizer`, `TrailVisualizer`, `WaveVisualizer`, `GridWaveVisualizer`) read from `useVisualizerDebugConfig()`.

### Not a Profiler

Despite being in the "Advanced" settings section alongside the profiler, this panel is a visual design tool, not a performance tool. It does not measure performance.

## 3. Debug Overlay

### What It Does

Captures `console.warn` and `console.error` output into an in-app log viewer. Useful on devices where browser devtools are unavailable (e.g., mobile).

### Activation

Two ways:
- URL parameter: `?debug=true`
- 5 rapid taps on the album art area (tap-to-activate gesture via `useDebugActivator`)

State persisted at `vorbis-player-debug-overlay` (raw string).

### Architecture

File: `src/components/DebugOverlay.tsx`

- `useDebugActivator()` hook: tracks tap timestamps, toggles after 5 taps within 2 seconds
- `DebugOverlay` component: patches `console.warn` and `console.error` to capture output. Shows a fixed badge (bottom-left, `z-index: 999999`) with log count; click to expand full-screen log viewer
- Max 200 log entries retained
- Buttons: Close, Clear, Copy all

### Not Connected to Profiler

The debug overlay and the performance profiler are independent systems. The overlay captures console output; the profiler tracks React render performance.

## 4. Debug Logging (debug package)

### What It Does

Structured trace logging for specific subsystems using the `debug` npm package. Silent by default.

### Activation

In browser console:
```js
localStorage.debug = 'vorbis:*';    // all namespaces
localStorage.debug = 'vorbis:queue'; // specific namespace
location.reload();                   // required to take effect
```

Disable: `localStorage.removeItem('debug'); location.reload()`

In Node (tests): `DEBUG=vorbis:* npm run test:run`

### Available Namespaces

Defined in `src/lib/debugLog.ts`:

| Export | Namespace | Used For |
|---|---|---|
| `logQueue` | `vorbis:queue` | Queue mutations and state changes |
| `logSpotify` | `vorbis:spotify` | Spotify API calls and SDK events |
| `logRadio` | `vorbis:radio` | Radio generation and track matching |
| `logDropboxSync` | `vorbis:dropbox-sync` | Dropbox sync operations |
| `logApp` | `vorbis:app` | General app lifecycle events |
| `logSw` | `vorbis:sw` | Service worker events |
| `logLibrary` | `vorbis:library` | Library loading and caching |
| `logSession` | `vorbis:session` | Session persistence |

### Relationship to Other Tools

`console.warn`/`console.error` calls always print regardless of debug settings. These are captured by the Debug Overlay when active.

The `debug` package outputs via `console.debug` (or `console.log` depending on the environment), which the Debug Overlay does NOT capture (it only hooks `warn` and `error`).

## 5. DevBug (Visual Feedback Tool)

### What It Does

A floating action button (FAB) with three modes for visual bug reporting: element inspection, area selection, and screenshot annotation.

### Activation

localStorage key: `vorbis-player-devbug` (default `false`). Set to `true` and reload. There is no UI toggle for this in the settings panel.

### Architecture

- Context: `src/contexts/DevBugContext.tsx` -- `DevBugProvider`, `useDevBug()`
- Components: `src/components/DevBug/` directory
- Entry: `DevBugFAB` renders via `createPortal` to `document.body` at `z-index: 2147483647`
- Conditionally rendered in `App.tsx`: `{devbugEnabled && <DevBugFAB />}`

This is a development/QA tool, not a performance profiler.

## Key Files Summary

| File | System |
|---|---|
| `src/contexts/ProfilingContext.tsx` | Profiler context, MetricsCollector class |
| `src/components/ProfiledComponent.tsx` | React.Profiler wrapper component |
| `src/components/ProfilingOverlay.tsx` | Profiler HUD overlay |
| `src/contexts/VisualizerDebugContext.tsx` | Visualizer debug context and config |
| `src/components/VisualizerDebugPanel/index.tsx` | Visualizer parameter editor |
| `src/constants/visualizerDebugConfig.ts` | Default visualizer parameters |
| `src/components/DebugOverlay.tsx` | Console capture overlay |
| `src/lib/debugLog.ts` | Debug package namespace exports |
| `src/contexts/DevBugContext.tsx` | DevBug context |
| `src/components/DevBug/` | DevBug visual feedback components |
