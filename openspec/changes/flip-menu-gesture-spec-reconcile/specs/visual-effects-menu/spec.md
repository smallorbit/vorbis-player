## MODIFIED Requirements

### Requirement: Flip-Menu Surface

Vorbis Player SHALL expose a flip-side panel mounted on the back face of the album-art card that hosts the visual-effect controls. The panel SHALL be reachable from the front-of-art interaction layer via the modality-appropriate gesture: tap on touch outside zen mode, long-press on touch inside zen mode (because the zen-mode tap surface is reserved for the play / prev / next click zones rendered by `ZenClickZoneOverlay`), and click on pointer. The panel SHALL render on top of a blurred, darkened version of the current album art, and SHALL provide an explicit dismiss control plus dismiss-on-outside-tap behavior. When no track is playing or no album art is available, the panel SHALL still render and SHALL offer a Retry Artwork affordance if the consumer wires one in.

#### Scenario: Opening the flip menu

- **WHEN** the user clicks the front of the album art with a pointer device with the flip gesture enabled
- **OR WHEN** the user taps the front of the album art on a touch device while zen mode is disabled
- **OR WHEN** the user long-presses the front of the album art on a touch device while zen mode is enabled
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
