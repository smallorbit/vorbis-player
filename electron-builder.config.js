module.exports = {
  appId: 'com.vorbisplayer.desktop',
  productName: 'Vorbis Player',
  copyright: 'Copyright © 2024 Vorbis Player',
  
  directories: {
    output: 'dist-electron',
    buildResources: 'build'
  },
  
  files: [
    'dist/**/*',
    'electron/**/*',
    'node_modules/**/*',
    '!node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    '!node_modules/*.d.ts',
    '!node_modules/.bin',
    '!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}',
    '!.editorconfig',
    '!**/._*',
    '!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}',
    '!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}',
    '!**/{appveyor.yml,.travis.yml,circle.yml}',
    '!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}'
  ],
  
  extraResources: [
    {
      from: 'public',
      to: 'public',
      filter: ['**/*']
    }
  ],
  
  mac: {
    category: 'public.app-category.music',
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ],
    icon: 'public/icon.icns',
    darkModeSupport: true,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: {
      NSMicrophoneUsageDescription: 'This app does not use the microphone.',
      NSCameraUsageDescription: 'This app does not use the camera.',
      NSAppleEventsUsageDescription: 'This app needs to control system media playback.',
      LSMinimumSystemVersion: '10.15.0'
    }
  },
  
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      },
      {
        target: 'portable',
        arch: ['x64']
      }
    ],
    icon: 'public/icon.ico',
    publisherName: 'Vorbis Player',
    verifyUpdateCodeSignature: false
  },
  
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Vorbis Player',
    uninstallDisplayName: 'Vorbis Player',
    artifactName: 'VorbisPlayer-Setup-${version}.${ext}'
  },
  
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64']
      },
      {
        target: 'deb',
        arch: ['x64']
      },
      {
        target: 'rpm',
        arch: ['x64']
      }
    ],
    icon: 'public/icon.png',
    category: 'AudioVideo',
    desktop: {
      Name: 'Vorbis Player',
      Comment: 'A beautiful Spotify music player with advanced visual effects',
      Keywords: 'music;spotify;player;audio;playlist',
      StartupWMClass: 'vorbis-player'
    }
  },
  
  appImage: {
    artifactName: 'VorbisPlayer-${version}-${arch}.${ext}'
  },
  
  deb: {
    artifactName: 'vorbis-player_${version}_${arch}.${ext}',
    depends: ['libgtk-3-0', 'libnotify4', 'libnss3', 'libxss1', 'libxtst6', 'xdg-utils', 'libatspi2.0-0', 'libdrm2', 'libxkbcommon0', 'libxcomposite1', 'libxdamage1', 'libxfixes3', 'libxrandr2', 'libgbm1', 'libasound2']
  },
  
  rpm: {
    artifactName: 'vorbis-player-${version}-${arch}.${ext}',
    depends: ['gtk3', 'libnotify', 'nss', 'libXScrnSaver', 'libXtst', 'xdg-utils', 'at-spi2-atk', 'libdrm', 'libxkbcommon', 'libXcomposite', 'libXdamage', 'libXfixes', 'libXrandr', 'mesa-libgbm', 'alsa-lib']
  },
  
  publish: {
    provider: 'github',
    releaseType: 'release'
  },
  
  compression: 'maximum',
  
  removePackageScripts: true,
  removePackageKeywords: true
};