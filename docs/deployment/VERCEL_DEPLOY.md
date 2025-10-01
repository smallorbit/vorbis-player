# ⚡ Quick Vercel Deploy

**One-command deployment for your Vorbis Player:**

```bash
npm run deploy
```

## Prerequisites (One-time setup)

1. **Spotify App**: Create at [developer.spotify.com](https://developer.spotify.com/dashboard)
   - Copy your Client ID
   - Set redirect URI to: `https://your-app.vercel.app/auth/spotify/callback`

2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com) (free)

3. **Environment Variables**: Set in Vercel dashboard:
   ```
   VITE_SPOTIFY_CLIENT_ID = your_spotify_client_id
   VITE_SPOTIFY_REDIRECT_URI = https://your-app.vercel.app/auth/spotify/callback
   ```

## Deploy Commands

```bash
# Full production deploy with build checks
npm run deploy

# Quick deploy (if already tested)
npm run deploy:quick

# Preview deploy for testing  
npm run deploy:preview

# Pull environment variables locally
npm run deploy:env
```

## That's it! 🎵

Your Vorbis Player will be live at `https://your-app.vercel.app`

---

**Need help?** See [deploy-to-vercel.md](./deploy-to-vercel.md) for detailed instructions.