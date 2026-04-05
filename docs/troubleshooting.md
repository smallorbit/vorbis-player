# Troubleshooting

Common issues and solutions for Vorbis Player.

## Spotify

### "No tracks found"

- Ensure you have a **Spotify Premium** subscription (required for Web Playback SDK)
- Create playlists with music or like some songs in Spotify

### Authentication Issues

- Double-check your Client ID in `.env.local`
- Ensure redirect URI matches **exactly** in both `.env.local` and Spotify app settings
- Use `127.0.0.1` instead of `localhost`
- Clear your browser's cookies and site data for `127.0.0.1`
- Restart the dev server after changing `.env.local`

### Player Shows "Playback not available"

- Open Spotify on another device (desktop app, mobile, web player) to activate a session, then try again
- Check the browser console for errors; a 403 or 401 response usually points to a token or Premium issue

For the full Spotify setup walkthrough, see the [Spotify Setup Guide](./providers/spotify-setup.md).

## Dropbox

### Dropbox Not Appearing in Settings

- Make sure `VITE_DROPBOX_CLIENT_ID` is set in `.env.local`
- Restart the dev server — environment variables are only read at startup

### Authentication Issues

- Verify that `http://127.0.0.1:3000/auth/dropbox/callback` is added in your Dropbox app's **Settings** tab
- Confirm the Dropbox app has `files.metadata.read` and `files.content.read` permissions enabled
- Try disconnecting and reconnecting from App Settings; this clears stale tokens

### No Albums / No Tracks

- Ensure your Dropbox contains audio files (MP3, FLAC, OGG, M4A, WAV) organized in folders
- Expected structure: `/<Artist>/<Album>/<track.mp3>` or `/<Album>/<track.mp3>`
- Folders with no audio files are not listed as albums
- After connecting, give the app a moment to scan your Dropbox (the first load enumerates all files recursively)

### Album Art Not Showing

- Place an image file (`cover.jpg`, `folder.png`, `album.jpg`, etc.) in the same folder as your audio files
- Art is cached in IndexedDB with a 7-day TTL; clearing site data forces a fresh download

### Stale Library / New Files Not Appearing

- The catalog is cached in IndexedDB with a 1-hour TTL
- To force a refresh: clear site data in DevTools (Application > Storage > Clear site data)

For the full Dropbox setup walkthrough, see the [Dropbox Setup Guide](./providers/dropbox-setup.md).

## Visual Effects

- **Settings not applying**: Clear localStorage to reset visual settings to defaults
- **Background visualizer not working**: Requires Canvas API support in your browser
- **CSS filters not working**: Requires a modern browser (Chrome, Firefox, Safari, Edge)

## Debug Logging

Detailed queue / Spotify Web API / radio / Dropbox sync tracing uses the [`debug`](https://www.npmjs.com/package/debug) package via `src/lib/debugLog.ts`. By default these messages are silent.

In the browser devtools console:

```js
localStorage.debug = 'vorbis:*'; location.reload()
```

Subset examples: `vorbis:queue`, `vorbis:spotify`, `vorbis:radio`, `vorbis:dropbox-sync`, `vorbis:app`, `vorbis:sw`. Disable: `localStorage.removeItem('debug'); location.reload()`.

In Node (e.g. one-off scripts): `DEBUG=vorbis:* node …`.

**Still always printed:** `console.warn` / `console.error` for failures, rate limits, and missing config. **Separate:** in-app profiling (`?profile=true` or `vorbis-player-profiling` + Ctrl+Shift+P) still records metrics and may emit `console.debug` from context hooks when enabled.

## General

### App Won't Start

- Check that Node.js 18+ is installed: `node --version`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Verify `.env.local` exists and contains the required variables

### Environment Variables Not Taking Effect

- Restart the dev server after any changes to `.env.local`
- Ensure variable names start with `VITE_` (required by Vite for client-side access)
