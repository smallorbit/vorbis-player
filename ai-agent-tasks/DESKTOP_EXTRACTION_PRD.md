# Vorbis Desktop: Desktop Application Extraction PRD

## Executive Summary

This Product Requirements Document (PRD) outlines the strategic extraction of the desktop version of the Vorbis Player into a separate, dedicated codebase. The current dual-mode architecture has grown increasingly complex, with conditional logic, environment detection, and platform-specific services scattered throughout the codebase. This extraction will create two focused applications: **Vorbis Web** (Spotify-focused web application) and **Vorbis Desktop** (local music library desktop application).

### Project Goals
- **Simplify Maintenance**: Eliminate dual-mode complexity and conditional logic
- **Improve Performance**: Optimize each application for its specific platform and use case
- **Enable Independent Development**: Allow parallel development and releases
- **Reduce Bundle Size**: Remove unused dependencies and code paths
- **Enhance User Experience**: Provide platform-optimized interfaces and features

---

## Current Architecture Analysis

### Dual-Mode Implementation
The current codebase uses environment detection (`utils/environment.ts`) to determine runtime context:
- `isElectron()` / `isWeb()` - Platform detection
- `shouldEnableSpotify()` / `shouldEnableLocalMusic()` - Feature flags
- `getAppMode()` - Returns 'local' or 'spotify' mode

### Complexity Points
1. **Conditional Rendering**: Components like `AudioPlayer.tsx`, `LibraryNavigation.tsx` contain platform-specific logic
2. **Service Layer Duplication**: Separate services for Spotify (`spotifyPlayer.ts`) and local audio (`localAudioPlayer.ts`)
3. **Build Configuration**: Dual build systems (Vite for web, Electron-Vite for desktop)
4. **Dependency Overhead**: Electron dependencies in web builds, web-specific packages in desktop
5. **Testing Complexity**: Dual test environments and mocking strategies

### Desktop-Specific Features
- **Local Music Library**: File system scanning, metadata extraction, SQLite database
- **Local Audio Playback**: Native audio processing without streaming limitations  
- **File System Integration**: Directory selection, file watching, artwork scanning
- **Native OS Integration**: Title bar, system notifications, keyboard shortcuts
- **Database Management**: Enhanced local library with FTS search, performance metrics
- **Image Processing**: Sharp-based artwork optimization and processing

### Web-Specific Features
- **Spotify Integration**: Web Playback SDK, OAuth authentication, playlist management
- **Streaming Optimization**: Network-aware playback, progressive loading
- **Web APIs**: Service workers, web notifications, media session
- **Responsive Design**: Mobile-first approach, touch interactions
- **PWA Features**: Offline capabilities, app installation prompts

---

## Proposed Solution: Vorbis Desktop

### Project Structure
```
vorbis-desktop/
├── package.json                 # Desktop-focused dependencies
├── electron/                    # Electron main process
│   ├── main.ts                 # Application entry point
│   ├── preload.ts              # Renderer bridge
│   └── ipc/                    # IPC handlers
├── src/
│   ├── components/             # Desktop-optimized components
│   ├── services/               # Local music services only
│   ├── utils/                  # Desktop utilities
│   ├── hooks/                  # Local library hooks
│   └── types/                  # Desktop-specific types
├── assets/                     # Desktop assets and icons
├── database/                   # SQLite schema and migrations
└── scripts/                    # Build and deployment scripts
```

### Core Features

#### 1. Local Music Library Management
- **Advanced File Scanning**: Recursive directory scanning with configurable filters
- **Metadata Extraction**: Support for MP3, FLAC, WAV, OGG, M4A, AAC formats
- **Album Artwork**: Embedded and directory-based artwork with optimization
- **Database**: SQLite with FTS (Full-Text Search) for fast queries
- **Performance Monitoring**: Scan progress, error handling, performance metrics

#### 2. Audio Playback Engine
- **Native Audio**: Direct file playback without streaming overhead
- **Format Support**: Wide codec support through native libraries
- **Gapless Playback**: Seamless transitions between tracks
- **Audio Effects**: Equalizer, crossfade, replay gain
- **Queue Management**: Advanced playlist and queue handling

#### 3. Desktop Integration
- **Native Menus**: Platform-specific menu bars and context menus
- **Keyboard Shortcuts**: Global and local hotkeys
- **System Integration**: Media keys, system notifications, taskbar controls
- **File Associations**: Register as default music player
- **Auto-updater**: Seamless application updates

#### 4. User Interface
- **Native Look**: Platform-appropriate styling (Windows/macOS/Linux)
- **Dark/Light Themes**: System theme integration
- **Customizable Layout**: Resizable panels, custom views
- **Accessibility**: Screen reader support, keyboard navigation
- **Performance**: 60fps animations, optimized rendering

#### 5. Data Management
- **Library Organization**: Automatic artist/album/genre organization
- **Smart Playlists**: Dynamic playlists based on criteria
- **Statistics**: Play counts, listening history, trends
- **Backup/Restore**: Library data export/import
- **Sync**: Optional cloud sync for playlists and preferences

---

## Technical Requirements

### Dependencies (Desktop-Only)
```json
{
  "electron": "^34.0.0",
  "better-sqlite3": "^12.2.0",
  "music-metadata": "^11.8.2",
  "sharp": "^0.34.3",
  "chokidar": "^4.0.3",
  "electron-builder": "^25.1.8"
}
```

### Removed Web Dependencies
- Spotify Web Playback SDK
- Web-specific React components
- PWA service worker dependencies
- Vercel deployment scripts
- Web authentication flows

### Build Configuration
- **Electron Builder**: Native installers for Windows/macOS/Linux
- **TypeScript**: Strict mode with desktop-specific types
- **Vite**: Optimized for Electron renderer process
- **Native Modules**: Proper handling of native dependencies
- **Code Signing**: Platform-specific signing for distribution

### Performance Targets
- **Startup Time**: < 2 seconds cold start
- **Memory Usage**: < 200MB baseline, < 500MB with large libraries
- **Scan Performance**: > 1000 files/second on SSD
- **UI Responsiveness**: 60fps animations, < 16ms frame time
- **Database Queries**: < 100ms for complex searches

---

## Migration Strategy

### Phase 1: Repository Setup (Week 1)
1. Create new `vorbis-desktop` repository
2. Copy relevant files from main codebase
3. Remove web-specific dependencies and code
4. Configure Electron build system
5. Establish CI/CD pipeline

### Phase 2: Core Extraction (Weeks 2-3)
1. Extract local music services and components
2. Remove environment detection logic
3. Simplify component structure
4. Update import paths and dependencies
5. Configure desktop-specific build

### Phase 3: Desktop Optimization (Weeks 4-5)
1. Enhance native OS integration
2. Optimize database performance
3. Improve audio playback engine
4. Add desktop-specific features
5. Implement auto-updater

### Phase 4: Testing & Polish (Week 6)
1. Comprehensive testing across platforms
2. Performance optimization
3. UI/UX refinements
4. Documentation updates
5. Beta testing with users

### Phase 5: Release & Maintenance (Week 7+)
1. Production release
2. Monitor performance and issues
3. Gather user feedback
4. Plan future enhancements
5. Establish maintenance schedule

---

## Risk Assessment

### Technical Risks
- **Native Dependencies**: SQLite and Sharp compilation across platforms
- **Performance Regressions**: Ensuring desktop app maintains current performance
- **Data Migration**: Safely migrating existing user libraries
- **Platform Compatibility**: Testing across Windows/macOS/Linux variants

### Mitigation Strategies
- Pre-built binaries for native dependencies
- Comprehensive performance benchmarking
- Automated migration scripts with rollback
- Extensive cross-platform testing matrix

### Business Risks
- **User Confusion**: Two separate applications
- **Development Overhead**: Maintaining two codebases
- **Feature Parity**: Keeping shared features in sync

### Mitigation Strategies
- Clear communication and branding strategy
- Shared component library for common UI elements
- Automated testing to ensure feature compatibility
- Staggered release schedule to minimize disruption

---

## Success Metrics

### Development Metrics
- **Build Time**: < 50% of current dual-mode build time
- **Bundle Size**: < 60% of current desktop bundle size
- **Code Complexity**: Reduced cyclomatic complexity
- **Test Coverage**: > 80% coverage for both applications

### User Experience Metrics
- **Startup Performance**: 30% faster cold start
- **Memory Usage**: 25% reduction in baseline memory
- **Feature Adoption**: Increased usage of desktop-specific features
- **User Satisfaction**: > 4.5/5 rating for desktop application

### Maintenance Metrics
- **Bug Resolution**: 50% faster bug fix deployment
- **Feature Development**: 40% faster feature development cycle
- **Code Review**: Reduced review time due to focused scope
- **Documentation**: Comprehensive documentation for both applications

---

## Future Considerations

### Shared Libraries
- Extract common UI components into shared NPM packages
- Shared utilities for audio processing and metadata
- Common TypeScript types and interfaces
- Shared testing utilities and mocks

### Cross-Platform Features
- Optional cloud sync between web and desktop versions
- Shared playlist format for import/export
- Common user preference schema
- Unified analytics and telemetry

### Long-term Vision
- **Vorbis Web**: Become the premier web-based music streaming interface
- **Vorbis Desktop**: Become the go-to local music library manager
- **Vorbis Mobile**: Future native mobile applications
- **Vorbis Cloud**: Optional cloud services for sync and backup

---

## Conclusion

The extraction of Vorbis Desktop into a dedicated codebase represents a strategic investment in the long-term maintainability and user experience of the Vorbis Player ecosystem. By separating concerns and optimizing each application for its specific platform, we can deliver superior experiences while reducing development complexity.

This approach aligns with modern software development practices of focused, single-responsibility applications while maintaining the ability to share common components and utilities through well-defined interfaces.

The proposed timeline and migration strategy minimize risk while ensuring a smooth transition for both developers and users. Success will be measured through improved performance, reduced complexity, and enhanced user satisfaction across both web and desktop platforms.