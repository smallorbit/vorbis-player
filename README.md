# Vorbis Player

A React-based Spotify music player with visual effects and album art display.

<img src="src/assets/screenshot-player.png" alt="Vorbis Player" width="600">
<img src="src/assets/screenshot-playlist.png" alt="Vorbis Player - Playlist" width="600">

## Features

- **Spotify Integration**: Stream music from your Spotify account (Premium required)
- **Playlist Support**: Access playlists and Liked Songs with shuffle support
- **Visual Effects**: Dynamic album art with customizable filters and glow effects
- **Three-Column Layout**: Track info, controls, and settings in a fixed 768px x 880px layout
- **Responsive Design**: Mobile-optimized with touch-friendly controls

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Spotify Premium account
- Access to Spotify Developer Dashboard

### Installation

1. **Clone and install dependencies**

   ```bash
   git clone git@github.com:smallorbit/vorbis-player.git
   cd vorbis-player
   npm install
   ```

2. **Set up Spotify App**
   - Create a new app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Choose "Web Playback SDK" for planned API usage
   - Add redirect URI: `http://127.0.0.1:3000/auth/spotify/callback`
   - **Important**: Use `127.0.0.1` instead of `localhost` for Spotify OAuth compatibility
   - Copy your Client ID

3. **Configure environment**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Spotify Client ID
   ```

   Required in `.env.local`:

   ```
   VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id_here"
   VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
   ```

4. **Start the app**

   ```bash
   npm run dev
   ```

5. **First run**
   - Open <http://127.0.0.1:3000>
   - Click "Connect Spotify" to authenticate
   - Choose from your playlists or select "Liked Songs" for shuffled playback

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production  
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
├── components/           # React components
│   ├── AudioPlayer.tsx  # Main audio player orchestrator
│   ├── AlbumArt.tsx     # Album artwork display with visual effects
│   ├── Playlist.tsx     # Collapsible track listing drawer
│   ├── PlaylistSelection.tsx # Playlist selection interface
│   ├── LikeButton.tsx    # Heart-shaped button for liking/unliking tracks
│   ├── SpotifyPlayerControls.tsx # Three-column player control interface
│   ├── VisualEffectsMenu.tsx # Visual effects control menu
│   ├── styled/          # styled-components UI library
│   └── ui/              # Radix UI components and utilities
├── hooks/               # Custom React hooks
├── services/            # External service integrations
│   ├── spotify.ts      # Spotify Web API integration
│   └── spotifyPlayer.ts # Spotify Web Playback SDK
├── styles/             # Styling system
├── utils/              # Utilities
└── lib/                # Helper functions
```

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: styled-components with Radix UI primitives
- **Audio**: Spotify Web Playback SDK
- **Authentication**: Spotify Web API with PKCE OAuth
- **Testing**: Vitest with React Testing Library

## Deployment

### Deploy to Vercel (Recommended)

For detailed step-by-step instructions, see [deploy-to-vercel.md](./docs/deployment/deploy-to-vercel.md).

**Quick Deploy:**
1. Push your code to GitHub/GitLab/Bitbucket
2. Connect your repository to [Vercel](https://vercel.com)
3. Set environment variables:
   - `VITE_SPOTIFY_CLIENT_ID`: Your Spotify app's Client ID
   - `VITE_SPOTIFY_REDIRECT_URI`: `https://your-app.vercel.app/auth/spotify/callback`
4. Deploy!

### Manual Build

```bash
npm run build
```

The `dist/` folder contains static files that can be deployed to any web hosting service.

**Important**: 
- Update the Spotify redirect URI in your app settings to match your production domain
- Set up environment variables on your hosting platform

## Troubleshooting

### "No tracks found"
- Ensure you have a Spotify Premium subscription
- Create playlists with music or like some songs in Spotify
- Check that your Spotify account has music accessible

### Authentication Issues
- Double-check your Client ID in `.env.local`
- Ensure redirect URI matches exactly in both `.env.local` and Spotify app settings
- Use `127.0.0.1` instead of `localhost` for Spotify OAuth compatibility

### Visual Effects Issues
- If visual effects aren't working, try refreshing the page
- Clear localStorage to reset visual settings to defaults
- Ensure your browser supports CSS filters and backdrop-blur effects