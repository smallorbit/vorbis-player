# Dropbox Provider Setup Guide

This guide walks you through creating a Dropbox app and configuring Vorbis Player to browse and play audio files stored in your Dropbox.

## Requirements

- A [Dropbox account](https://www.dropbox.com) (free tier works)
- Audio files organized in folders inside your Dropbox (see [File Organization](#file-organization) below)

## File Organization

Vorbis Player discovers albums by scanning your Dropbox for folders containing audio files. The expected structure is:

```
Dropbox/
└── Artist Name/
    └── Album Name/
        ├── cover.jpg          ← album art (optional)
        ├── 01 - Track One.mp3
        ├── 02 - Track Two.mp3
        └── ...
```

- Each folder containing audio files becomes an **album**
- The parent folder name is used as the **artist**
- Audio files at the root of your Dropbox (not in a subfolder) are skipped
- Supported formats: **MP3, FLAC, OGG/Vorbis, M4A/AAC, WAV**

**Album art**: Place an image file named `cover.jpg`, `cover.png`, `folder.jpg`, `album.jpg`, or `front.jpg` alongside your audio files. Track metadata (title, artist, track number) is read from embedded ID3 tags when available.

## Step 1: Create a Dropbox App

1. Go to the [Dropbox Developer Console](https://www.dropbox.com/developers/apps)
2. Click **Create app**
3. Configure the app:
   - **Choose an API**: Select **Scoped access**
   - **Choose the type of access**: Select **Full Dropbox** (recommended, so the app can see all your music folders)
   - **Name your app**: Enter any name, e.g. `vorbis-player`
4. Click **Create app**

## Step 2: Set Permissions

1. In your app's console, go to the **Permissions** tab
2. Enable the following scopes:
   - `files.metadata.read` — needed to list folders and files
   - `files.content.read` — needed to stream audio files
3. Click **Submit** to save the permissions

> If you don't see a Submit button, the permissions save automatically when toggled.

## Step 3: Add a Redirect URI

1. Go to the **Settings** tab of your app
2. Under **OAuth 2 / Redirect URIs**, add:
   ```
   http://127.0.0.1:3000/auth/dropbox/callback
   ```
3. Click **Add**

> **Important**: Use `http://127.0.0.1:3000` — not `http://localhost:3000`.

## Step 4: Copy Your App Key

On the **Settings** tab, copy the **App key** (this is your Dropbox Client ID).

## Step 5: Configure Your Environment

In your project root, open `.env.local` and add the following line:

```
VITE_DROPBOX_CLIENT_ID="your_app_key_here"
```

Replace `your_app_key_here` with the App key you copied in Step 4.

Your `.env.local` should now contain both Spotify and Dropbox credentials:

```
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
VITE_DROPBOX_CLIENT_ID="your_dropbox_app_key"
```

> **Note**: If `VITE_DROPBOX_CLIENT_ID` is not set, the Dropbox provider is disabled entirely and won't appear in App Settings.

## Step 6: Restart the Dev Server

If the dev server is already running, stop it and restart:

```bash
npm run dev
```

Environment variables are only picked up at server start — a restart is required after changing `.env.local`.

## Step 7: Connect Dropbox

1. Open [http://127.0.0.1:3000](http://127.0.0.1:3000)
2. Click the **gear icon** (bottom bar) → **App Settings**
3. Under **Music Sources**, find **Dropbox** and click **Connect**
4. You'll be redirected to Dropbox to authorize the app
5. After authorizing, click **Use this source** to switch the active provider to Dropbox
6. The app will scan your Dropbox and build a library — this may take a moment on the first load

## Deploying to Production

When deploying to a hosted environment:

1. In the [Dropbox Developer Console](https://www.dropbox.com/developers/apps), go to your app → **Settings**
2. Under **Redirect URIs**, add your production callback URL:
   ```
   https://your-app.vercel.app/auth/dropbox/callback
   ```
3. Set `VITE_DROPBOX_CLIENT_ID` in your hosting environment's environment variables

See [deploy-to-vercel.md](../deployment/deploy-to-vercel.md) for the full deployment guide.

## Troubleshooting

### Dropbox option not showing in App Settings
- Confirm `VITE_DROPBOX_CLIENT_ID` is set in `.env.local`
- Restart the dev server — environment variables are only read at startup

### "Invalid redirect URI" during Dropbox OAuth
- Check that `http://127.0.0.1:3000/auth/dropbox/callback` is listed under **Redirect URIs** in your Dropbox app's Settings tab
- Ensure you're opening the app at `http://127.0.0.1:3000` (not `localhost`)

### No albums appear after connecting
- Make sure your audio files are inside subfolders — files at the Dropbox root are skipped
- Check that the `files.metadata.read` and `files.content.read` permissions are enabled in your app's Permissions tab
- The first scan can take a while for large libraries; wait for the loading indicator to finish

### Album art not showing
- Place a `cover.jpg` (or `folder.jpg`, `album.jpg`, `front.jpg`) in the same folder as your audio files
- Art is cached in IndexedDB with a 7-day TTL; clear site data to force a fresh download

### Stale library / new files not appearing
- The catalog is cached in IndexedDB with a 1-hour TTL
- To force a refresh, clear site data in your browser's DevTools (Application → Storage → Clear site data)

### Dropbox auth errors after reconnecting
- Disconnect and reconnect from App Settings to clear stale tokens
- If errors persist, clear site data and try again
