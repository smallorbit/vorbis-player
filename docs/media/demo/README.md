# Demo videos

Recorded against the **mock provider**, so no Spotify or Dropbox login is involved and
the catalog shown is the anonymized Playwright fixture
(`playwright/fixtures/data/spotify-snapshot.json`).

| File | What it is |
|---|---|
| `vorbis-player-teaser.mp4` | 60s trailer, 1920x1080, 60fps, with a CC0 music bed |
| `vorbis-player-teaser-highlight.gif` | 17s cut (Wave visualizer into zen mode), 800px, for README embeds |

Sequence: welcome screen -> library -> "awaken" -> next track -> album art flip
menu switching Comet / Grid / Wave -> zen mode -> keyboard next track -> exit.

## Regenerating

```bash
VITE_MOCK_PROVIDER=true npm run dev              # terminal 1
npm run demo:record:mac -- /tmp/teaser-rec       # terminal 2 (macOS): 60fps avfoundation capture
npm run demo:record:x11 -- /tmp/teaser-rec       #            (Linux): 60fps capture via Xvfb + ffmpeg
npm run demo:encode -- /tmp/teaser-rec docs/media/demo path/to/music.mp3
```

`record-teaser.mjs` drives the UI with a scripted on-screen cursor and writes timestamps
(`marks.json`) for every scene. Two capture modes:

| Command | How it captures | Notes |
|---|---|---|
| `npm run demo:record:mac` | Headful Chromium fullscreen on your main display, grabbed by `ffmpeg -f avfoundation` at `DEMO_FPS` (default 60), VideoToolbox-encoded | macOS. Needs Homebrew `ffmpeg` and Screen Recording permission for your terminal. The viewport is the display's logical size; Retina pixels are scaled back to CSS pixels unless `DEMO_NATIVE_SCALE=1`. Leave the machine alone while it records. |
| `npm run demo:record:x11` | Headful Chromium fullscreen on a virtual X display, grabbed by `ffmpeg -f x11grab` at `DEMO_FPS` (default 60) into an h264 mp4 | Linux (needs `Xvfb`). Clean source, true 60fps cursor and transitions. |
| `npm run demo:record` | Playwright's built-in screencast | Works anywhere Playwright does, but 25fps VP8 at a fixed quality. |

`DEMO_WIDTH` / `DEMO_HEIGHT` set the viewport (default 1920x1080) for the Playwright and
x11 modes; the macOS mode uses the display size. `encode-teaser.sh` trims
the capture by the scene marks and produces the silent mp4, the scored mp4, the highlight
GIF and a full-length GIF at the source frame rate (minimum 30). Requires `ffmpeg` on PATH.

The page's own animation rate is bounded by the machine doing the recording: without a GPU
(e.g. a cloud container on SwiftShader) the visualizers render at roughly 20fps even though
the capture is 60fps, so record the final take on a machine with hardware acceleration.

The eight "awaken" albums carry 1200-1600px art in the fixture (front covers pulled from
the Cover Art Archive via MusicBrainz release IDs); every other fixture album is still
300px, so switch playlists with that in mind. Remaining limitation: the Grid visualizer compresses poorly as GIF, which is why the
highlight cut runs on Wave.

## Credits

- Music: "Calm Ambient 2 (Synthwave 15k)" by cynicmusic,
  https://opengameart.org/content/calm-ambient-2-synthwave-15k, CC0 1.0 (no attribution
  required; listed as a courtesy).
- Album art and track names: the repo's anonymized Spotify fixture; the awaken covers come
  from the Cover Art Archive (coverartarchive.org).
- The mock provider's audio (synthetic test tones) is not included in any output.
