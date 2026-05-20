## MODIFIED Requirements

### Requirement: Error Recovery

The engine SHALL handle playback adapter errors without leaving the queue stuck on an unplayable track. A track SHALL be considered unavailable when the driving provider's `playTrack` rejects with an unavailability signal, including provider-specific terminal failures during the initial play of a track.

#### Scenario: Track is unavailable
- **WHEN** the driving provider reports a track as unavailable
- **THEN** the engine skips to the next track

#### Scenario: Provider authentication expired during playback
- **WHEN** the driving provider reports authentication has expired
- **THEN** the engine surfaces a re-authentication prompt and does not auto-skip

#### Scenario: Dropbox HTML5 audio error during initial play
- **WHEN** the Dropbox playback adapter's `<audio>` element raises an `error` event during the initial play of a track (decoder failure, terminal 4xx/5xx on the temporary link after refresh, network failure before the element reaches the playing state), or `audio.play()` itself rejects
- **THEN** `playTrack` rejects with an unavailability signal
- **AND** the engine skips to the next track

#### Scenario: Dropbox temporary link cannot be obtained
- **WHEN** the Dropbox catalog adapter fails to mint a temporary link for a track for any reason other than auth expiry
- **THEN** `playTrack` rejects
- **AND** the engine skips to the next track
