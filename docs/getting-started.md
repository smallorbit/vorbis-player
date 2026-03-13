# Getting Started

This guide walks you through installing and running Vorbis Player locally.

## Prerequisites

- **Node.js 18+** and npm
- A **Spotify Premium** account and/or a **Dropbox** account with music files
- Access to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) (for Spotify)
- Access to the [Dropbox Developer Console](https://www.dropbox.com/developers/apps) (for Dropbox, optional)

## Installation

```bash
git clone git@github.com:smallorbit/vorbis-player.git
cd vorbis-player
npm install
```

## Provider Setup

You need at least one music provider configured. Follow the setup guide for each provider you want to use:

- **[Spotify Setup Guide](./providers/spotify-setup.md)** — Create a Spotify developer app and get your Client ID
- **[Dropbox Setup Guide](./providers/dropbox-setup.md)** *(optional)* — Create a Dropbox app and configure file access permissions

## Environment Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Required (for Spotify):

```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id_here"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```

Optional (to enable Dropbox):

```
VITE_DROPBOX_CLIENT_ID="your_dropbox_app_key_here"
```

If `VITE_DROPBOX_CLIENT_ID` is omitted, the Dropbox provider is disabled and the app runs Spotify-only.

## Start the App

```bash
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser.

> **Important**: Use `127.0.0.1`, not `localhost`. Both Spotify and Dropbox OAuth require this exact address for local development.

## First Run

1. Click **Connect Spotify** to authenticate with Spotify, **or** open App Settings (gear icon) and connect Dropbox
2. Choose from your playlists/albums (Spotify) or browse your Dropbox folders
3. Start playing music!

## Next Steps

- **[User Guide](./user-guide.md)** — Learn about all player features, controls, and keyboard shortcuts
- **[Deployment Guide](./deployment/deploy-to-vercel.md)** — Deploy to Vercel for public access
- **[Troubleshooting](./troubleshooting.md)** — Common issues and solutions
