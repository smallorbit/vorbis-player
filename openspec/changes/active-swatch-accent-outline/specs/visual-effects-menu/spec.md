# visual-effects-menu Spec Delta

## MODIFIED Requirements

### Requirement: Active Controls Reflect Current Accent Color

Every control in the flip menu that exposes an active visual state — Glow Intensity / Rate pills, Visualizer Style / Intensity / Speed pills, the Glow / Visualizer / Translucence switch tracks, and the active swatch indicator — SHALL render its active state using the current `--accent-color` (or a value derived from it, such as `--accent-contrast-color` for foregrounds). Inactive states MAY remain neutral. When the current track changes and the accent color is recomputed, every active control's color SHALL update accordingly without user input.

The active-swatch indicator is a special case: the swatch fill itself *is* the candidate accent color, so an outline in `--accent-color` would be invisible against the active swatch. The active-swatch outline SHALL therefore use `var(--accent-contrast-color)` (the WCAG-passing contrast color paired with `--accent-color` and updated together by `ColorContext`). It SHALL NOT use a static UI-state color (e.g. the legacy `theme.colors.selection` gold).

Rationale: the flip menu is the per-album personalization surface, so its active-state styling should read as an extension of the album's identity rather than as generic chrome.

#### Scenario: Active option-button pill reflects accent

- **WHEN** the user opens the flip menu while a track with a known accent color is playing
- **THEN** the currently-selected Glow Intensity / Rate / Visualizer Style / Intensity / Speed pill renders with its background, border, and foreground driven by the current accent color and its derived contrast color

#### Scenario: Switch tracks reflect accent

- **WHEN** the Glow, Visualizer, or Translucence switch is in the on state
- **THEN** the switch track renders in the current accent color

#### Scenario: Active swatch outline uses accent-contrast color

- **WHEN** the user selects an accent color via one of the swatch buttons
- **THEN** the chosen swatch is outlined with `var(--accent-contrast-color)` (not a static UI-state color)
- **AND** the outline remains clearly visible against the swatch's own accent-colored fill

#### Scenario: Accent updates propagate when the track changes

- **WHEN** the playing track changes and the extracted accent color changes accordingly
- **THEN** every active control in the open flip menu re-renders with the new accent color without requiring the user to re-select anything
- **AND** the active-swatch outline re-renders with the new `--accent-contrast-color`

#### Scenario: Inactive controls remain neutral

- **WHEN** an option-button pill is in its inactive state
- **THEN** the pill renders with the panel's neutral muted styling (it does not preview the accent color)
