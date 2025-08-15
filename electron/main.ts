import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import * as musicMetadata from 'music-metadata';


const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    icon: path.join(process.env.VITE_PUBLIC, 'vorbis_player_logo.jpg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
    win?.show();
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();
});

// IPC Handlers for local music library
function setupIpcHandlers() {
  // File system operations
  ipcMain.handle('get-audio-files', async (_, directory: string, options: {
    recursive: boolean;
    extensions: string[];
    exclude: string[];
  }) => {
    try {
      const audioFiles: string[] = [];
      
      async function scanDirectory(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // Check if path should be excluded
          if (options.exclude.some(pattern => fullPath.includes(pattern))) {
            continue;
          }
          
          if (entry.isDirectory() && options.recursive) {
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase().substring(1);
            if (options.extensions.includes(ext)) {
              audioFiles.push(fullPath);
            }
          }
        }
      }
      
      await scanDirectory(directory);
      return audioFiles;
    } catch (error) {
      console.error('Error scanning directory:', error);
      throw error;
    }
  });

  ipcMain.handle('get-file-stats', async (_, filePath: string) => {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
      };
    } catch (error) {
      console.error('Error getting file stats:', error);
      throw error;
    }
  });

  ipcMain.handle('read-audio-file', async (_, filePath: string) => {
    try {
      console.log(`🔊 Main process: Reading audio file: ${filePath}`);
      const buffer = await fs.readFile(filePath);
      console.log(`🔊 Main process: Read ${buffer.length} bytes from ${path.basename(filePath)}`);
      return buffer.buffer;
    } catch (error) {
      console.error('Error reading audio file:', error);
      console.error('File path:', filePath);
      throw error;
    }
  });

  ipcMain.handle('read-file-buffer', async (_, filePath: string) => {
    try {
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error('Error reading file buffer:', error);
      throw error;
    }
  });

  // Directory operations
  ipcMain.handle('select-music-directory', async () => {
    try {
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Music Directory',
        message: 'Choose a directory containing your music files',
      });
      
      return result.canceled ? null : result.filePaths[0];
    } catch (error) {
      console.error('Error selecting directory:', error);
      throw error;
    }
  });

  // Database operations
  ipcMain.handle('get-database-path', async () => {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'music-library.db');
    return dbPath;
  });

  // Path operations
  ipcMain.handle('join-path', (_, ...paths: string[]) => {
    return path.join(...paths);
  });

  ipcMain.handle('dirname', (_, filePath: string) => {
    return path.dirname(filePath);
  });

  ipcMain.handle('basename', (_, filePath: string) => {
    return path.basename(filePath);
  });

  // App operations
  ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
  });

  ipcMain.handle('get-app-path', async () => {
    return app.getAppPath();
  });

  ipcMain.handle('get-user-data-path', async () => {
    return app.getPath('userData');
  });

  // Database operations - these run in main process
  let database: any = null;
  
  // File scanning functionality - moved from renderer
  let scannerSettings = {
    musicDirectories: [],
    watchForChanges: true,
    scanOnStartup: true,
    autoIndexNewFiles: true,
    supportedFormats: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac'],
    excludePatterns: ['.*', 'node_modules', '.git', 'System Volume Information'],
    includeSubdirectories: true
  };

  // Settings persistence
  const getSettingsPath = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'scanner-settings.json');
  };

  const loadSettings = async () => {
    try {
      const settingsPath = getSettingsPath();
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const loadedSettings = JSON.parse(settingsData);
      scannerSettings = { ...scannerSettings, ...loadedSettings };
      console.log('📂 Scanner settings loaded:', scannerSettings);
    } catch (error) {
      console.log('📂 No saved settings found, using defaults');
    }
  };

  const saveSettings = async () => {
    try {
      const settingsPath = getSettingsPath();
      await fs.writeFile(settingsPath, JSON.stringify(scannerSettings, null, 2));
      console.log('💾 Scanner settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };
  
  const watchers = new Map();
  let scanProgress = {
    isScanning: false,
    totalFiles: 0,
    scannedFiles: 0,
    currentFile: '',
    errors: []
  };
  
  const initializeDatabase = async () => {
    try {
      if (database) return true;
      
      const Database = require('better-sqlite3');
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'music-library.db');
      
      database = new Database(dbPath);
      
      // Enable WAL mode for better performance
      database.pragma('journal_mode = WAL');
      database.pragma('synchronous = NORMAL');
      database.pragma('cache_size = 1000');
      database.pragma('temp_store = memory');

      // Create tables
      database.exec(`
        CREATE TABLE IF NOT EXISTS tracks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          artist TEXT NOT NULL,
          album TEXT NOT NULL,
          duration INTEGER NOT NULL,
          file_path TEXT UNIQUE NOT NULL,
          file_name TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          format TEXT NOT NULL,
          bitrate INTEGER,
          sample_rate INTEGER,
          track_number INTEGER,
          year INTEGER,
          genre TEXT,
          album_artist TEXT,
          composer TEXT,
          comment TEXT,
          lyrics TEXT,
          album_art TEXT,
          date_added TEXT NOT NULL,
          date_modified TEXT NOT NULL,
          play_count INTEGER DEFAULT 0,
          last_played TEXT
        );

        CREATE TABLE IF NOT EXISTS albums (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          artist TEXT NOT NULL,
          year INTEGER,
          genre TEXT,
          album_art TEXT,
          track_count INTEGER DEFAULT 0,
          total_duration INTEGER DEFAULT 0,
          date_added TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS artists (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          album_count INTEGER DEFAULT 0,
          track_count INTEGER DEFAULT 0,
          total_duration INTEGER DEFAULT 0,
          date_added TEXT NOT NULL
        );
      `);

      // Create indexes
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
        CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
        CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
        CREATE INDEX IF NOT EXISTS idx_tracks_year ON tracks(year);
        CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist);
        CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
      `);
      
      console.log('🗄️ Local library database initialized in main process');
  
  // Load scanner settings on startup
  await loadSettings();
      return true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  };

  ipcMain.handle('db-initialize', initializeDatabase);

  ipcMain.handle('db-get-all-tracks', async () => {
    await initializeDatabase();
    
    try {
      const stmt = database.prepare(`
        SELECT * FROM tracks 
        ORDER BY artist, album, track_number, name
      `);
      const rows = stmt.all();
      
      console.log(`🎵 Database query returned ${rows.length} tracks`);
      if (rows.length > 0) {
        console.log('📊 First track sample:', {
          id: rows[0].id,
          name: rows[0].name,
          artist: rows[0].artist,
          album: rows[0].album
        });
      }
      
      const tracks = rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        artist: row.artist,
        album: row.album,
        duration: row.duration,
        filePath: row.file_path,
        fileName: row.file_name,
        fileSize: row.file_size,
        format: row.format,
        bitrate: row.bitrate,
        sampleRate: row.sample_rate,
        trackNumber: row.track_number,
        year: row.year,
        genre: row.genre,
        albumArtist: row.album_artist,
        composer: row.composer,
        comment: row.comment,
        lyrics: row.lyrics,
        albumArt: row.album_art,
        dateAdded: new Date(row.date_added),
        dateModified: new Date(row.date_modified),
        playCount: row.play_count,
        lastPlayed: row.last_played ? new Date(row.last_played) : undefined,
        source: 'local' as const
      }));
      
      console.log(`🎵 Returning ${tracks.length} formatted tracks to renderer`);
      return tracks;
    } catch (error) {
      console.error('Failed to get tracks:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-all-albums', async () => {
    await initializeDatabase();
    
    try {
      const stmt = database.prepare(`
        SELECT * FROM albums 
        ORDER BY artist, name
      `);
      return stmt.all();
    } catch (error) {
      console.error('Failed to get albums:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-all-artists', async () => {
    await initializeDatabase();
    
    try {
      const stmt = database.prepare(`
        SELECT * FROM artists 
        ORDER BY name
      `);
      return stmt.all();
    } catch (error) {
      console.error('Failed to get artists:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-stats', async () => {
    await initializeDatabase();
    
    try {
      const trackCount = database.prepare('SELECT COUNT(*) as count FROM tracks').get();
      const albumCount = database.prepare('SELECT COUNT(*) as count FROM albums').get();
      const artistCount = database.prepare('SELECT COUNT(*) as count FROM artists').get();
      const totalDuration = database.prepare('SELECT SUM(duration) as total FROM tracks').get();
      
      return {
        totalTracks: trackCount.count,
        totalAlbums: albumCount.count,
        totalArtists: artistCount.count,
        totalDuration: totalDuration.total || 0
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw error;
    }
  });

  // Scanner IPC handlers - moved from renderer process
  ipcMain.handle('scanner-get-settings', async () => {
    return scannerSettings;
  });

  ipcMain.handle('scanner-update-settings', async (event, newSettings) => {
    scannerSettings = { ...scannerSettings, ...newSettings };
    await saveSettings();
    return scannerSettings;
  });

  ipcMain.handle('scanner-add-directory', async (event, directory) => {
    if (!scannerSettings.musicDirectories.includes(directory)) {
      scannerSettings.musicDirectories.push(directory);
      await saveSettings();
    }
  });

  ipcMain.handle('scanner-remove-directory', async (event, directory) => {
    scannerSettings.musicDirectories = scannerSettings.musicDirectories.filter(dir => dir !== directory);
    // Stop watching if enabled
    if (watchers.has(directory)) {
      watchers.get(directory).close();
      watchers.delete(directory);
    }
    await saveSettings();
  });

  ipcMain.handle('scanner-get-progress', async () => {
    return scanProgress;
  });

  // Helper function to check if file is an audio file
  const isAudioFile = (filePath: string): boolean => {
    const ext = path.extname(filePath).toLowerCase().substring(1);
    return scannerSettings.supportedFormats.includes(ext);
  };

  // Helper function to check if path should be excluded
  const shouldExclude = (filePath: string): boolean => {
    const basename = path.basename(filePath);
    return scannerSettings.excludePatterns.some(pattern => {
      if (pattern.startsWith('.')) {
        return basename.startsWith(pattern);
      }
      return basename.includes(pattern);
    });
  };

  // Helper function to recursively find audio files
  const findAudioFiles = async (dir: string): Promise<string[]> => {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (shouldExclude(fullPath)) {
          continue;
        }
        
        if (entry.isDirectory() && scannerSettings.includeSubdirectories) {
          const subFiles = await findAudioFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && isAudioFile(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
      scanProgress.errors.push(`Error reading directory ${dir}: ${error.message}`);
    }
    
    return files;
  };

  // Helper function to extract metadata and create track object
  const processAudioFile = async (filePath: string): Promise<any> => {
    try {
      const metadata = await musicMetadata.parseFile(filePath);
      const stats = await fs.stat(filePath);
      
      const track = {
        id: path.basename(filePath, path.extname(filePath)) + '_' + stats.mtime.getTime(),
        title: metadata.common.title || path.basename(filePath, path.extname(filePath)),
        artist: metadata.common.artist || 'Unknown Artist',
        album: metadata.common.album || 'Unknown Album',
        albumArtist: metadata.common.albumartist || metadata.common.artist || 'Unknown Artist',
        genre: metadata.common.genre?.[0] || 'Unknown',
        year: metadata.common.year || 0,
        track: metadata.common.track?.no || 0,
        disc: metadata.common.disk?.no || 1,
        duration: metadata.format.duration || 0,
        bitrate: metadata.format.bitrate || 0,
        sampleRate: metadata.format.sampleRate || 0,
        filePath: filePath,
        fileSize: stats.size,
        dateAdded: new Date().toISOString(),
        lastModified: stats.mtime.toISOString()
      };
      
      return track;
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      scanProgress.errors.push(`Error processing file ${filePath}: ${error.message}`);
      return null;
    }
  };

  ipcMain.handle('scanner-scan-directories', async () => {
    if (scanProgress.isScanning) {
      return { success: false, message: 'Scan already in progress' };
    }

    console.log('🎵 Starting music library scan...');
    scanProgress.isScanning = true;
    scanProgress.scannedFiles = 0;
    scanProgress.totalFiles = 0;
    scanProgress.errors = [];
    scanProgress.currentFile = '';

    try {
      await initializeDatabase();
      
      // Find all audio files first
      console.log('🔍 Finding audio files...');
      const allFiles: string[] = [];
      
      for (const directory of scannerSettings.musicDirectories) {
        console.log(`Scanning directory: ${directory}`);
        const files = await findAudioFiles(directory);
        allFiles.push(...files);
      }
      
      scanProgress.totalFiles = allFiles.length;
      console.log(`📁 Found ${allFiles.length} audio files`);
      
      if (allFiles.length === 0) {
        scanProgress.isScanning = false;
        return { success: true, message: 'No audio files found in configured directories' };
      }

      // Process files and add to database
      console.log('🎶 Processing metadata and updating database...');
      
      for (let i = 0; i < allFiles.length; i++) {
        const filePath = allFiles[i];
        scanProgress.currentFile = path.basename(filePath);
        
        const track = await processAudioFile(filePath);
        
        if (track) {
          try {
            // Insert or update track in database
            const stmt = database.prepare(`
              INSERT OR REPLACE INTO tracks (
                id, name, artist, album, album_artist, genre, year, track_number,
                duration, bitrate, sample_rate, file_path, file_name, file_size, format,
                date_added, date_modified
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const fileExtension = path.extname(track.filePath).toLowerCase().substring(1);
            const fileName = path.basename(track.filePath);
            
            stmt.run(
              track.id, track.title, track.artist, track.album, track.albumArtist,
              track.genre, track.year, track.track, track.duration,
              track.bitrate, track.sampleRate, track.filePath, fileName, track.fileSize, fileExtension,
              track.dateAdded, track.lastModified
            );

            // Insert or update album
            const albumId = `${track.albumArtist}_${track.album}`.replace(/[^a-zA-Z0-9]/g, '_');
            const albumStmt = database.prepare(`
              INSERT OR REPLACE INTO albums (id, name, artist, year, date_added) VALUES (?, ?, ?, ?, ?)
            `);
            albumStmt.run(albumId, track.album, track.albumArtist, track.year, track.dateAdded);

            // Insert or update artists
            const artistStmt = database.prepare(`
              INSERT OR REPLACE INTO artists (id, name, date_added) VALUES (?, ?, ?)
            `);
            
            // Insert main artist
            const artistId = track.artist.replace(/[^a-zA-Z0-9]/g, '_');
            artistStmt.run(artistId, track.artist, track.dateAdded);
            
            // Insert album artist if different
            if (track.albumArtist !== track.artist) {
              const albumArtistId = track.albumArtist.replace(/[^a-zA-Z0-9]/g, '_');
              artistStmt.run(albumArtistId, track.albumArtist, track.dateAdded);
            }
            
          } catch (dbError) {
            console.error(`Database error for ${filePath}:`, dbError);
            scanProgress.errors.push(`Database error for ${filePath}: ${dbError.message}`);
          }
        }
        
        scanProgress.scannedFiles = i + 1;
        
        // Log progress every 100 files
        if ((i + 1) % 100 === 0) {
          console.log(`📊 Processed ${i + 1}/${allFiles.length} files`);
        }
      }
      
      scanProgress.isScanning = false;
      const successMessage = `✅ Scan completed! Processed ${scanProgress.scannedFiles} files`;
      console.log(successMessage);
      
      if (scanProgress.errors.length > 0) {
        console.log(`⚠️  ${scanProgress.errors.length} errors occurred during scan`);
      }
      
      return { 
        success: true, 
        message: successMessage,
        totalFiles: scanProgress.totalFiles,
        processedFiles: scanProgress.scannedFiles,
        errors: scanProgress.errors.length
      };
      
    } catch (error) {
      scanProgress.isScanning = false;
      console.error('❌ Scan failed:', error);
      scanProgress.errors.push(`Scan failed: ${error.message}`);
      throw error;
    }
  });
}
