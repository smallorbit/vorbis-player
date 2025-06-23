# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Panda Player** - a React-based audio player that combines Dropbox music streaming with YouTube video visuals. The app fetches audio files from a user's Dropbox account and displays curated animal videos (pandas, puppies, or kitties) that shuffle when the same song is clicked repeatedly. Users can switch between different animal video modes with quick-toggle buttons.

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
- `shuffleCounter`: Increments when same song is clicked, triggers different video selection
- `videoMode`: Controls which animal category videos are displayed ('pandas' | 'puppies' | 'kitties')
- Track selection sync: When users click playlist items vs. use audio player next/prev buttons
- Mode persistence: User's preferred video mode saved to localStorage

### Authentication & Data Flow
- **Dropbox Integration**: Uses PKCE OAuth flow for secure authentication
- **Audio Files**: Fetched from user's Dropbox app folder, sorted by track number
- **Video Content**: Displays curated animal videos from category-specific JSON files:
  - `src/assets/panda-videoIds.json` (pandas mode)
  - `src/assets/puppies-videoIds.json` (puppies mode) 
  - `src/assets/kitties-videoIds.json` (kitties mode)

### Video System Architecture
- **Category-based**: Videos organized in JSON files by animal category ('pandas', 'puppies', 'kitties')
- **Dynamic Mode Selection**: Quick-toggle buttons allow instant switching between video categories
- **Mode UI**: Emoji buttons (🐼 🐶 🐱) in MediaCollage header with active state styling
- **Shuffle Logic**: Uses `shuffleCounter + random` to ensure different video selection on repeat clicks within selected mode
- **Persistence**: Selected video mode saved to localStorage and restored on page load
- **YouTube Embedding**: Videos embedded with autoplay, mute, loop, and controls enabled

## Environment Configuration

Required environment variables in `.env.local`:
```
VITE_DROPBOX_APP_KEY="your_dropbox_app_key"
VITE_DROPBOX_REDIRECT_URI="http://localhost:3000/auth/dropbox/callback"
```

Optional (for future API-based features):
```
VITE_YOUTUBE_API_KEY=""
VITE_UNSPLASH_ACCESS_KEY=""
```

## Critical Implementation Details

### Shuffle Behavior
- Clicking same song in playlist: Only increments `shuffleCounter`, keeps audio playing, changes video
- Clicking different song: Updates `currentTrackIndex`, resets `shuffleCounter` to 0
- Audio player next/prev: Updates both `currentTrackIndex` and resets `shuffleCounter` for sync

### Video ID Management
- Video IDs stored in `src/assets/[category]-videoIds.json` files
- Current categories: 'pandas', 'puppies', 'kitties'
- Use `src/lib/extractVideoIds.js` utility to parse YouTube HTML exports
- Videos selected using modulo arithmetic with shuffle counter for deterministic variety
- Dynamic loading via `youtubeService.loadVideoIdsFromCategory(videoMode)`
- Graceful fallback when video IDs are missing or invalid

### Dropbox Integration
- Uses app-scoped access (not full Dropbox access)
- Supports token refresh for long-term authentication
- Handles authentication callback at `/auth/dropbox/callback`
- Audio files must be in the root of the app's designated Dropbox folder

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom components
- **Audio**: react-modern-audio-player library
- **Storage**: Dropbox API for file access
- **State Management**: React hooks with localStorage persistence
- **Deployment**: Static build suitable for any hosting platform

## Video Mode System

### Implementation Details
- **VideoMode Type**: `'pandas' | 'puppies' | 'kitties'`
- **Mode Selection**: Emoji buttons in MediaCollage header
- **State Management**: `videoMode` state with localStorage persistence
- **Video Loading**: Dynamic import of category-specific JSON files
- **UI Updates**: Title and branding change based on selected mode
- **Shuffle Integration**: Mode changes trigger video refresh while respecting shuffle counter

### Adding New Modes
1. Create new `[category]-videoIds.json` file in `src/assets/`
2. Update `VideoMode` type in `MediaCollage.tsx`
3. Add mode to emoji button array and helper functions
4. Update documentation to reflect new category