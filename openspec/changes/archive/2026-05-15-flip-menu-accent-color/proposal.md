## Why

The flip-menu (`AlbumArtQuickSwapBack` → `QuickEffectsRow`) is the player's primary surface for tweaking visual effects (accent color, glow, background visualizer, translucence). Its `Switch` toggles already track the runtime `--accent-color` so they recolor per album, but its `OptionButton` pills (Glow Intensity / Rate, Visualizer Style / Intensity / Speed) and the active swatch border remain near-white because they consume the static shadcn `--primary` token and `theme.colors.white` respectively. The result is a visually inconsistent panel — half the active controls reflect the album's accent, half stay generic white — which undercuts the personality the rest of player chrome (BottomBar, LikeButton, TimelineSlider, glow) already projects.

This change also seeds the first-ever capability spec for the flip-menu surface itself. No `openspec/specs/<capability>/` describes it today, so future changes to glow / visualizer / translucence / accent-picking controls have no anchor to write against. Promoting the existing implementation into a `visual-effects-menu` spec gives subsequent work a contract to extend.

## What Changes

- Add a `variant: 'accent' | 'neutral'` prop to the shared `OptionButton` styled component (mirrors the existing `Switch` variant pattern), defaulting to `neutral` so non-flip-menu call sites (Quick Access Panel, Performance Profiler, Visualizer Debug toggles in the Settings drawer) keep their current static-white active state.
- In `QuickEffectsRow`, render every `OptionButton` with `variant="accent"` so the active pill's background/border tracks `var(--accent-color)` and its foreground uses `var(--accent-contrast-color)` for legibility on both light and dark accents.
- In `QuickEffectsRow`, change the active `SwatchButton`'s indicator from `theme.colors.white` to either rely on the existing `theme.colors.selection` outline alone, or fall back to an accent-tinted border if QA finds the outline too subtle.
- Seed `openspec/specs/visual-effects-menu/spec.md` (new capability) from the current implementation, plus the new accent-color theming requirement.

No public APIs, no keyboard shortcuts, no provider behavior, no playback behavior change.

## Capabilities

### New Capabilities

- `visual-effects-menu`: The flip-side panel behind the album art that exposes visual-effect toggles and their sub-settings (accent color, glow, background visualizer, translucence). This spec captures the existing surface plus the new requirement that every active control reflect the current accent color.

### Modified Capabilities

None.

## Impact

- `src/components/AppSettingsMenu/styled.ts` — `OptionButton` gains a `$variant` transient prop; default branch is unchanged.
- `src/components/controls/QuickEffectsRow.tsx` — every `OptionButton` call gets `variant="accent"`; `SwatchButton` active-state border changes from white to accent-aware (or relies on existing outline).
- `openspec/specs/visual-effects-menu/spec.md` — new file landed via archive.
- `src/components/SettingsV2/sections/__tests__/VisualizerStylePicker.test.tsx` and any `AppSettingsMenu` consumers of `OptionButton` — should remain untouched because the default variant preserves prior behavior.
- No effect on Settings v2 (`SettingsV2/sections/appearance/*`), the legacy Settings drawer (`AppSettingsMenu/index.tsx`), or any provider / playback / queue code path.
- No effect on mock-provider fixtures or Playwright snapshots beyond pixel differences in the flip-menu region.
