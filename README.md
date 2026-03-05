# Vorbis Player

A visually immersive music player built with React, featuring customizable visual effects, animated background visualizers, and a fully responsive design. Supports **Spotify**, **Dropbox**, and **Apple Music** as music sources.

<img src="src/assets/vorbis-player-full-screenshot.png" alt="Vorbis Player (Full)" width="600">
<img src="src/assets/vorbis-player-playlist-screenshot.png" alt="Vorbis Player - Playlist" width="600">
<img src="src/assets/vorbis-player-art-only-screenshot.png" alt="Vorbis Player - Art Only" width="600">

## Features

- **Multi-Provider Support**: Stream from Spotify, your personal Dropbox music library, or Apple Music; switch providers from app settings
- **Spotify Integration**: Stream music from your Spotify account (Premium required)
- **Dropbox Integration**: Browse and play audio files (MP3, FLAC, OGG, M4A, WAV) stored in your Dropbox
- **Apple Music Integration**: Stream from your Apple Music library (subscription required)
- **Playlists & Albums**: Browse, search, sort, filter, and pin your playlists and albums
- **Liked Songs**: Play your Liked Songs collection with automatic shuffle (both Spotify and Dropbox)
- **Visual Effects**: Dynamic glow effects with configurable intensity and animation rate
- **Album Art Filters**: Real-time CSS filters (brightness, contrast, saturation, sepia, hue rotation, blur)
- **Background Visualizers**: Animated particle and geometric visualizer backgrounds (enabled by default)
- **Custom Colors**: Pick accent colors per album from a color picker or eyedropper tool
- **Album Art Flip Menu**: Tap album art to flip and reveal quick-access controls (color chooser, glow toggle, visualizer toggle, visualizer style)
- **Swipe Gestures**: Swipe album art horizontally to change tracks; swipe up to toggle the playlist drawer, swipe down to toggle the library drawer
- **Interactive Track Info**: Click artist/album names for Spotify links and library filtering
- **Instant Startup**: IndexedDB-based library cache with background sync for fast loading
- **Responsive Design**: Fluid layout that adapts from mobile phones to ultra-wide desktops
- **Keyboard Shortcuts**: Context-aware keyboard controls with device-specific behavior

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Spotify Premium account, a Dropbox account with music files, and/or an Apple Music subscription
- Access to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) (for Spotify)
- Access to [Dropbox Developer Console](https://www.dropbox.com/developers/apps) (for Dropbox)
- Access to [Apple Developer Portal](https://developer.apple.com) (for Apple Music — requires Apple Developer Program membership)

### Installation

1. **Clone and install**

   ```bash
   git clone git@github.com:smallorbit/vorbis-player.git
   cd vorbis-player
   npm install
   ```

2. **Set up Spotify App** *(required for Spotify playback)*
   - See the full [Spotify Setup Guide](./docs/providers/spotify-setup.md) for step-by-step instructions
   - Short version: create an app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), add redirect URI `http://127.0.0.1:3000/auth/spotify/callback`, copy your Client ID

3. **Set up Dropbox App** *(optional — only needed for Dropbox playback)*
   - See the full [Dropbox Setup Guide](./docs/providers/dropbox-setup.md) for step-by-step instructions
   - Short version: create an app at [Dropbox Developer Console](https://www.dropbox.com/developers/apps), enable `files.metadata.read` and `files.content.read` permissions, add redirect URI `http://127.0.0.1:3000/auth/dropbox/callback`, copy your App Key

4. **Set up Apple Music** *(optional — only needed for Apple Music playback)*
   - See the full [Apple Music Setup Guide](./docs/providers/apple-music-setup.md) for step-by-step instructions
   - Short version: create a MusicKit identifier and private key in the [Apple Developer Portal](https://developer.apple.com), generate a JWT developer token, add it to `.env.local`

5. **Configure environment**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

   Required in `.env.local`:

   ```
   VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id_here"
   VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
   ```

   Add this line to also enable Dropbox:

   ```
   VITE_DROPBOX_CLIENT_ID="your_dropbox_app_key_here"
   ```

   Add this line to also enable Apple Music:

   ```
   VITE_APPLE_MUSIC_DEVELOPER_TOKEN="your_jwt_developer_token_here"
   ```

   If `VITE_DROPBOX_CLIENT_ID` is omitted, the Dropbox provider is disabled. If `VITE_APPLE_MUSIC_DEVELOPER_TOKEN` is omitted, Apple Music will appear in the provider picker but fail to connect at runtime.

6. **Start the app**

   ```bash
   npm run dev
   ```

7. **First run**
   - Open <http://127.0.0.1:3000>
   - Choose a provider: Spotify, Dropbox, or Apple Music
   - Authenticate with your chosen provider
   - Browse your playlists, albums, and liked songs

## User Interface

### Player View

The player displays album artwork with controls always visible below:

**Album Art Flip Menu** (tap album art to reveal):
- Accent color swatches (extracted from art, custom, eyedropper, reset)
- Glow effect toggle
- Background visualizer toggle
- Visualizer style selector (Particles / Geometric)

**Bottom Bar** (fixed at bottom):
- Volume control
- Shuffle toggle
- Visual effects menu (gear icon for full controls)
- Back to library
- Playlist drawer toggle
- Zen mode toggle (desktop/tablet)

**Controls** (always visible below album art):
- Track name with clickable artist and album links
- Playback controls (previous, play/pause, next)
- Timeline slider, volume control, and like button

**Touch Gestures** (mobile/tablet):
- Tap album art to flip and reveal quick-access controls (or play/pause when in zen mode)
- Swipe album art left/right to change tracks
- Swipe up on album art to toggle the playlist drawer
- Swipe down on album art to toggle the library drawer

### Library

The library drawer supports:
- **Search**: Filter playlists and albums by name
- **Sort**: Sort by recently added, name, artist, or release date
- **Filter**: Filter albums by decade or by artist (click artist name in album grid)
- **View Modes**: Toggle between Playlists and Albums tabs
- **Pinning**: Pin up to 4 playlists and 4 albums to the top of their tabs
- **Liked Songs**: Special entry with shuffle indicator

### Provider Selection

Open the App Settings drawer (gear icon → App Settings or a dedicated section) to manage music sources:

- **Connect / Disconnect**: Authenticate or revoke each provider independently
- **Use this source**: Switch the active provider; the library and playback context update in-place without a full page reload
- **Persistence**: Your active provider choice is saved in localStorage and restored on next visit

When Dropbox is active:
- The library shows your Dropbox folders as albums, discovered from your Dropbox file hierarchy
- Supported audio formats: MP3, FLAC, OGG/Vorbis, M4A/AAC, WAV (unsupported formats are skipped)
- Album art is read from image files (`cover.jpg`, `folder.png`, etc.) found alongside your audio files
- Track metadata (title, artist, album, cover art) is read from ID3 tags embedded in MP3 files
- Liked Songs are supported for Dropbox — like/unlike tracks, browse your liked collection, and manage via Export/Import and Refresh Metadata in settings
- "Open in Spotify" links are hidden for Dropbox tracks

When Apple Music is active:
- The library shows your Apple Music library playlists and albums
- Playback uses MusicKit JS — Apple's own playback engine handles streaming
- Liked Songs uses Apple Music's ratings API ("loved" songs = liked songs)
- "Open in Apple Music" links are available for all tracks
- Authentication uses a popup-based Apple ID sign-in (no redirect URL needed)

### Visual Effects Menu

The visual effects menu (opened via the gear icon in the bottom bar) provides full control over:

**Glow Effect**: Intensity (Less/Normal/More), Rate (Slower/Normal/Faster), Accent color background toggle

**Background Visualizer**: Style (Particles or Geometric), Intensity (0-100%)

**Album Art Filters**: Brightness, Saturation, Sepia, Contrast with one-click reset

### Keyboard Shortcuts

| Key | Action (Desktop) | Action (Touch-only) |
|-----|-------------------|---------------------|
| `Space` | Play/Pause | Play/Pause |
| `ArrowRight` / `ArrowLeft` | Next / Previous track | Next / Previous track |
| `ArrowUp` / `P` | Toggle playlist drawer | Volume up (ArrowUp only) |
| `ArrowDown` / `L` | Toggle library drawer | Volume down (ArrowDown only) |
| `V` | Toggle background visualizer | Toggle background visualizer |
| `G` | Toggle glow effect | Toggle glow effect |
| `O` | Open visual effects menu | Open visual effects menu |
| `K` | Like/unlike current track | Like/unlike current track |
| `M` | Mute/unmute | Mute/unmute |
| `/` or `?` | Show keyboard shortcuts help | Show keyboard shortcuts help |
| `Escape` | Close all menus | Close all menus |

Press `/` or `?` in the app to see the full shortcuts overlay.

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production (tsc -b && vite build)
npm run lint         # Run ESLint
npm run preview      # Preview production build
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
```

### Project Structure

```
src/
├── components/              # React components (~42 files)
│   ├── AudioPlayer.tsx      # Main orchestrator with centralized state
│   ├── PlayerContent.tsx    # Main player layout (centering, responsive sizing)
│   ├── PlayerStateRenderer.tsx  # Loading/error/playlist selection states
│   ├── AlbumArt.tsx         # Album artwork with filters & glow effects
│   ├── PlaylistSelection.tsx    # Playlist/album browser with search/sort/filter/pin
│   ├── SpotifyPlayerControls.tsx # Player control interface
│   ├── LibraryDrawer.tsx    # Full-screen library browser drawer
│   ├── PlaylistDrawer.tsx   # Sliding track list drawer (desktop/tablet)
│   ├── PlaylistBottomSheet.tsx  # Mobile playlist bottom sheet
│   ├── ColorPickerPopover.tsx   # Per-album color picker
│   ├── AlbumArtBackside.tsx     # Flip menu back face (color, glow, visualizer controls)
│   ├── BottomBar/               # Bottom bar (volume, shuffle, visual effects, library, playlist)
│   ├── controls/            # Player control sub-components
│   ├── styled/              # Reusable styled-components library
│   ├── icons/               # SVG icon components
│   ├── visualizers/         # Background visualizer components
│   └── VisualEffectsMenu/   # Visual effects configuration panel
├── constants/               # Shared constants (playlist IDs, prefixes)
├── hooks/                   # 22 custom React hooks
├── providers/               # Multi-provider system
│   ├── registry.ts          # Singleton ProviderRegistry
│   ├── spotify/             # Spotify auth, catalog, playback adapters
│   ├── dropbox/             # Dropbox auth, catalog, playback adapters + art/catalog cache
│   └── apple-music/         # Apple Music auth, catalog, playback adapters (MusicKit JS)
├── services/                # Spotify API, Playback SDK, IndexedDB cache
├── utils/                   # Utility functions (color, sizing, filters)
├── styles/                  # Theme, global styles, CSS animations
├── types/                   # TypeScript definitions (domain.ts, providers.ts)
├── workers/                 # Web Workers (image processing)
└── lib/                     # Helper functions
```

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: styled-components with theme system + Radix UI primitives
- **Audio**: Spotify Web Playback SDK (lazy-loaded on demand) + Web API; HTML5 Audio for Dropbox streams; MusicKit JS for Apple Music
- **Authentication**: PKCE OAuth 2.0 (Spotify and Dropbox); MusicKit JS popup auth (Apple Music)
- **Testing**: Vitest + React Testing Library
- **Performance**: Web Workers, LRU caching, IndexedDB persistence, lazy loading, container queries

## Deployment

### Deploy to Vercel (Recommended)

For detailed instructions, see [deploy-to-vercel.md](./docs/deployment/deploy-to-vercel.md).

**Quick Deploy:**
1. Push your code to GitHub/GitLab/Bitbucket
2. Connect your repository to [Vercel](https://vercel.com)
3. Set environment variables:
   - `VITE_SPOTIFY_CLIENT_ID`: Your Spotify app's Client ID
   - `VITE_SPOTIFY_REDIRECT_URI`: `https://your-app.vercel.app/auth/spotify/callback`
   - `VITE_DROPBOX_CLIENT_ID`: Your Dropbox app key *(optional — omit to disable Dropbox)*
   - `VITE_APPLE_MUSIC_DEVELOPER_TOKEN`: Your MusicKit JWT developer token *(optional — omit to disable Apple Music)*
   - Update the Dropbox app's redirect URI to `https://your-app.vercel.app/auth/dropbox/callback`
4. Deploy!

### Manual Build

```bash
npm run build
```

The `dist/` folder contains static files deployable to any web hosting service.

**Important**: Update the Spotify redirect URI in your app settings to match your production domain.

## Troubleshooting

### "No tracks found" (Spotify)
- Ensure you have a Spotify Premium subscription
- Create playlists with music or like some songs in Spotify

### Authentication Issues (Spotify)
- Double-check your Client ID in `.env.local`
- Ensure redirect URI matches exactly in both `.env.local` and Spotify app settings
- Use `127.0.0.1` instead of `localhost`

### Dropbox Not Appearing in Settings
- Make sure `VITE_DROPBOX_CLIENT_ID` is set in `.env.local` (the Dropbox provider is only registered when this variable is present)
- Restart the dev server after changing `.env.local`

### Dropbox Authentication Issues
- Verify that the redirect URI `http://127.0.0.1:3000/auth/dropbox/callback` is added in your Dropbox app's **Settings** tab
- Confirm the Dropbox app has `files.metadata.read` and `files.content.read` permissions enabled
- Try disconnecting and reconnecting from App Settings; this clears stale tokens

### Dropbox: No Albums / No Tracks
- Ensure your Dropbox contains audio files (MP3, FLAC, OGG, M4A, WAV) organized in folders
- Expected structure: `/<Artist>/<Album>/<track.mp3>` or `/<Album>/<track.mp3>`
- Folders with no audio files are not listed as albums
- After connecting, give the app a moment to scan your Dropbox (the first load enumerates all files recursively)

### Dropbox: Album Art Not Showing
- Place an image file (`cover.jpg`, `folder.png`, `album.jpg`, etc.) in the same folder as your audio files
- Art is cached in IndexedDB with a 7-day TTL; clearing site data forces a fresh download

### Apple Music: Auth Popup Blocked
- Allow popups for `127.0.0.1:3000` in your browser settings
- MusicKit's `authorize()` must be triggered from a user gesture (button click)

### Apple Music: No Library Content
- Ensure your Apple Music subscription is active
- Add music to your library in the Apple Music app first — the API only returns content explicitly added to your library

### Apple Music: Developer Token Errors
- Developer tokens expire after max 6 months — regenerate using the script in the [Apple Music Setup Guide](./docs/providers/apple-music-setup.md)
- Ensure `VITE_APPLE_MUSIC_DEVELOPER_TOKEN` is set in `.env.local` and the dev server has been restarted

### Visual Effects Issues
- Clear localStorage to reset visual settings to defaults
- Background visualizer requires Canvas API support
- CSS filters require a modern browser
