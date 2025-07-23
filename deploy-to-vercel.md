# 🚀 Deploy Vorbis Player to Vercel

This guide will help you deploy your Vorbis Player to Vercel in just a few simple steps.

## Prerequisites

- A [Vercel account](https://vercel.com/signup) (free)
- A [Spotify Developer account](https://developer.spotify.com/dashboard)
- Your project repository on GitHub, GitLab, or Bitbucket

## Step 1: Prepare Your Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create App"
3. Fill in the details:
   - **App Name**: Vorbis Player (or your preferred name)
   - **App Description**: Modern Spotify music player
   - **Website**: Your Vercel URL (you'll update this after deployment)
   - **Redirect URI**: `https://your-app-name.vercel.app/auth/spotify/callback`
   - **Which API/SDKs are you planning to use?**: Web Playbook SDK
4. Save your app and copy the **Client ID**

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Connect your repository**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your repository from GitHub/GitLab/Bitbucket

2. **Configure the deployment**:
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (should auto-detect)
   - **Output Directory**: `dist` (should auto-detect)
   - **Install Command**: `npm install` (should auto-detect)

3. **Set Environment Variables**:
   Click "Environment Variables" and add:
   ```
   VITE_SPOTIFY_CLIENT_ID = your_client_id_from_step_1
   VITE_SPOTIFY_REDIRECT_URI = https://your-app-name.vercel.app/auth/spotify/callback
   ```
   > **Note**: Replace `your-app-name` with your actual Vercel app name

4. **Deploy**:
   - Click "Deploy"
   - Wait for the build to complete (usually 1-2 minutes)

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   # Deploy preview (optional)
   npm run deploy:preview
   
   # Deploy to production
   npm run deploy
   ```

4. **Set Environment Variables**:
   ```bash
   vercel env add VITE_SPOTIFY_CLIENT_ID
   # Enter your Spotify Client ID when prompted
   
   vercel env add VITE_SPOTIFY_REDIRECT_URI
   # Enter your Vercel app URL with callback path
   ```

## Step 3: Update Your Spotify App Settings

1. Go back to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Click "Edit Settings"
4. Update the **Redirect URIs** to include your Vercel URL:
   ```
   https://your-actual-vercel-app-name.vercel.app/auth/spotify/callback
   ```
5. Save the changes

## Step 4: Test Your Deployment

1. Visit your Vercel app URL
2. Click "Connect Spotify"
3. Authorize the app with Spotify
4. Start playing your music!

## Automatic Deployments

Once connected to your repository, Vercel will automatically:
- Deploy every push to your main branch to production
- Create preview deployments for pull requests
- Provide deployment previews for testing

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SPOTIFY_CLIENT_ID` | Your Spotify app's Client ID | `abc123def456ghi789` |
| `VITE_SPOTIFY_REDIRECT_URI` | Your app's callback URL | `https://thenameofyour.vercel.app/auth/spotify/callback` |

## Custom Domain (Optional)

To use a custom domain:

1. Go to your Vercel project dashboard
2. Click "Domains"
3. Add your custom domain
4. Update your Spotify app's redirect URI to use your custom domain

## Troubleshooting

### "Invalid Redirect URI" Error
- Ensure the redirect URI in your Spotify app exactly matches your Vercel URL
- Use HTTPS (Vercel provides this automatically)
- Include the full path: `/auth/spotify/callback`

### Environment Variables Not Working
- Make sure variable names start with `VITE_` for client-side access
- Redeploy after adding environment variables
- Check the deployment logs for any errors

### Build Failures
- Check that all dependencies are listed in `package.json`
- Ensure your Node.js version is compatible (Vercel uses Node 18 by default)
- Review build logs in the Vercel dashboard

## Development Workflow

For ongoing development:

1. **Local development**:
   ```bash
   npm run dev
   ```

2. **Test production build locally**:
   ```bash
   npm run build
   npm run preview
   ```

3. **Deploy preview for testing**:
   ```bash
   npm run deploy:preview
   ```

4. **Deploy to production**:
   ```bash
   npm run deploy
   ```

## Performance Optimizations

Your app is already optimized for Vercel with:
- ✅ Static site generation
- ✅ Automatic code splitting
- ✅ Image optimization
- ✅ Edge caching
- ✅ Gzip compression
- ✅ Security headers

## Support

If you encounter any issues:
1. Check the [Vercel documentation](https://vercel.com/docs)
2. Review the [Spotify Web API documentation](https://developer.spotify.com/documentation/web-api/)
3. Check your browser's developer console for errors
4. Review deployment logs in the Vercel dashboard

---

🎵 **Enjoy your music!** Your Vorbis Player is now live on the web and ready to stream your Spotify playlists and liked songs.
