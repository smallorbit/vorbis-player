# active-swatch-accent-outline

## Why

The flip-menu accent-color swatch row renders its active-state outline in a static gold (`theme.colors.selection` → `#ffd700`). Every other active control in the VFX flip menu already follows the spec requirement "Active Controls Reflect Current Accent Color" by deriving its active state from `--accent-color` / `--accent-contrast-color`. The active swatch is the lone holdout; it visually clashes with the accent and reads as generic chrome instead of as an extension of the current album's identity.

The selection-gold outline arrived in commit `b1e72ac` ("feat(visual-effects-menu): tint flip-menu controls with current accent"), whose body notes "leaving the existing selection outline as the sole indicator". The visual-effects-menu spec — authored around the same time — nevertheless enumerates the active swatch indicator as a control that MUST render its active state via `--accent-color`. The implementation drifted from the spec. This change resolves the drift in favor of the spec.

## What Changes

- Replace the static `theme.colors.selection` outline on the active swatch button with an accent-derived outline.
  - Use `var(--accent-contrast-color)` (already populated alongside `--accent-color` by `ColorContext`) because the swatch's own fill *is* the accent when active — `var(--accent-color)` would render an invisible outline.
  - The visual-effects-menu spec's "Active Controls Reflect Current Accent Color" requirement explicitly permits derived values such as `--accent-contrast-color` for foreground/marker roles.
- Clarify the visual-effects-menu spec to call out that the active swatch outline uses the accent-contrast color (not raw `--accent-color`), to lock in the rationale and prevent regression to the same gold-outline state.

## Impact

- Affected specs: `visual-effects-menu` (Requirement: Active Controls Reflect Current Accent Color — adds a swatch-specific contrast-color clarification).
- Affected code: `src/components/controls/QuickEffectsRow.tsx` (single-line change at line 76).
- `theme.colors.selection` itself stays — searched usages confirm the swatch outline was its only call site in `src/`, but the token is retained because it's a generic UI-state token and removing it is out of scope.
- No behavioral change for any other VFX menu control.
- No global accent-color plumbing changes.
- Closes #1559.
