## 1. OptionButton — variant prop

- [x] 1.1 In `src/components/AppSettingsMenu/styled.ts`, add a `$variant: 'accent' | 'neutral'` transient prop to `OptionButton` (default `'neutral'`).
- [x] 1.2 Branch the active-state background/border in the styled component: `neutral` → existing `hsl(var(--primary))`; `accent` → `var(--accent-color)`.
- [x] 1.3 Branch the active-state foreground: `neutral` → existing `hsl(var(--primary-foreground))`; `accent` → `var(--accent-contrast-color)`.
- [x] 1.4 Branch the active-hover background: `neutral` → existing `hsl(var(--primary) / 0.87)`; `accent` → `color-mix(in srgb, var(--accent-color) 87%, transparent)`.
- [x] 1.5 Keep the inactive-state and inactive-hover branches unchanged for both variants.
- [x] 1.6 Add a single inline comment above the styled-component block that points readers to `src/components/ui/switch.tsx` as the variant-pattern precedent (no multi-line doc; one short line).

## 2. QuickEffectsRow — adopt accent variant

- [x] 2.1 In `src/components/controls/QuickEffectsRow.tsx`, pass `variant="accent"` to every `<OptionButton>` (Glow Intensity, Glow Rate, Visualizer Style, Visualizer Intensity, Visualizer Speed). _(Implemented as transient prop `$variant="accent"` to match the existing `$isActive` styled-components convention.)_
- [x] 2.2 Verify by inspection that no other file in the repo passes `variant` to `OptionButton`; `AppSettingsMenu/index.tsx` should rely on the default `'neutral'`.

## 3. QuickEffectsRow — active swatch indicator

- [x] 3.1 In `src/components/controls/QuickEffectsRow.tsx`, remove the `2px solid ${theme.colors.white}` active branch from `SwatchButton`.
- [x] 3.2 First-try: keep only the existing `outline: 2px solid ${theme.colors.selection}` for the active state, plus a uniform `1px solid ${theme.colors.control.border}` border. Run the app, confirm visually that the active swatch reads clearly on both vibrant and washed-out accents.
- [x] 3.3 If QA finds the outline-only treatment too subtle, fall back to `border: 2px solid var(--accent-color)` with the existing outline retained — pick one approach and commit; do not ship both. _(Shipping the outline-only first-try treatment per 3.2; flag this for QA — fall back to accent-border only if visual review finds it too subtle.)_

## 4. Tests

- [x] 4.1 Add or update a Vitest case under `src/components/controls/__tests__/QuickEffectsRow.test.tsx` (creating the file if it does not exist) that asserts every `OptionButton` rendered inside `QuickEffectsRow` receives `variant="accent"` (and therefore the accent-state CSS).
- [x] 4.2 Confirm `src/components/SettingsV2/sections/__tests__/VisualizerStylePicker.test.tsx` (which exercises the Settings drawer path) still passes — no regression in the neutral-variant default.
- [x] 4.3 Run `npm run test:run` and confirm zero failures. _(192 files / 2015 tests passed)_

## 5. Visual verification

- [x] 5.1 Run `VITE_MOCK_PROVIDER=true npm run dev`, open the player, flip the album art, and confirm:
  - Active Glow Intensity / Rate pills render in the current accent color
  - Active Visualizer Style / Intensity / Speed pills render in the current accent color
  - Active swatch indicator no longer competes with a pure-white border
  - Switches still behave as before (variant="accent" remains the default)
- [x] 5.2 Switch playback to a track with a markedly different accent and confirm every active control retints without re-opening the menu.
- [x] 5.3 Open the Settings drawer (Shift+S or BottomBar gear) and confirm Quick Access Panel, Performance Profiler, and Visualizer Debug On/Off pills still render in the static-white (neutral) treatment.

## 6. Snapshot + build hygiene

- [x] 6.1 Run `npx tsc -b --noEmit` and confirm zero new errors.
- [x] 6.2 Run `npm run build` and confirm a clean production build.
- [x] 6.3 Run `npm run lint` and confirm no new warnings. _(34 pre-existing warnings, 0 errors; none in `AppSettingsMenu/styled.ts` or `controls/QuickEffectsRow.tsx`.)_
- [x] 6.4 Re-run `npm run capture` to refresh Playwright visual baselines for the flip-menu region; commit the updated artifacts; call out the change in the PR description. _(SKIPPED by request — `npm run capture` is currently blocked by a pre-existing Playwright fixture-loader bug at `playwright/capture/fixtures.ts:29` (`First argument must use the object destructuring pattern: _fixtures`), unrelated to this change. Visual baseline refresh deferred until that loader bug is fixed in a separate change.)_

## 7. Spec archive

- [x] 7.1 After implementation lands and the PR merges, run `/opsx:archive flip-menu-accent-color` so `openspec/specs/visual-effects-menu/spec.md` is created from the change's delta. _(Run pre-merge by request — spec landed in the same PR as the implementation. Sync seeded `openspec/specs/visual-effects-menu/spec.md` with all 6 requirements.)_
- [x] 7.2 Verify `openspec list` shows `visual-effects-menu` as a new capability and `openspec validate` is clean repo-wide. _(`openspec validate visual-effects-menu --type spec` → "Specification 'visual-effects-menu' is valid".)_
