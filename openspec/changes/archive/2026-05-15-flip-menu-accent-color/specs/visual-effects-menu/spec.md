## ADDED Requirements

### Requirement: Flip-Menu Surface

Vorbis Player SHALL expose a flip-side panel mounted on the back face of the album-art card that hosts the visual-effect controls. The panel SHALL be reachable from the front-of-art interaction layer (long-press on touch, click on pointer), SHALL render on top of a blurred, darkened version of the current album art, and SHALL provide an explicit dismiss control plus dismiss-on-outside-tap behavior. When no track is playing or no album art is available, the panel SHALL still render and SHALL offer a Retry Artwork affordance if the consumer wires one in.

#### Scenario: Opening the flip menu

- **WHEN** the user long-presses (touch) or clicks the front of the album art with the flip gesture enabled
- **THEN** the album-art card rotates 180° about the Y axis to reveal the flip menu
- **AND** the flip menu becomes interactive (controls accept pointer / keyboard input)

#### Scenario: Closing the flip menu via the close button

- **WHEN** the user clicks the close button rendered at the top-right of the flip menu
- **THEN** the album-art card rotates back to the front face
- **AND** the flip menu's controls become non-interactive

#### Scenario: Closing the flip menu via outside-tap

- **WHEN** the user taps inside the flip-menu surface but outside any control
- **THEN** the album-art card rotates back to the front face

#### Scenario: Backdrop renders without album art

- **WHEN** the current track has no resolvable album image
- **THEN** the flip menu still renders with a fallback (un-imaged) backdrop
- **AND** the Retry Artwork control is shown when the consumer provides a retry callback

### Requirement: Accent Color Selection

The flip menu SHALL let the user choose the active accent color via three input paths: (a) selecting one of the top vibrant swatches extracted from the current album art, (b) selecting a previously-saved custom override for the current album, and (c) picking any pixel from the album image via an eyedropper overlay. The user SHALL be able to reset to the default extracted accent. The active swatch SHALL be visually distinguishable from inactive swatches.

#### Scenario: Selecting an extracted swatch

- **WHEN** the user clicks one of the extracted-swatch buttons
- **THEN** the accent color updates to the swatch's hex value
- **AND** the swatch displays as the active swatch

#### Scenario: Using the eyedropper

- **WHEN** the user activates the eyedropper and picks a pixel from the album art
- **THEN** the picked color is saved as the album's custom accent override
- **AND** the accent color updates to the picked color
- **AND** the eyedropper overlay dismisses

#### Scenario: Resetting to default

- **WHEN** the user clicks the Reset control
- **THEN** any custom override for the current album is cleared
- **AND** the accent color reverts to the default extracted accent for the current album

### Requirement: Glow Control

The flip menu SHALL expose a toggle that enables or disables the album-art glow effect. While enabled, the menu SHALL expose Intensity (Less / Normal / More) and Rate (Slower / Normal / Faster) sub-settings whose selected value is visually indicated. Sub-settings SHALL be hidden while the toggle is off. Toggling SHALL be reversible without loss of the user's previous sub-setting selections.

#### Scenario: Enabling glow

- **WHEN** the user flips the glow switch on
- **THEN** glow is applied to the album art using the current accent color
- **AND** the Intensity and Rate sub-settings become visible

#### Scenario: Disabling glow

- **WHEN** the user flips the glow switch off
- **THEN** glow is removed from the album art
- **AND** the Intensity and Rate sub-settings are hidden

#### Scenario: Selecting an Intensity / Rate value

- **WHEN** the user clicks one of the Intensity (or Rate) option buttons
- **THEN** the glow effect updates to the selected value
- **AND** the chosen option button is rendered in the active state

### Requirement: Background Visualizer Control

The flip menu SHALL expose a toggle that enables or disables the background visualizer. While enabled, the menu SHALL expose Style (Fireflies / Comet / Wave / Grid), Intensity (Less / Normal / More), and Speed (Slower / Normal / Faster) sub-settings whose selected value is visually indicated. Sub-settings SHALL be hidden while the toggle is off.

#### Scenario: Enabling the visualizer

- **WHEN** the user flips the visualizer switch on
- **THEN** the selected visualizer style is rendered behind the player
- **AND** the Style, Intensity, and Speed sub-settings become visible

#### Scenario: Switching style

- **WHEN** the user clicks one of the Style option buttons (Fireflies, Comet, Wave, or Grid)
- **THEN** the running visualizer swaps to the selected style without disabling the visualizer
- **AND** the chosen option button is rendered in the active state

#### Scenario: Disabling the visualizer

- **WHEN** the user flips the visualizer switch off
- **THEN** the background visualizer stops rendering
- **AND** the Style, Intensity, and Speed sub-settings are hidden

### Requirement: Translucence Control

The flip menu SHALL expose a toggle that enables or disables the album-art translucence effect. The toggle SHALL persist across track changes for the duration of the session.

#### Scenario: Toggling translucence

- **WHEN** the user flips the translucence switch
- **THEN** translucence is applied or removed on the album art accordingly

### Requirement: Active Controls Reflect Current Accent Color

Every control in the flip menu that exposes an active visual state — Glow Intensity / Rate pills, Visualizer Style / Intensity / Speed pills, the Glow / Visualizer / Translucence switch tracks, and the active swatch indicator — SHALL render its active state using the current `--accent-color` (or a value derived from it, such as `--accent-contrast-color` for foregrounds). Inactive states MAY remain neutral. When the current track changes and the accent color is recomputed, every active control's color SHALL update accordingly without user input.

Rationale: the flip menu is the per-album personalization surface, so its active-state styling should read as an extension of the album's identity rather than as generic chrome.

#### Scenario: Active option-button pill reflects accent

- **WHEN** the user opens the flip menu while a track with a known accent color is playing
- **THEN** the currently-selected Glow Intensity / Rate / Visualizer Style / Intensity / Speed pill renders with its background, border, and foreground driven by the current accent color and its derived contrast color

#### Scenario: Switch tracks reflect accent

- **WHEN** the Glow, Visualizer, or Translucence switch is in the on state
- **THEN** the switch track renders in the current accent color

#### Scenario: Accent updates propagate when the track changes

- **WHEN** the playing track changes and the extracted accent color changes accordingly
- **THEN** every active control in the open flip menu re-renders with the new accent color without requiring the user to re-select anything

#### Scenario: Inactive controls remain neutral

- **WHEN** an option-button pill is in its inactive state
- **THEN** the pill renders with the panel's neutral muted styling (it does not preview the accent color)
