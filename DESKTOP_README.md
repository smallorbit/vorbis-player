# Vorbis Player Desktop

A beautiful, transparent desktop application for Spotify with advanced visual effects, dynamic color extraction, and seamless desktop integration.

## Features

### 🎵 Core Music Features
- **Spotify Integration**: Full access to your Spotify account, playlists, and liked songs
- **Advanced Visual Effects**: Dynamic color extraction from album art with customizable glow effects
- **Playlist Management**: Browse and play your Spotify playlists with a beautiful interface
- **Real-time Controls**: Play, pause, skip, seek, and volume control with smooth animations

### 🖥️ Desktop-Specific Features
- **Transparent Background**: Glass morphism effects that blend seamlessly with your desktop
- **Always-on-Top Mode**: Keep the player visible above other applications
- **Global Shortcuts**: Control music playback from anywhere with keyboard shortcuts
- **Media Key Support**: Hardware media keys work out of the box
- **System Tray Integration**: Minimize to system tray with right-click context menu
- **System Notifications**: Track change notifications with album art and playback controls
- **Window Management**: Custom window controls with platform-specific styling

### 🎨 Visual Enhancements
- **Dynamic Color Extraction**: Real-time color analysis from album artwork
- **Glow Effects**: Customizable accent color glow with intensity and rate controls
- **Album Art Filters**: Brightness, saturation, sepia, and contrast adjustments
- **Smooth Animations**: 60fps animations optimized for desktop performance
- **Responsive Design**: Adapts to different window sizes and screen resolutions

## Installation

### Prerequisites
- Node.js 18+ and npm
- Spotify Premium account (required for playback control)
- Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vorbis-player
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Spotify API credentials**
   - Create a Spotify app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Add `http://localhost:3000/auth/spotify/callback` to your app's redirect URIs
   - Create a `.env.local` file with your credentials:
     ```
     VITE_SPOTIFY_CLIENT_ID=your_client_id
     VITE_SPOTIFY_CLIENT_SECRET=your_client_secret
     VITE_SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/spotify/callback
     ```

4. **Start the development server**
   ```bash
   # Web version
   npm run dev
   
   # Desktop version
   npm run electron:dev
   ```

### Building for Production

1. **Build the application**
   ```bash
   npm run electron:build
   ```

2. **Find the installer**
   - **Windows**: `dist-electron/VorbisPlayer-Setup-{version}.exe`
   - **macOS**: `dist-electron/VorbisPlayer-{version}.dmg`
   - **Linux**: `dist-electron/VorbisPlayer-{version}.AppImage`

## Usage

### First Launch
1. Launch the Vorbis Player desktop application
2. Click "Connect to Spotify" to authenticate
3. Grant the necessary permissions to access your Spotify account
4. Start enjoying your music with beautiful visual effects!

### Keyboard Shortcuts

#### Global Shortcuts (work from any application)
- **Media Keys**: Play/Pause, Next Track, Previous Track
- **Ctrl/Cmd + Shift + V**: Show/Hide Vorbis Player
- **Ctrl/Cmd + Shift + T**: Toggle Always-on-Top mode

#### In-App Shortcuts
- **Space**: Play/Pause
- **Left Arrow**: Previous Track
- **Right Arrow**: Next Track
- **Up Arrow**: Volume Up
- **Down Arrow**: Volume Down

### Window Controls
- **Minimize**: Minimizes to system tray
- **Maximize/Restore**: Toggles full window size
- **Close**: Hides to system tray (use system tray to quit)

### System Tray
Right-click the system tray icon for:
- Show/Hide Vorbis Player
- Toggle Always-on-Top
- Media controls (Play/Pause, Next, Previous)
- Quit application

## Configuration

### Visual Effects
- **Glow Intensity**: Adjust the brightness of the accent color glow
- **Glow Rate**: Control the animation speed of the glow effect
- **Album Filters**: Modify brightness, saturation, sepia, and contrast
- **Color Extraction**: Enable/disable real-time color analysis

### Desktop Settings
- **Always-on-Top**: Keep the player visible above other windows
- **Transparency**: Adjust the background transparency level
- **Window Position**: The app remembers your preferred window position
- **Notifications**: Enable/disable track change notifications

## Development

### Project Structure
```
src/
├── components/           # React components
│   ├── DesktopWindowControls.tsx
│   └── ...
├── hooks/               # Custom React hooks
│   ├── useDesktopIntegration.ts
│   └── ...
├── services/            # Business logic services
│   ├── globalShortcuts.ts
│   ├── desktopNotifications.ts
│   └── ...
├── styles/              # Styling
│   ├── desktop.css
│   └── ...
└── utils/               # Utility functions
    ├── desktopUtils.ts
    └── ...

electron/
├── main.js             # Main Electron process
└── preload.js          # Preload script for IPC
```

### Available Scripts
- `npm run dev`: Start web development server
- `npm run electron:dev`: Start desktop development with hot reload
- `npm run build`: Build for production
- `npm run electron:build`: Build desktop application
- `npm run electron:preview`: Preview built desktop app
- `npm run test`: Run unit tests
- `npm run test:coverage`: Run tests with coverage

### Testing
```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern=useDesktopIntegration

# Run tests with UI
npm run test:ui
```

## Troubleshooting

### Common Issues

**Authentication fails**
- Ensure your Spotify app redirect URI matches exactly
- Check that your client ID and secret are correct
- Try clearing the app's stored data

**Media keys not working**
- On Windows: Ensure the app has focus or is in the foreground
- On macOS: Grant accessibility permissions in System Preferences
- On Linux: Install required media key packages

**Performance issues**
- Disable visual effects in settings
- Reduce glow intensity and rate
- Close other resource-intensive applications

**Window transparency not working**
- Update your graphics drivers
- Ensure hardware acceleration is enabled
- On Linux: Install required compositor packages

### Logs and Debugging
- **Development**: Check the browser console and Electron DevTools
- **Production**: Logs are stored in the app's data directory
- **macOS**: `~/Library/Logs/Vorbis Player/`
- **Windows**: `%APPDATA%\Vorbis Player\logs\`
- **Linux**: `~/.config/Vorbis Player/logs/`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style and patterns
- Write tests for new features
- Update documentation for API changes
- Test on multiple platforms when possible

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Spotify Web API**: For music streaming and playback control
- **Electron**: For cross-platform desktop application framework
- **React**: For the user interface framework
- **Styled Components**: For component-based styling
- **Radix UI**: For accessible UI primitives

## Support

- **Issues**: Report bugs and feature requests on GitHub
- **Discussions**: Join community discussions for help and ideas
- **Documentation**: Check the [main README](README.md) for web version details

---

**Note**: This desktop application requires a Spotify Premium account for full functionality. Some features may be limited with a free account.