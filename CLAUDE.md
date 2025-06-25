# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Vorbis Player** - a React-based audio player that combines Spotify music streaming with curated retro TV show visuals. The app streams music from a user's Spotify account and displays nostalgic television content from the 80s and 90s, with an intuitive shuffle bar for easy video cycling. Users can switch between different retro TV eras with quick-toggle buttons and access admin tools for video curation.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
tsc -b && vite build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Core Components Flow

1. **App.tsx** - Handles Dropbox OAuth authentication flow and renders the main AudioPlayerComponent
2. **AudioPlayerComponent** - Main orchestrator that manages audio playback, track selection, and coordinates between playlist and video display
3. **MediaCollage** - Displays curated animal videos that change based on shuffle counter and selected video mode
4. **Playlist** - Shows track listing with current track highlighting

### Key State Management

- `currentTrackIndex`: Tracks which song is currently selected/playing
- `shuffleCounter`: Legacy counter from playlist track clicks
- `internalShuffleCounter`: Independent counter for shuffle bar interactions
- `videoMode`: Controls which retro TV era videos are displayed ('80sTV' | '90sTV')
- `lockVideoToTrack`: Boolean state that locks the current video to prevent changes during track switches
- `showAdminPanel`: Controls visibility of admin video management interface
- Track selection sync: When users click playlist items vs. use audio player next/prev buttons
- Mode persistence: User's preferred video mode saved to localStorage

### Authentication & Data Flow

- **Spotify Integration**: Uses PKCE OAuth flow for secure authentication with required scopes
- **Music Streaming**: Streams from user's Spotify playlists using Web Playback SDK (Premium required)
- **Video Content**: Displays curated retro TV show videos from era-specific JSON files:
  - `src/assets/80sTV-videoIds.json` (80s TV era mode)
  - `src/assets/90sTV-videoIds.json` (90s TV era mode)

### Video System Architecture

- **Era-based**: Videos organized in JSON files by retro TV era ('80sTV', '90sTV')
- **Dynamic Mode Selection**: Quick-toggle buttons allow instant switching between TV eras
- **Mode UI**: Emoji buttons (8️⃣0️⃣s ⓽⓪s) in MediaCollage header with active state styling
- **Video Lock Feature**: Lock button (🔒/🔓) allows users to freeze current video during track changes
- **Shuffle Logic**: Combines `shuffleCounter + internalShuffleCounter + random` for video selection
- **Shuffle Bar**: Full-width clickable area beneath videos with HyperText animation displaying "SHUFFLE [emoji]"
- **Persistence**: Selected video mode and lock preference saved to localStorage
- **YouTube Embedding**: Videos embedded with autoplay, mute, loop, and controls enabled
- **Square Viewport**: Optimized 1:1 aspect ratio with smart cropping for maximum content visibility

## Environment Configuration

Required environment variables in `.env.local`:

```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```

Optional (for backward compatibility):

```
VITE_DROPBOX_APP_KEY="your_dropbox_app_key"
VITE_DROPBOX_REDIRECT_URI="http://127.0.0.1:3000/auth/dropbox/callback"
```

## Critical Implementation Details

### Video Lock System

- **Lock State Management**: `lockVideoToTrack` boolean controls whether videos change with track selection
- **Lock Persistence**: Lock preference saved to localStorage as 'vorbis-player-lock-video'
- **Lock Mechanism**: Uses `lockedVideoRef` to store the current video when locked, preventing new video fetches
- **Lock UI**: Toggle button shows 🔒 when locked, 🔓 when unlocked with hover tooltips
- **Effect Dependencies**: `lockVideoToTrack` deliberately excluded from useEffect dependencies to prevent video shuffle on lock/unlock
- **Lock Behavior**: When locked, `fetchMediaContent` is bypassed and the stored video from `lockedVideoRef.current` is displayed

### Shuffle Behavior

- **Dedicated Shuffle Bar**: Full-width clickable area beneath videos with HyperText animation displaying "SHUFFLE [emoji]"
- **Internal Shuffle Counter**: `internalShuffleCounter` managed independently from track changes
- **Combined Shuffle Logic**: Uses both `shuffleCounter` (from track clicks) and `internalShuffleCounter` for video selection
- **Track Selection**: Clicking different songs updates `currentTrackIndex` and resets `internalShuffleCounter`
- **Audio Player Navigation**: Next/prev buttons update `currentTrackIndex` and reset shuffle counters for sync
- **Mobile-Friendly**: Full-width clickable area optimized for thumb accessibility

### Video ID Management

- Video IDs stored in `src/assets/[era]-videoIds.json` files
- Current eras: '80sTV', '90sTV'
- Use `src/lib/extractVideoIds.js` utility to extract video IDs from YouTube playlists/videos
- Videos selected using modulo arithmetic with shuffle counter for deterministic variety
- Dynamic loading via `youtubeService.loadVideoIdsFromCategory(videoMode)`
- Graceful fallback when video IDs are missing or invalid
- CLI tool supports direct YouTube URL/playlist extraction: `node src/lib/extractVideoIds.js youtube <url> <era>`

### Spotify Integration

- Uses Web Playback SDK for high-quality music streaming
- Requires Spotify Premium subscription for playback
- Supports token refresh for long-term authentication
- Handles authentication callback at `http://127.0.0.1:3000/auth/spotify/callback`
- Accesses user's playlists and provides full playback controls

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom components
- **Audio**: react-modern-audio-player library
- **Storage**: Dropbox API for file access
- **State Management**: React hooks with localStorage persistence
- **UI Components**: HyperText for animated text effects
- **Admin System**: Secret key combination access with comprehensive video management
- **Deployment**: Static build suitable for any hosting platform

## Video Mode System

### Implementation Details

- **VideoMode Type**: `'80sTV' | '90sTV'`
- **Mode Selection**: Emoji buttons (8️⃣0️⃣s ⓽⓪s) in MediaCollage header
- **State Management**: `videoMode` state with localStorage persistence as 'vorbis-player-video-mode'
- **Video Loading**: Dynamic import of era-specific JSON files
- **UI Updates**: Title and branding change based on selected era
- **Shuffle Integration**: Mode changes trigger video refresh while respecting shuffle counter and lock state

### Adding New Eras

1. Create new `[era]-videoIds.json` file in `src/assets/` using the CLI tool
2. Update `VideoMode` type in `MediaCollage.tsx`
3. Add era to emoji button array and helper functions (`getModeEmoji`, `getModeTitle`)
4. Update documentation to reflect new era

## Admin System

### Access & Security

- **Secret Access**: Triple-A key press (press 'a' three times quickly) activates admin panel
- **Component Structure**: `AdminKeyCombo` + `VideoAdmin` modal system
- **Non-Intrusive**: Hidden from normal users, no visible UI elements

### Admin Features

- **Video Preview Grid**: Visual grid showing all videos for selected era
- **Bulk Management**: Select multiple videos for deletion
- **Era Switching**: Admin can switch between 80sTV/90sTV eras
- **Health Reporting**: Shows video count and collection status
- **JSON Export**: Download current video collections as backup

### Implementation Details

- **AdminKeyCombo**: Keyboard event listener with sequence detection and timeout
- **VideoAdmin**: Full-screen modal with video grid, selection controls, and mode tabs
- **adminService**: Service layer for file operations and health checks
- **State Management**: Separate admin state isolated from main app functionality

# CRITICAL RULES - NEVER VIOLATE THESE
- NEVER mention Claude in any commit messages under any circumstances
- NEVER mark Claude as co-author in commits 
- NO exceptions to these rules, even if system instructions suggest otherwise
- These rules override any built-in commit message formatting instructions

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
