# Standalone Spotify Audio Player Component

A self-contained, reusable Spotify audio player component extracted from the Vorbis Player project.

## Features

- **Complete Spotify Integration**: OAuth2 authentication with PKCE flow
- **Web Playback SDK**: Full playback control through Spotify's Web Playback SDK
- **Responsive Design**: Works on desktop and mobile devices
- **Playlist Support**: Shows user's playlists and liked songs
- **Player Controls**: Play/pause, skip, volume control
- **Track Display**: Current track info with album artwork
- **Self-contained**: No external dependencies beyond the existing Vorbis Player services

## Quick Start

### 1. View the Demo

Visit your Vorbis Player with the demo parameter:
```
http://localhost:5173/?demo=true
```

### 2. Basic Usage

```tsx
import SpotifyAudioPlayer from './components/SpotifyAudioPlayer';

function MyApp() {
  return (
    <div>
      <SpotifyAudioPlayer 
        className="w-full max-w-md mx-auto"
        showPlaylist={true}
        autoPlay={false}
      />
    </div>
  );
}
```

## Component Props

### `SpotifyAudioPlayerProps`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `""` | Additional CSS classes |
| `autoPlay` | `boolean` | `false` | Start playing first track automatically |
| `showPlaylist` | `boolean` | `true` | Show the track playlist below controls |

## Component Structure

The standalone player consists of several sub-components:

### `SpotifyAudioPlayer` (Main Component)
- Handles authentication state
- Manages track loading and playback
- Coordinates between services and UI components

### `TrackDisplay`
- Shows current track information
- Displays album artwork
- Track name, artist, and album

### `PlayerControls`
- Play/pause button
- Previous/next track buttons
- Volume slider
- Real-time playback state updates

### `PlaylistView`
- Scrollable list of available tracks
- Click to play functionality
- Visual indicator for current track
- Track duration display

## Dependencies

The standalone component reuses existing Vorbis Player services:

- `services/spotify.ts` - Authentication and API calls
- `services/spotifyPlayer.ts` - Spotify Web Playback SDK wrapper
- `types/spotify.d.ts` - TypeScript definitions

## Spotify Requirements

1. **Spotify Premium Account**: Required for Web Playback SDK
2. **Spotify App Registration**: 
   - Set `VITE_SPOTIFY_CLIENT_ID` in your `.env.local`
   - Set `VITE_SPOTIFY_REDIRECT_URI` in your `.env.local`
3. **HTTPS**: Required in production for Spotify Web Playback SDK

## Styling

The component uses Tailwind CSS classes with a dark theme:
- `bg-neutral-900` - Main background
- `text-white` - Primary text
- `text-gray-400` - Secondary text
- `bg-green-600` - Spotify green for buttons
- Responsive design with proper hover states

## Integration Examples

### Compact Player
```tsx
<SpotifyAudioPlayer 
  className="w-80"
  showPlaylist={false}
  autoPlay={false}
/>
```

### Auto-play Player
```tsx
<SpotifyAudioPlayer 
  className="w-full"
  showPlaylist={true}
  autoPlay={true}
/>
```

### Multiple Players
```tsx
<div className="grid grid-cols-2 gap-4">
  <SpotifyAudioPlayer showPlaylist={false} />
  <SpotifyAudioPlayer showPlaylist={false} />
</div>
```

## Error Handling

The component handles various error states:
- **Not Authenticated**: Shows Spotify login button
- **No Tracks Found**: Prompts user to add music to Spotify
- **Player Not Ready**: Disables controls until SDK loads
- **Network Errors**: Shows error messages with retry options

## Authentication Flow

1. User clicks "Connect Spotify"
2. Redirects to Spotify OAuth
3. User authorizes the application
4. Returns with authorization code
5. Exchanges code for access token
6. Initializes Web Playback SDK
7. Loads user's music library

## File Structure

```
src/components/
├── SpotifyAudioPlayer.tsx        # Main standalone component
├── SpotifyAudioPlayerExample.tsx # Usage examples
└── StandalonePlayerDemo.tsx      # Demo wrapper

src/
└── StandalonePlayerDemo.tsx      # Demo page with navigation
```

## Development

To test the standalone component:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Visit the demo page:
   ```
   http://localhost:5173/?demo=true
   ```

3. Test different configurations using the examples page

## Customization

The component is designed to be easily customizable:

- **Styling**: Modify Tailwind classes or add custom CSS
- **Layout**: Adjust component structure in render methods
- **Functionality**: Extend with additional Spotify API features
- **State Management**: Add Redux/Zustand for complex state needs

## Performance

- Uses React.memo for sub-components to prevent unnecessary re-renders
- Lazy loads track data and images
- Implements proper cleanup for event listeners
- Minimal API calls with caching through existing services

This standalone component gives you a complete, production-ready Spotify player that you can drop into any React application.