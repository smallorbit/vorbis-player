# Demo videos

Recorded against the **mock provider**, so no Spotify or Dropbox login is involved and
the catalog shown is the anonymized Playwright fixture
(`playwright/fixtures/data/spotify-snapshot.json`).

| File | What it is |
|---|---|
| `vorbis-player-teaser.mp4` | 58s trailer, 1920x1080, 30fps, with a CC0 music bed |
| `vorbis-player-teaser-highlight.gif` | 17s cut (Wave visualizer into zen mode), 800px, for README embeds |

Sequence: welcome screen -> library -> "awaken" -> next track -> album art flip
menu switching Comet / Grid / Wave -> zen mode -> keyboard next track -> exit.

## Regenerating

```bash
VITE_MOCK_PROVIDER=true npm run dev          # terminal 1
npm run demo:record -- /tmp/teaser-rec       # terminal 2: writes a .webm + marks.json
npm run demo:encode -- /tmp/teaser-rec docs/media/demo path/to/music.mp3
```

`record-teaser.mjs` drives the UI with a scripted on-screen cursor and writes timestamps
(`marks.json`) for every scene. `encode-teaser.sh` trims the raw webm by those marks and
produces the silent mp4, the scored mp4, the highlight GIF and a full-length GIF.
Requires `ffmpeg` on PATH.

The eight "awaken" albums carry 1200-1600px art in the fixture (front covers pulled from
the Cover Art Archive via MusicBrainz release IDs); every other fixture album is still
300px, so switch playlists with that in mind. Remaining limitations: the Playwright
screencast is 25fps at 1080p, and the Grid visualizer compresses poorly as GIF, which is
why the highlight cut runs on Wave.

## Credits

- Music: "Calm Ambient 2 (Synthwave 15k)" by cynicmusic,
  https://opengameart.org/content/calm-ambient-2-synthwave-15k, CC0 1.0 (no attribution
  required; listed as a courtesy).
- Album art and track names: the repo's anonymized Spotify fixture; the awaken covers come
  from the Cover Art Archive (coverartarchive.org).
- The mock provider's audio (synthetic test tones) is not included in any output.
