# Apple Music Provider Setup Guide

This guide walks you through configuring Vorbis Player to stream music from your Apple Music library using MusicKit JS.

## Requirements

- An [Apple Developer account](https://developer.apple.com) (requires Apple Developer Program membership, $99/year)
- An [Apple Music subscription](https://www.apple.com/apple-music/) on the Apple ID you'll use to authenticate
- Node.js 18+ for local development

## Step 1: Create a MusicKit Identifier

1. Go to the [Apple Developer Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list/musicId) page
2. Click the **+** button to register a new identifier
3. Select **Media IDs** and click **Continue**
4. Fill in the details:
   - **Description**: Vorbis Player (or any name you prefer)
   - **Identifier**: A reverse-domain identifier (e.g., `com.yourname.vorbis-player`)
5. Check **MusicKit** under Services
6. Click **Continue**, then **Register**

## Step 2: Create a MusicKit Private Key

1. Go to [Keys](https://developer.apple.com/account/resources/authkeys/list) in your Apple Developer account
2. Click the **+** button to create a new key
3. Enter a **Key Name** (e.g., "Vorbis Player MusicKit Key")
4. Check **MusicKit** and select the Media ID you created in Step 1
5. Click **Continue**, then **Register**
6. **Download the private key** (`.p8` file) — you can only download it once!
7. Note your **Key ID** (shown on the key details page)
8. Note your **Team ID** (visible at the top-right of the Apple Developer portal, or under Membership)

## Step 3: Generate a Developer Token (JWT)

MusicKit JS requires a developer token — a signed JWT. You need to generate this from your private key.

### Using the `jsonwebtoken` npm package

Create a script (e.g., `generate-token.mjs`):

```javascript
import jwt from 'jsonwebtoken';
import fs from 'fs';

const privateKey = fs.readFileSync('path/to/AuthKey_XXXXXXXXXX.p8');
const teamId = 'YOUR_TEAM_ID';
const keyId = 'YOUR_KEY_ID';

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d',  // Max 6 months
  issuer: teamId,
  header: {
    alg: 'ES256',
    kid: keyId,
  },
});

console.log(token);
```

Run it:

```bash
npm install jsonwebtoken
node generate-token.mjs
```

Copy the output token — you'll use it in the next step.

> **Note**: Developer tokens expire after the duration you set (max 6 months). You'll need to regenerate when it expires.

## Step 4: Configure Your Environment

In your project root, open (or create) `.env.local` and add:

```bash
VITE_APPLE_MUSIC_DEVELOPER_TOKEN="your_developer_token_here"
```

Your full `.env.local` might look like:

```bash
# Spotify (required for Spotify playback)
VITE_SPOTIFY_CLIENT_ID="your_spotify_client_id"
VITE_SPOTIFY_REDIRECT_URI="http://127.0.0.1:3000/auth/spotify/callback"

# Dropbox (optional)
VITE_DROPBOX_CLIENT_ID="your_dropbox_app_key"

# Apple Music (optional)
VITE_APPLE_MUSIC_DEVELOPER_TOKEN="your_developer_token"
```

## Step 5: Start the App

```bash
npm run dev
```

Open <http://127.0.0.1:3000>. You should see Apple Music as an option in the provider picker.

## Step 6: Authenticate

1. Select **Apple Music** from the provider picker (or open App Settings and connect Apple Music)
2. A popup window will appear asking you to sign in with your Apple ID
3. Authorize the app to access your Apple Music library
4. The popup closes automatically and your library loads

> **Browser popup blockers**: The Apple Music auth flow uses a popup window. If your browser blocks it, allow popups for `127.0.0.1:3000` and try again.

## How It Works

- **Authentication**: MusicKit JS uses a popup-based Apple ID sign-in flow (no redirect callbacks). Your user token is stored in `localStorage` so you stay logged in across sessions.
- **Library browsing**: The app fetches your Apple Music library playlists and albums via the Apple Music API.
- **Playback**: MusicKit JS provides its own playback engine — no HTML5 Audio element or external SDK is needed. Playback happens directly through Apple's infrastructure.
- **Liked songs**: Uses the Apple Music ratings API. "Loved" songs (rating value = 1) are treated as liked songs, matching the Spotify liked songs concept.
- **External links**: Each track links to its Apple Music page via "Open in Apple Music".

## Features

| Feature | Supported |
|---------|-----------|
| Library playlists | Yes |
| Library albums | Yes |
| Liked songs (loved) | Yes |
| Like/unlike tracks | Yes |
| Open in Apple Music | Yes |
| Album art | Yes |
| Track metadata | Yes |

## Troubleshooting

### Apple Music Not Appearing in Provider Picker

- Verify `VITE_APPLE_MUSIC_DEVELOPER_TOKEN` is set in `.env.local`
- Restart the dev server after modifying `.env.local`
- Apple Music is always registered (unlike Dropbox which requires its env var) — if the token is missing, `ensureLoaded()` will fail at runtime with a clear error

### Auth Popup Blocked

- Allow popups for `127.0.0.1:3000` in your browser settings
- Ensure the "Connect" button click directly triggers `beginLogin()` — MusicKit's `authorize()` must be called from a user gesture to avoid popup blocking

### "VITE_APPLE_MUSIC_DEVELOPER_TOKEN is not set" Error

- Double-check that the token is in `.env.local` (not `.env`)
- Ensure the variable name is exactly `VITE_APPLE_MUSIC_DEVELOPER_TOKEN`
- Restart the dev server

### Developer Token Expired

- Developer tokens have a max lifetime of 6 months
- Regenerate the JWT using the script from Step 3
- Update `VITE_APPLE_MUSIC_DEVELOPER_TOKEN` in `.env.local` and restart

### No Playlists or Albums

- Ensure your Apple Music subscription is active
- Add music to your library in the Apple Music app first
- The library API only returns content you've explicitly added to your library

### Playback Not Starting

- Apple Music requires an active subscription on the authenticated Apple ID
- Check the browser console for MusicKit errors
- Some content may be region-restricted
