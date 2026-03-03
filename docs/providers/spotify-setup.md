# Spotify Provider Setup Guide

This guide walks you through creating a Spotify developer app and configuring Vorbis Player to stream music from your Spotify account.

## Requirements

- A [Spotify account](https://www.spotify.com) — **Premium subscription required** for playback
- A [Spotify Developer account](https://developer.spotify.com) (free, same login as your Spotify account)

## Step 1: Create a Spotify App

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create app**
3. Fill in the app details:
   - **App name**: Vorbis Player (or any name you prefer)
   - **App description**: Personal music player
   - **Redirect URI**: Add `http://127.0.0.1:3000/auth/spotify/callback`
   - **Which API/SDKs are you planning to use?**: Check **Web Playback SDK**
4. Agree to the Developer Terms of Service and click **Save**

> **Important**: Use `http://127.0.0.1:3000` — not `http://localhost:3000`. Spotify's OAuth requires this exact address.

## Step 2: Copy Your Client ID

1. On your app's dashboard page, click **Settings**
2. Copy the **Client ID** — you'll need it in the next step

## Step 3: Configure Your Environment

In your project root, open (or create) `.env.local` and add:

```
VITE_SPOTIFY_CLIENT_ID="your_client_id_here"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"
```

Replace `your_client_id_here` with the Client ID you copied in Step 2.

> If you cloned this repo, copy the example file first: `cp .env.example .env.local`

## Step 4: Start the App

```bash
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser (not `localhost`).

## Step 5: Connect Spotify

1. Click **Connect Spotify** on the welcome screen
2. You'll be redirected to Spotify to authorize the app
3. After authorizing, you'll be sent back to the player
4. Your playlists and Liked Songs will load automatically

## Deploying to Production

When deploying (e.g., to Vercel), you'll need to update the redirect URI:

1. Go back to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → your app → **Settings**
2. Under **Redirect URIs**, add your production URL:
   ```
   https://your-app.vercel.app/auth/spotify/callback
   ```
3. Update `VITE_SPOTIFY_REDIRECT_URI` in your hosting environment's settings to match
4. Save the changes

See [deploy-to-vercel.md](../deployment/deploy-to-vercel.md) for the full deployment guide.

## Troubleshooting

### "INVALID_CLIENT: Invalid redirect URI"
- Ensure the redirect URI in your `.env.local` exactly matches what you entered in the Spotify Dashboard (including the scheme, host, port, and path)
- Use `http://127.0.0.1:3000` — not `localhost`

### Auth loop / redirect keeps repeating
- Clear your browser's cookies and site data for `127.0.0.1`
- Check that `VITE_SPOTIFY_CLIENT_ID` is set correctly in `.env.local`
- Restart the dev server after changing `.env.local`

### "No tracks found" after connecting
- Spotify Premium is required for playback via the Web Playback SDK
- Make sure your account has playlists with tracks, or has liked some songs

### Player shows "Playback not available"
- Open Spotify on another device (desktop app, mobile, web player) to activate a session, then try again — the Web Playback SDK sometimes requires an active Spotify session
- Check the browser console for errors; a 403 or 401 response usually points to a token or Premium issue
