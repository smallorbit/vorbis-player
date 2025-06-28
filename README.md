# Vorbis Player

A modern audio player that streams music from your Spotify account with a clean, responsive interface designed for music discovery and playback.

<img src="public/screenshot.png" alt="Vorbis Player Interface" width="600">

## Features

- **Spotify Integration**: Stream music directly from your Spotify account (Premium required)
- **Modern Playlist Design**: Clean card-based playlist with album artwork and responsive visual hierarchy
- **Intuitive Controls**: Essential playback controls with professional design and mobile-responsive layout
- **Album Art Backgrounds**: Dynamic album artwork backgrounds that enhance the visual experience
- **Modern UI**: Clean, responsive design with styled-components and custom theme system
- **Secure Authentication**: PKCE OAuth flow for secure Spotify access

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Spotify Premium account
- Access to Spotify Developer Dashboard

### Installation

1. **Clone and install dependencies**

   ```bash
   git clone git@github.com:rmpacheco/vorbis-player.git
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
   cp .env.local.example .env.local
   # Edit .env.local with your Spotify Client ID
   ```

   Required in `.env.local`:

   ```
   VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id_here"
   VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
   ```

4. **Prepare your Spotify account**
   - Ensure you have a Spotify Premium subscription
   - Create playlists with your favorite music
   - The app will access your playlists to display tracks

5. **Start the app**

   ```bash
   npm run dev
   ```

6. **First run**
   - Open <http://127.0.0.1:3000>
   - Click "Connect Spotify" to authenticate
   - Enjoy your music with the clean, modern interface!

## How It Works

### Audio Playback

- Streams music from your Spotify playlists
- Full-quality streaming with Spotify Premium
- Essential playback controls (play, pause, next, previous, mute)
- Access to your personal music library and playlists
- Modern playlist interface with album artwork and clean visual design

### Authentication

- Uses secure PKCE OAuth flow
- Tokens stored locally with automatic refresh
- Required scopes: streaming, user-read-email, user-read-private, user-read-playback-state
- Requires Spotify Premium for playback functionality

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
│   ├── Playlist.tsx     # Track listing
│   ├── hyper-text.tsx   # Animated text component
│   └── styled/          # styled-components UI library
│       ├── Avatar.tsx   # Image component with fallback support
│       ├── Button.tsx   # Button component with variants
│       ├── Card.tsx     # Card layout components
│       └── index.ts     # Component exports
├── hooks/               # Custom React hooks
│   └── useDebounce.ts  # Debouncing utility hook
├── services/            # External service integrations
│   ├── spotify.ts      # Spotify Web API integration
│   └── spotifyPlayer.ts # Spotify Web Playback SDK
├── styles/             # Styling system
│   ├── theme.ts        # Design tokens and theme configuration
│   └── utils.ts        # styled-components utility mixins
└── lib/                # Utilities
    └── utils.ts        # Helper functions

public/
├── sw.js               # Service worker for caching and offline support
└── vorbis_player_logo.jpg # Application logo
```

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: styled-components with custom theme system
- **Audio**: Spotify Web Playback SDK
- **Authentication**: Spotify Web API with PKCE OAuth
- **Build Tool**: Vite with HMR

## Deployment

Build for production:

```bash
npm run build
```

The `dist/` folder contains static files that can be deployed to any web hosting service (Vercel, Netlify, GitHub Pages, etc.).

**Note**: Update the Spotify redirect URI in your app settings to match your production domain.

## Troubleshooting

### "No tracks found"

- Ensure you have a Spotify Premium subscription
- Create playlists with music or like some songs in Spotify
- Check that your Spotify account has music accessible
- Verify your Spotify app has the correct scopes and permissions

### Authentication Issues

- Double-check your Client ID in `.env.local`
- Ensure redirect URI matches exactly in both `.env.local` and Spotify app settings
- Use `127.0.0.1` instead of `localhost` for Spotify OAuth compatibility
- Try clearing browser storage and re-authenticating
