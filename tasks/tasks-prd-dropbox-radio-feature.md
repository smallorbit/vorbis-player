## Relevant Files

- `src/types/radio.ts` - Radio-specific type definitions (RadioSeed, RadioResult, LastFm types)
- `src/types/domain.ts` - Extended with optional MusicBrainz ID fields on MediaTrack
- `src/services/lastfm.ts` - Last.fm API client
- `src/services/__tests__/lastfm.test.ts` - Unit tests for Last.fm client (12 tests)
- `src/services/catalogMatcher.ts` - Matches Last.fm results against Dropbox catalog
- `src/services/__tests__/catalogMatcher.test.ts` - Unit tests for CatalogMatcher (19 tests)
- `src/services/radioService.ts` - Orchestrates radio queue generation
- `src/services/__tests__/radioService.test.ts` - Unit tests for RadioService (11 tests)
- `src/utils/id3Parser.ts` - Extended to extract MusicBrainz TXXX frames and TSRC
- `src/utils/__tests__/id3Parser.test.ts` - Unit tests for ID3 parser MusicBrainz extraction (9 tests)
- `src/providers/dropbox/dropboxPlaybackAdapter.ts` - Updated to populate MusicBrainz fields from ID3 enrichment
- `src/hooks/useRadio.ts` - React hook for radio state management
- `src/hooks/usePlayerLogic.ts` - Updated with radio integration (handleStartRadio)
- `src/components/AudioPlayer.tsx` - Updated to pass radio state to PlayerContent
- `src/components/PlayerContent.tsx` - Updated to pass radio props to BottomBar and drawers
- `src/components/BottomBar/index.tsx` - Added Radio button with RadioIcon
- `src/components/PlaylistDrawer.tsx` - Added radio label in drawer header
- `src/components/PlaylistBottomSheet.tsx` - Added radio label in bottom sheet header
- `src/components/icons/QuickActionIcons.tsx` - Added RadioIcon component
- `.env.example` - Updated with VITE_LASTFM_API_KEY

### Notes

- Unit tests are colocated in `__tests__/` subdirectories
- Use `npm run test:run` to run tests
- Last.fm API requires only an API key (no secret), supports CORS from browser
- Total new tests: 51 (12 + 19 + 11 + 9)

## Tasks

- [x] 1.0 Define Radio Types
  - [x] 1.1 Create `src/types/radio.ts` with LastFmSimilarTrack, LastFmSimilarArtist, RadioSeed, RadioResult, MatchResult, and CatalogIndexes interfaces
  - [x] 1.2 Add optional `musicbrainzRecordingId`, `musicbrainzArtistId`, and `isrc` fields to MediaTrack in `src/types/domain.ts`

- [x] 2.0 Implement LastFmClient
  - [x] 2.1 Create `src/services/lastfm.ts` with fetch-based API client implementing getSimilarTracks, getSimilarArtists, getArtistTopTracks, and getAlbumTracks methods
  - [x] 2.2 Add rate limiting (5 req/sec), error handling, response parsing, and VITE_LASTFM_API_KEY configuration
  - [x] 2.3 Write unit tests in `src/services/__tests__/lastfm.test.ts` with mocked fetch responses

- [x] 3.0 Implement CatalogMatcher
  - [x] 3.1 Create `src/services/catalogMatcher.ts` with index builder (byRecordingMbid, byArtistMbid, byNormalizedKey, byNormalizedArtist) and normalizeForMatching function
  - [x] 3.2 Implement matchTrack method with MBID-first, then normalized-name matching strategy
  - [x] 3.3 Write unit tests in `src/services/__tests__/catalogMatcher.test.ts` covering MBID matching, name matching, normalization edge cases, and deduplication

- [x] 4.0 Implement RadioService
  - [x] 4.1 Create `src/services/radioService.ts` implementing generateQueue for track, artist, and album seed types
  - [x] 4.2 Implement fallback logic (track seed falls back to artist radio when few matches), deduplication, sorting by relevance, and queue capping at 50
  - [x] 4.3 Write unit tests in `src/services/__tests__/radioService.test.ts` with mocked LastFmClient and CatalogMatcher

- [x] 5.0 Extend ID3 Parser for MusicBrainz Tags
  - [x] 5.1 Update `src/utils/id3Parser.ts` to extract TXXX:MusicBrainz frames (Recording ID, Artist ID) and TSRC/ISRC
  - [x] 5.2 Update Dropbox playback adapter to populate MusicBrainz fields from ID3 metadata enrichment
  - [x] 5.3 Write tests for the new ID3 extraction

- [x] 6.0 Create useRadio Hook and UI Integration
  - [x] 6.1 Create `src/hooks/useRadio.ts` managing radio state (active/inactive, seed, queue generation, queue setting)
  - [x] 6.2 Add "Start Radio" UI trigger in BottomBar (radio antenna icon button, only visible for Dropbox with VITE_LASTFM_API_KEY set)
  - [x] 6.3 Add radio queue indicator in playlist drawer and bottom sheet headers
  - [x] 6.4 Hide radio UI when VITE_LASTFM_API_KEY is not set
  - [x] 6.5 Add loading/generating state handling and error propagation
  - [x] 6.6 Update `.env.example` with VITE_LASTFM_API_KEY
