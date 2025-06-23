# Panda Player 🐼🎵

A modern audio player that combines Dropbox music streaming with curated panda video visuals. Stream your music from Dropbox while enjoying delightful panda videos that shuffle with each track.

## Features

- **Dropbox Integration**: Stream audio files directly from your Dropbox account
- **Visual Experience**: Curated panda videos that complement your music
- **Smart Shuffle**: Click the same song repeatedly to cycle through different videos
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
   git clone <repository-url>
   cd vap
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
   - Open http://localhost:3000
   - Click "Connect Dropbox" to authenticate
   - Enjoy your music with panda videos! 🐼

## How It Works

### Audio Playback
- Fetches audio files from your Dropbox app folder
- Supports common audio formats
- Full playback controls (play, pause, next, previous, volume)
- Auto-sorts tracks by number in filename

### Video Experience
- Shows curated panda videos while music plays
- **Shuffle Feature**: Click the same song in the playlist to see different panda videos
- Videos auto-play (muted) and loop for ambient visual experience

### Authentication
- Uses secure PKCE OAuth flow
- Tokens stored locally with automatic refresh
- App-scoped access (only accesses designated app folder, not entire Dropbox)

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
│   ├── MediaCollage.tsx # Panda video display
│   ├── Playlist.tsx     # Track listing
│   └── ui/              # Reusable UI components
├── services/            # External service integrations
│   ├── dropbox.ts      # Dropbox API integration
│   └── youtube.ts      # Video management
├── assets/             # Static assets
│   └── panda-videoIds.json  # Curated video collection
└── lib/                # Utilities
    └── utils.ts        # Helper functions
```

## Contributing

### Adding New Video Categories

1. Create a new JSON file in `src/assets/` (e.g., `cats-videoIds.json`)
2. Add YouTube video IDs as an array of strings
3. Update the video loading logic in `MediaCollage.tsx`

Use the included utility to extract video IDs from YouTube:
```bash
node src/lib/extractVideoIds.js saved-youtube-page.html cats-videoIds.json
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

