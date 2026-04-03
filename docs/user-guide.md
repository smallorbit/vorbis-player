# User Guide

A comprehensive guide to all Vorbis Player features and controls.

## Player View

The player displays album artwork with controls always visible below.

### Album Art Flip Menu

Tap or click the album art to flip it and reveal quick-access controls:

- **Accent color swatches** — extracted from art, custom, eyedropper, reset
- **Glow effect toggle**
- **Background visualizer toggle**
- **Visualizer style selector** — Particles / Geometric

### Bottom Bar

Fixed at the bottom of the screen:

- Volume control
- Shuffle toggle
- Visual effects menu (gear icon for full controls)
- Back to library
- Queue drawer toggle
- Zen mode toggle (desktop/tablet)

### Playback Controls

Always visible below album art:

- Track name with clickable artist and album links
- Previous, play/pause, next
- Timeline slider, volume control, and like button

### Touch Gestures

On mobile and tablet:

- **Tap** album art to flip and reveal quick-access controls (or play/pause in zen mode)
- **Swipe left/right** on album art to change tracks
- **Swipe up** on album art to toggle the queue drawer
- **Swipe down** on album art to toggle the library drawer

## Library

The library drawer supports:

- **Search** — Filter playlists and albums by name
- **Sort** — Sort by recently added, name, artist, or release date
- **Filter** — Filter albums by decade or by artist (click artist name in album grid)
- **View Modes** — Toggle between Playlists and Albums tabs
- **Pinning** — Pin up to 4 playlists and 4 albums to the top of their tabs
- **Liked Songs** — Special entry with shuffle indicator

## Provider Selection

Open the App Settings drawer (gear icon > App Settings) to manage music sources:

- **Connect / Disconnect** — Authenticate or revoke each provider independently
- **Use this source** — Switch the active provider; the library and playback context update in-place without a page reload
- **Persistence** — Your active provider choice is saved in localStorage and restored on next visit

### Dropbox-Specific Behavior

When Dropbox is the active provider:

- The library shows your Dropbox folders as albums, discovered from your file hierarchy
- Supported audio formats: MP3, FLAC, OGG/Vorbis, M4A/AAC, WAV (unsupported formats are skipped)
- Album art is read from image files (`cover.jpg`, `folder.png`, etc.) found alongside your audio files
- Track metadata (title, artist, album, cover art) is read from ID3 tags embedded in MP3 files
- Liked Songs are supported — like/unlike tracks, browse your liked collection, and manage via Export/Import and Refresh Metadata in settings
- "Open in Spotify" links are hidden for Dropbox tracks

## Visual Effects Menu

Opened via the gear icon in the bottom bar. Provides full control over:

### Glow Effect

- **Intensity** — Less / Normal / More
- **Rate** — Slower / Normal / Faster
- **Accent color background** toggle

### Background Visualizer

- **Style** — Particles or Geometric
- **Intensity** — 0-100%

### Album Art Filters

- Brightness, Saturation, Sepia, Contrast
- One-click reset to defaults

## Keyboard Shortcuts

| Key | Action (Desktop) | Action (Touch-only) |
|-----|-------------------|---------------------|
| `Space` | Play/Pause | Play/Pause |
| `ArrowRight` / `ArrowLeft` | Next / Previous track | Next / Previous track |
| `ArrowUp` / `Q` | Toggle queue drawer | Volume up (ArrowUp only) |
| `ArrowDown` / `L` | Toggle library drawer | Volume down (ArrowDown only) |
| `V` | Toggle background visualizer | Toggle background visualizer |
| `G` | Toggle glow effect | Toggle glow effect |
| `S` | Toggle shuffle | Toggle shuffle |
| `T` | Toggle translucence | Toggle translucence |
| `O` | Open visual effects menu | Open visual effects menu |
| `K` | Like/unlike current track | Like/unlike current track |
| `M` | Mute/unmute | Mute/unmute |
| `/` or `?` | Show keyboard shortcuts help | Show keyboard shortcuts help |
| `Escape` | Close all menus | Close all menus |

Press `/` or `?` in the app to see the full shortcuts overlay.
