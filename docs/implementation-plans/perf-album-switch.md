# Performance: Album Switch Slowness

## Background

A Chrome DevTools performance trace (`Trace-20260314T140809.json`, 62 MB) revealed ~874ms of main-thread blocking time during a single album switch. The trace was analyzed and four distinct root causes were identified.

---

## Root Causes (ranked by impact)

### 1. styled-components CSS injection storm (~60–70% of blocking time)

**What happens:** `accentColor` is stored in `ColorContext` as React state. It is passed as a `$accentColor` transient prop to ~15 styled-components across 6 files. Every time `accentColor` changes (on every album switch), styled-components generates a new CSS class hash for each affected component and calls `CSSStyleSheet.insertRule()` to inject it — one call per component per change.

The trace shows a **353ms task** and a **135ms task** that are 75–88% `insertRule()` / `insertBefore()` calls. The CSSOM also accumulates stale rules and never cleans them up, so this degrades with each successive switch.

Affected styled-components:
- `src/components/LikeButton.tsx` — `StyledLikeButton`
- `src/components/controls/VolumeControl.tsx` — 1+ components
- `src/components/AccentColorBackground.tsx` — 1 component
- `src/components/AccentColorGlowOverlay.tsx` — 1 component
- `src/components/VisualEffectsMenu/styled.ts` — `CollapsibleHeader`, `ResetButton`, `ProviderButton` (×2), `ProviderStatusDot`, `CacheCheckbox`, `CacheCancelButton`, `OptionButton`
- `src/components/controls/styled.ts` — check for `$accentColor` usage

**Fix:** Replace `$accentColor` styled-component props with a single CSS custom property. Set `--accent-color` on `:root` via `document.documentElement.style.setProperty('--accent-color', color)` whenever the accent color changes. Update all `${({ $accentColor }) => $accentColor}` interpolations to `var(--accent-color)` and remove the typed prop interface entries.

The CSS custom property update is a single synchronous DOM write with zero CSS hash regeneration. The CSSOM accumulation problem disappears entirely.

---

### 2. Color extraction cascade triggers 3 separate render passes (~15–20% of blocking time)

**What happens:** After `img.onload` fires in the album art component, `extractDominantColor` runs (via `imageProcessor.worker`), then `setAccentColor` is called inside `startTransition`. Despite the transition wrapper, the trace shows **three consecutive React render passes** of 72ms, 71ms, and 55ms that fire in rapid sequence within ~200ms. Each pass re-renders a wide component tree and re-triggers the CSS injection described above.

The current flow in `useAccentColor.ts:127`:
```
img.onload → extractDominantColor() → worker result → startTransition(setAccentColor)
```

**Fix:** Two changes:
1. After fixing root cause #1, this cascade will be much cheaper (a single DOM write instead of 15 CSS injections). The 3 render passes will still occur but will be fast.
2. Optionally, wrap the worker callback in `requestIdleCallback` to defer the color extraction to when the main thread is free, since accent color is purely cosmetic and doesn't affect playback. This prevents the color update from competing with the track-switch render.

---

### 3. `PlaylistSelection` and `LibraryDrawer` re-rendering on every track switch

**What happens:** The trace shows `PlaylistSelection.tsx` calling `renderAlbumGrid` and `filterAndSortAlbums` on each album switch, and `LibraryDrawer` re-rendering alongside it. Neither component needs to re-render when only the current track changes — they display the catalog, not playback state.

**Fix:** Audit what context/props these components subscribe to. Narrow their dependencies:
- If they consume a large context object (e.g., `useColorContext` or a combined player context), split context or use `useMemo`/`useCallback` to stabilize references.
- Wrap both with `React.memo` with a custom comparison function that ignores `currentTrack` changes if those props are being passed down.
- Ensure `filterAndSortAlbums` and `renderAlbumGrid` are memoized with `useMemo` keyed only on catalog/filter state, not on the current track.

---

### 4. `usePlayerSizing` instantiated 7 times independently

**What happens:** `usePlayerSizing` is called directly in 7 components: `PlayerContent`, `SpotifyPlayerControls`, `PlaylistDrawer`, `BottomBar`, `AlbumArt`, `VisualEffectsMenu`, `TimelineSlider`, and `PlaylistSelection`. Each instance sets up its own resize listener and maintains its own `viewport`/`dimensions` state. On resize, all 7 fire state updates independently.

During album switch this is less critical (viewport doesn't change), but it means 7 hook instances doing redundant work on every resize, and it contributes to render breadth generally.

**Fix:** Lift `usePlayerSizing` into a `PlayerSizingContext` (or merge into an existing layout context). Instantiate the hook once at a high level (e.g., in `AudioPlayer` or `PlayerContent`) and provide results via context. Replace the 7 direct `usePlayerSizing()` calls with `usePlayerSizingContext()`.

---

## Implementation Order

Implement in this order for maximum incremental gain with safe rollback:

### Phase 1 — CSS custom property (highest leverage, self-contained)

1. Add a `useAccentColorCssVar` effect to `ColorContext.tsx` (or a new small hook) that calls `document.documentElement.style.setProperty('--accent-color', accentColor)` whenever `accentColor` state changes.
2. Set the initial value for `--accent-color` in `src/styles/global.css` (or inline in `index.html`) to match `theme.colors.accent` so there's no flash before React mounts.
3. In each affected styled-component, replace `${({ $accentColor }) => $accentColor}` with `var(--accent-color)`. Remove the `$accentColor` prop from the component's TypeScript interface and from all call sites.
4. Files to update:
   - `src/components/LikeButton.tsx`
   - `src/components/controls/VolumeControl.tsx`
   - `src/components/AccentColorBackground.tsx`
   - `src/components/AccentColorGlowOverlay.tsx`
   - `src/components/VisualEffectsMenu/styled.ts`
   - `src/components/controls/styled.ts` (verify if applicable)
5. After each file, run `npx tsc --noEmit` to catch removed prop references.

> Expected result: the 353ms and 135ms blocking tasks shrink to <5ms.

### Phase 2 — Defer color extraction with `requestIdleCallback`

1. In `useAccentColor.ts`, wrap the `setAccentColor` call inside the worker callback with `requestIdleCallback` (with a `timeout: 500` fallback for browsers without support).
2. This keeps the track-switch render and color extraction on separate frames.

> Expected result: eliminates the 3-pass render cascade competing with the initial track-switch render.

### Phase 3 — Memoize PlaylistSelection and LibraryDrawer

1. Read `PlaylistSelection.tsx` and `LibraryDrawer.tsx` to determine exactly which context values trigger re-renders.
2. If they consume `accentColor` from `ColorContext` (post-phase-1, this reference will still change in React state), verify they actually need it — if only for styling, the CSS var eliminates that need and the context subscription can be removed.
3. Wrap exports with `React.memo`.
4. Memoize expensive internal computations (`filterAndSortAlbums`, `renderAlbumGrid`) using `useMemo`.

### Phase 4 — Consolidate `usePlayerSizing` into context

1. Create `src/contexts/PlayerSizingContext.tsx` that wraps a single `usePlayerSizing()` call and provides results via context.
2. Add `<PlayerSizingProvider>` at the `AudioPlayer` level.
3. Replace the 7 direct `usePlayerSizing()` calls with `usePlayerSizingContext()`.
4. Update tests that may mock or depend on `usePlayerSizing` directly.

---

## Files Affected

| File | Change |
|------|--------|
| `src/contexts/ColorContext.tsx` | Add CSS custom property side-effect |
| `src/styles/global.css` or `index.html` | Set initial `--accent-color` value |
| `src/components/LikeButton.tsx` | Remove `$accentColor` prop, use `var(--accent-color)` |
| `src/components/controls/VolumeControl.tsx` | Same |
| `src/components/AccentColorBackground.tsx` | Same |
| `src/components/AccentColorGlowOverlay.tsx` | Same |
| `src/components/VisualEffectsMenu/styled.ts` | Same (8 components) |
| `src/components/controls/styled.ts` | Same (if applicable) |
| `src/hooks/useAccentColor.ts` | Add `requestIdleCallback` around worker callback |
| `src/components/PlaylistSelection.tsx` | `React.memo`, memoize filtering |
| `src/components/LibraryDrawer.tsx` | `React.memo`, narrow context subscriptions |
| `src/contexts/PlayerSizingContext.tsx` | New file |
| `src/components/PlayerContent.tsx` | Use context instead of hook directly |
| `src/components/SpotifyPlayerControls.tsx` | Same |
| `src/components/PlaylistDrawer.tsx` | Same |
| `src/components/BottomBar/index.tsx` | Same |
| `src/components/AlbumArt.tsx` | Same |
| `src/components/VisualEffectsMenu/index.tsx` | Same |
| `src/components/TimelineSlider.tsx` | Same |
| `src/components/PlaylistSelection.tsx` | Same |

---

## Verification

After Phase 1, record a new DevTools trace for album switch. The 353ms and 135ms tasks should be gone. Total blocking time should drop from ~874ms to under 100ms.

After all phases, the album switch interaction should complete within one to two frames (~32ms) with no tasks exceeding 50ms.

Run `npm run test:run` after each phase before committing.
