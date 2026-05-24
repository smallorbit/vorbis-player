## ADDED Requirements

### Requirement: Zen eyedropper trigger
When zen mode is active, a pointer device is present, the user is hovering the album art panel, the track has album art, and the panel is not flipped, the system SHALL display a Pipette icon button in the top-right corner of the album art panel.

#### Scenario: Trigger appears on hover in zen mode
- **WHEN** zen mode is active AND the pointer enters the album art panel AND a track with art is playing AND the panel is not flipped
- **THEN** a Pipette icon button appears in the top-right corner of the album art panel

#### Scenario: Trigger hidden when no art
- **WHEN** zen mode is active AND the current track has no album art image
- **THEN** the Pipette icon button SHALL NOT be rendered

#### Scenario: Trigger hidden while picking mode is active
- **WHEN** the zen eyedropper is in picking mode
- **THEN** the Pipette trigger icon SHALL NOT be visible

### Requirement: Zen eyedropper picking mode
Clicking the Pipette trigger SHALL enter picking mode: a `<canvas>` is rendered absolutely over the album art panel, sized to fill the panel, with the album art drawn onto it and the cursor set to crosshair.

#### Scenario: Enter picking mode
- **WHEN** the user clicks the Pipette trigger icon
- **THEN** the album art panel displays a canvas overlay covering the art with a crosshair cursor

#### Scenario: Color preview follows cursor
- **WHEN** picking mode is active AND the user moves the pointer over the canvas
- **THEN** a floating tooltip near the cursor shows the hex code and a color swatch of the pixel under the pointer

#### Scenario: Pick a color
- **WHEN** picking mode is active AND the user clicks a pixel on the canvas
- **THEN** the accent color for the current album is updated to the sampled hex value via the custom-accent dual-write path AND picking mode exits immediately

#### Scenario: Cancel with Escape
- **WHEN** picking mode is active AND the user presses Escape
- **THEN** picking mode exits without applying any color change

#### Scenario: Cancel outside canvas
- **WHEN** picking mode is active AND the user clicks outside the canvas overlay
- **THEN** picking mode exits without applying any color change
