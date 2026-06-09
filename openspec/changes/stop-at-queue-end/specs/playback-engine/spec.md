## ADDED Requirements

### Requirement: Manual Navigation Queue Boundaries

Manual next and previous controls SHALL treat the queue as finite and SHALL NOT wrap around its boundaries. Invoking next on the last track SHALL be a no-op that leaves the current track and playback state untouched. Invoking previous on the first track SHALL restart the first track from the beginning.

#### Scenario: Next on the last track

- **WHEN** the user invokes next while the last track in the queue is current
- **THEN** the current track index is unchanged
- **AND** no new playback is initiated

#### Scenario: Previous on the first track

- **WHEN** the user invokes previous while the first track in the queue is current
- **THEN** the first track restarts from the beginning

#### Scenario: Next within the queue

- **WHEN** the user invokes next while a track before the last is current
- **THEN** playback advances to the following track

#### Scenario: Previous within the queue

- **WHEN** the user invokes previous while a track after the first is current
- **THEN** playback moves to the preceding track

## MODIFIED Requirements

### Requirement: Auto-Advance on Track End

The engine SHALL detect track end and advance to the next track in the queue. Track end SHALL be recognized from either of two signals: a near-end signal when remaining time falls below a threshold, or a natural-end signal when the driving provider transitions from playing to paused at position zero. When the ended track is the last track in the queue, the engine SHALL stop instead of wrapping to the first track.

#### Scenario: Near-end signal

- **WHEN** the driving provider reports remaining time below the near-end threshold
- **THEN** the engine advances to the next track

#### Scenario: Natural-end signal

- **WHEN** the driving provider transitions from playing to paused at position zero
- **THEN** the engine advances to the next track

#### Scenario: Cooldown suppresses false trigger

- **WHEN** an auto-advance signal fires within the cooldown window of a fresh track start
- **THEN** the signal is ignored

#### Scenario: Last track ends

- **WHEN** the last track in the queue ends
- **THEN** playback stops
- **AND** the current track index is unchanged
