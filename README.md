# Vorbis Player

A modern audio player that combines Dropbox music streaming with curated retro TV show visuals. Stream your music from Dropbox while enjoying nostalgic TV content from the 80s and 90s that change with each track.

## Features

- **Dropbox Integration**: Stream audio files directly from your Dropbox account
- **Multi-Mode Visual Experience**: Choose between 80's TV 8️⃣0️⃣s or 90's TV ⓽⓪s video modes
- **Intuitive Shuffle**: Dedicated full-width shuffle bar with HyperText animation for easy video cycling
- **Optimized Video Display**: Smart cropping and scaling to maximize content in square viewport
- **Quick Mode Switching**: Toggle between retro TV eras with one-click emoji buttons
- **Admin System**: Hidden admin panel for video curation and management (triple-A key access)
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Secure Authentication**: PKCE OAuth flow for safe Dropbox access

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Dropbox account
- Audio files in your Dropbox app folder

### Installation

1. **Clone and install dependencies**

   ```bash
   git clone git@github.com:rmpacheco/vorbis-player.git
   cd vorbis-player
   npm install
   ```

2. **Set up Dropbox App**
   - Create a new app at [Dropbox App Console](https://www.dropbox.com/developers/apps)
   - Choose "Scoped access" and "App folder" permissions
   - Add redirect URI: `http://localhost:3000/auth/dropbox/callback`
   - Copy your App Key

3. **Configure environment**

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Dropbox App Key
   ```

   Required in `.env.local`:

   ```
   VITE_DROPBOX_APP_KEY="your_dropbox_app_key_here"
   VITE_DROPBOX_REDIRECT_URI="http://localhost:3000/auth/dropbox/callback"
   ```

4. **Add music to Dropbox**
   - Upload audio files (MP3, WAV, FLAC, M4A, OGG) to your Dropbox app folder
   - Files are automatically sorted by track number if filenames start with numbers

5. **Start the app**

   ```bash
   npm run dev
   ```

6. **First run**
   - Open <http://localhost:3000>
   - Click "Connect Dropbox" to authenticate
   - Choose your preferred TV era mode (8️⃣0️⃣s ⓽⓪s)
   - Enjoy your music with curated retro TV content!

## How It Works

### Audio Playback

- Fetches audio files from your Dropbox app folder
- Supports common audio formats
- Full playback controls (play, pause, next, previous, volume)
- Auto-sorts tracks by number in filename

### Video Experience

- Shows curated retro TV content while music plays in two modes:
  - **80's TV** 8️⃣0️⃣s: Classic 80s television shows and content
  - **90's TV** ⓽⓪s: Nostalgic 90s television shows and content
- **Mode Switching**: Click emoji buttons in the header to instantly switch themes
- **Shuffle Feature**: Use the dedicated full-width shuffle bar with HyperText animation beneath videos to cycle through different videos within the selected mode
- **Optimized Viewport**: Square aspect ratio with smart cropping to maximize video content visibility
- **Persistence**: Your preferred mode is remembered across sessions
- Videos auto-play (muted) and loop for ambient visual experience

### Authentication

- Uses secure PKCE OAuth flow
- Tokens stored locally with automatic refresh
- App-scoped access (only accesses designated app folder, not entire Dropbox)

### Admin System

- **Hidden Access**: Press 'A' three times quickly to activate the admin panel
- **Video Management**: Preview, select, and delete videos from any mode
- **Bulk Operations**: Select multiple videos for batch deletion
- **Mode Switching**: Admin can switch between 80sTV/90sTV modes
- **Health Reporting**: Shows video count and collection status for each mode
- **No UI Clutter**: Completely hidden from normal users, activated only by secret key sequence

## Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production  
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Project Structure

```
src/
├── components/           # React components
│   ├── AudioPlayer.tsx  # Main audio player orchestrator
│   ├── MediaCollage.tsx # Video display with shuffle controls
│   ├── Playlist.tsx     # Track listing
│   ├── hyper-text.tsx   # Animated text component
│   └── admin/           # Admin panel components
│       ├── AdminKeyCombo.tsx  # Secret key sequence detector
│       └── VideoAdmin.tsx     # Video management interface
├── hooks/               # Custom React hooks
│   └── useDebounce.ts  # Debouncing utility hook
├── services/            # External service integrations
│   ├── dropbox.ts      # Dropbox API integration
│   ├── youtube.ts      # Video management
│   ├── images.ts       # Image processing utilities
│   └── adminService.ts # Admin panel backend services
├── assets/             # Static assets
│   ├── 80sTV-videoIds.json    # Curated 80s TV content
│   └── 90sTV-videoIds.json    # Curated 90s TV content
└── lib/                # Utilities
    ├── utils.ts        # Helper functions
    └── extractVideoIds.js # Video ID extraction utility

public/
├── sw.js               # Service worker for caching and offline support
└── vorbis_player_logo.jpg # Application logo
```

## Contributing

### Adding New Video Categories

1. Create a new JSON file in `src/assets/` (e.g., `2000sTV-videoIds.json`)
2. Add YouTube video IDs as an array of strings
3. Update the `VideoMode` type and mode selection logic in `MediaCollage.tsx`
4. Add the new mode to the emoji button array and helper functions

Use the included utility to extract video IDs from YouTube:

```bash
node src/lib/extractVideoIds.js saved-youtube-page.html 2000sTV-videoIds.json
```

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Audio**: react-modern-audio-player
- **Cloud Storage**: Dropbox API
- **Build Tool**: Vite with HMR

## Deployment

Build for production:

```bash
npm run build
```

The `dist/` folder contains static files that can be deployed to any web hosting service (Vercel, Netlify, GitHub Pages, etc.).

**Note**: Update the Dropbox redirect URI in your app settings to match your production domain.

## Troubleshooting

### "No audio files found"

- Ensure audio files are in your Dropbox app folder (not regular Dropbox folders)
- Check that files have supported extensions: .mp3, .wav, .flac, .m4a, .ogg
- Verify Dropbox app has `files.metadata.read` permissions

### Authentication Issues

- Double-check your App Key in `.env.local`
- Ensure redirect URI matches exactly in both `.env.local` and Dropbox app settings
- Try clearing browser storage and re-authenticating

### Videos Not Loading

- Check browser console for any network errors
- Ensure stable internet connection for YouTube embeds

## Command Line: Extract YouTube Video IDs from Playlist or Video

You can generate a video ID JSON file for a given category from a YouTube playlist or video URL using the CLI:

```
node src/lib/extractVideoIds.js youtube <youtube_url_or_id> <category>
```

- `<youtube_url_or_id>`: The full YouTube playlist/video URL (any format: playlist, watch, youtu.be, embed, etc) **or just the playlist ID**.
- `<category>`: A single word describing the content (e.g. `80sTV`, `90sTV`).

This will create (or overwrite) a file at `src/assets/<category>-videoIds.json` containing the extracted video IDs in the correct format for use as a mode.

**Examples:**

Extract from a playlist URL:
```
node src/lib/extractVideoIds.js youtube "https://www.youtube.com/playlist?list=PLRuEQW0xlqZrCaZ9dCubWD_WPSM8R6xjO" 80sTV
```

Extract from a playlist ID:
```
node src/lib/extractVideoIds.js youtube PLRuEQW0xlqZrCaZ9dCubWD_WPSM8R6xjO 80sTV
```

Extract from a single video:
```
node src/lib/extractVideoIds.js youtube "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 80sTV
```