import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import * as musicMetadata from 'music-metadata';
import sharp from 'sharp';


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

  // Enhanced Phase 2 IPC handlers
  
  // Image processing with sharp
  ipcMain.handle('process-image', async (_event, imageData: Buffer, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
  }) => {
    try {
      let processor = sharp(imageData);
      
      if (options.width || options.height) {
        processor = processor.resize(options.width, options.height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      if (options.format === 'jpeg') {
        processor = processor.jpeg({ quality: Math.round((options.quality || 0.85) * 100) });
      } else if (options.format === 'png') {
        processor = processor.png({ quality: Math.round((options.quality || 0.85) * 100) });
      } else if (options.format === 'webp') {
        processor = processor.webp({ quality: Math.round((options.quality || 0.85) * 100) });
      }
      
      const processedData = await processor.toBuffer();
      return {
        data: processedData,
        format: options.format || 'jpeg'
      };
    } catch (error) {
      console.error('Image processing failed:', error);
      throw error;
    }
  });

  // Get image dimensions
  ipcMain.handle('get-image-dimensions', async (_event, imageData: Buffer) => {
    try {
      const metadata = await sharp(imageData).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0
      };
    } catch (error) {
      console.error('Failed to get image dimensions:', error);
      return { width: 300, height: 300 };
    }
  });

  // Directory operations for artwork scanning
  ipcMain.handle('get-directory-files', async (_event, directoryPath: string) => {
    try {
      const files = await fs.readdir(directoryPath);
      return files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
      });
    } catch (error) {
      console.error('Error reading directory files:', error);
      throw error;
    }
  });

  // Enhanced search operations
  ipcMain.handle('db-search-tracks', async (_event, options: {
    query: string;
    type: string;
    limit?: number;
    offset?: number;
    fuzzyMatch?: boolean;
  }) => {
    await initializeDatabase();
    
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      
      let searchResults = [];
      
      if (options.type === 'tracks' || options.type === 'all') {
        // Try FTS search first
        try {
          let query = options.query;
          if (options.fuzzyMatch) {
            query = query.split(' ').map(term => `${term}*`).join(' ');
          }
          
          const stmt = database.prepare(`
            SELECT t.*, bm25(tracks_fts) as rank
            FROM tracks t
            JOIN tracks_fts ON t.id = tracks_fts.id
            WHERE tracks_fts MATCH ?
            ORDER BY rank
            LIMIT ? OFFSET ?
          `);
          
          searchResults = stmt.all(query, limit, offset);
        } catch (ftsError) {
          // Fallback to LIKE search
          const searchTerm = `%${options.query}%`;
          const stmt = database.prepare(`
            SELECT * FROM tracks
            WHERE name LIKE ? OR artist LIKE ? OR album LIKE ? OR genre LIKE ?
            ORDER BY name COLLATE NOCASE
            LIMIT ? OFFSET ?
          `);
          
          searchResults = stmt.all(searchTerm, searchTerm, searchTerm, searchTerm, limit, offset);
        }
      }
      
      return searchResults.map((row: any) => ({
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
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  });

  // Advanced filtering
  ipcMain.handle('db-filter-tracks', async (_event, criteria: any, limit = 1000, offset = 0) => {
    await initializeDatabase();
    
    try {
      let sql = 'SELECT * FROM tracks WHERE 1=1';
      const params: any[] = [];

      // Build WHERE clause based on criteria
      if (criteria.artists && criteria.artists.length > 0) {
        const placeholders = criteria.artists.map(() => '?').join(',');
        sql += ` AND (artist IN (${placeholders}) OR album_artist IN (${placeholders}))`;
        params.push(...criteria.artists, ...criteria.artists);
      }

      if (criteria.albums && criteria.albums.length > 0) {
        const placeholders = criteria.albums.map(() => '?').join(',');
        sql += ` AND album IN (${placeholders})`;
        params.push(...criteria.albums);
      }

      if (criteria.genres && criteria.genres.length > 0) {
        const placeholders = criteria.genres.map(() => '?').join(',');
        sql += ` AND genre IN (${placeholders})`;
        params.push(...criteria.genres);
      }

      if (criteria.years) {
        if (criteria.years.min !== undefined) {
          sql += ' AND year >= ?';
          params.push(criteria.years.min);
        }
        if (criteria.years.max !== undefined) {
          sql += ' AND year <= ?';
          params.push(criteria.years.max);
        }
      }

      if (criteria.duration) {
        if (criteria.duration.min !== undefined) {
          sql += ' AND duration >= ?';
          params.push(criteria.duration.min * 1000);
        }
        if (criteria.duration.max !== undefined) {
          sql += ' AND duration <= ?';
          params.push(criteria.duration.max * 1000);
        }
      }

      if (criteria.bitrate) {
        if (criteria.bitrate.min !== undefined) {
          sql += ' AND bitrate >= ?';
          params.push(criteria.bitrate.min);
        }
        if (criteria.bitrate.max !== undefined) {
          sql += ' AND bitrate <= ?';
          params.push(criteria.bitrate.max);
        }
      }

      if (criteria.hasLyrics !== undefined) {
        sql += criteria.hasLyrics ? ' AND lyrics IS NOT NULL' : ' AND lyrics IS NULL';
      }

      if (criteria.hasAlbumArt !== undefined) {
        sql += criteria.hasAlbumArt ? ' AND album_art IS NOT NULL' : ' AND album_art IS NULL';
      }

      sql += ' ORDER BY artist, album, track_number, name LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = database.prepare(sql);
      const rows = stmt.all(...params);

      return rows.map((row: any) => ({
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
    } catch (error) {
      console.error('Filter failed:', error);
      throw error;
    }
  });

  // Album artwork operations
  ipcMain.handle('db-get-album-artwork', async (_event, trackId: string) => {
    await initializeDatabase();
    
    try {
      const stmt = database.prepare(`
        SELECT * FROM album_artwork 
        WHERE track_id = ? 
        ORDER BY date_added DESC 
        LIMIT 1
      `);
      
      return stmt.get(trackId);
    } catch (error) {
      console.error('Failed to get album artwork:', error);
      return null;
    }
  });

  // Database maintenance operations
  ipcMain.handle('db-vacuum', async () => {
    await initializeDatabase();
    
    try {
      database.exec('VACUUM');
      console.log('🧹 Database vacuumed');
      return { success: true };
    } catch (error) {
      console.error('Database vacuum failed:', error);
      throw error;
    }
  });

  ipcMain.handle('db-analyze', async () => {
    await initializeDatabase();
    
    try {
      database.exec('ANALYZE');
      console.log('📊 Database analyzed');
      return { success: true };
    } catch (error) {
      console.error('Database analyze failed:', error);
      throw error;
    }
  });

  // Performance metrics
  ipcMain.handle('db-get-performance-metrics', async (_event, limit = 100) => {
    await initializeDatabase();
    
    try {
      const stmt = database.prepare(`
        SELECT * FROM performance_metrics 
        ORDER BY timestamp DESC 
        LIMIT ?
      `);
      
      return stmt.all(limit);
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return [];
    }
  });

  // Enhanced detailed stats
  ipcMain.handle('db-get-detailed-stats', async () => {
    await initializeDatabase();
    
    try {
      // Basic stats
      const basicStats = database.prepare(`
        SELECT 
          COUNT(*) as total_tracks,
          SUM(duration) as total_duration,
          SUM(file_size) as total_file_size,
          AVG(bitrate) as average_bitrate,
          COUNT(DISTINCT album) as total_albums,
          COUNT(DISTINCT artist) as total_artists
        FROM tracks
      `).get();

      // Format breakdown
      const formatBreakdown = database.prepare(`
        SELECT format, COUNT(*) as count, SUM(file_size) as total_size
        FROM tracks
        GROUP BY format
        ORDER BY count DESC
      `).all();

      // Genre breakdown
      const genreBreakdown = database.prepare(`
        SELECT genre, COUNT(*) as count
        FROM tracks
        WHERE genre IS NOT NULL AND genre != 'Unknown'
        GROUP BY genre
        ORDER BY count DESC
        LIMIT 20
      `).all();

      // Year breakdown
      const yearBreakdown = database.prepare(`
        SELECT year, COUNT(*) as count
        FROM tracks
        WHERE year IS NOT NULL AND year > 0
        GROUP BY year
        ORDER BY year DESC
        LIMIT 20
      `).all();

      return {
        totalTracks: basicStats.total_tracks || 0,
        totalAlbums: basicStats.total_albums || 0,
        totalArtists: basicStats.total_artists || 0,
        totalDuration: basicStats.total_duration || 0,
        totalFileSize: basicStats.total_file_size || 0,
        averageBitrate: Math.round(basicStats.average_bitrate || 0),
        formatBreakdown,
        genreBreakdown,
        yearBreakdown
      };
    } catch (error) {
      console.error('Failed to get detailed stats:', error);
      throw error;
    }
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
          codec TEXT,
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
      
      // Migration: Add codec column if it doesn't exist
      try {
        const tableInfo = database.prepare("PRAGMA table_info(tracks)").all();
        const hasCodecColumn = tableInfo.some((col: any) => col.name === 'codec');
        
        if (!hasCodecColumn) {
          console.log('🔄 Migrating database: Adding codec column to tracks table');
          database.exec('ALTER TABLE tracks ADD COLUMN codec TEXT');
          console.log('✅ Database migration completed: codec column added');
        }
      } catch (error) {
        console.warn('Migration check failed (might be a new database):', error);
      }
      
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

  ipcMain.handle('db-clear-library', async () => {
    await initializeDatabase();
    
    try {
      console.log('🗑️ Clearing local music library...');
      
      // Delete all data from tables
      database.exec('DELETE FROM tracks');
      database.exec('DELETE FROM albums');
      database.exec('DELETE FROM artists');
      
      // Delete from FTS if it exists
      try {
        database.exec('DELETE FROM tracks_fts');
      } catch (e) {
        // FTS table might not exist
      }
      
      // Delete from playlists if they exist
      try {
        database.exec('DELETE FROM playlists');
        database.exec('DELETE FROM playlist_tracks');
      } catch (e) {
        // Playlist tables might not exist
      }
      
      // Delete from album artwork if it exists
      try {
        database.exec('DELETE FROM album_artwork');
      } catch (e) {
        // Album artwork table might not exist
      }
      
      // Reset autoincrement counters
      database.exec("DELETE FROM sqlite_sequence WHERE name IN ('tracks', 'albums', 'artists', 'playlists', 'playlist_tracks', 'album_artwork')");
      
      // Vacuum to reclaim space
      database.exec('VACUUM');
      
      // Reset scanner progress
      scanProgress = {
        isScanning: false,
        totalFiles: 0,
        scannedFiles: 0,
        currentFile: '',
        errors: []
      };
      
      console.log('✅ Local music library cleared successfully');
    } catch (error) {
      console.error('Failed to clear library:', error);
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
        codec: metadata.format.codec,
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

  // Enhanced scanner operations with Phase 2 features
  ipcMain.handle('scanner-scan-directories', async (event, options = {}) => {
    if (scanProgress.isScanning) {
      return { success: false, message: 'Scan already in progress' };
    }

    console.log('🎵 Starting enhanced music library scan...');
    scanProgress.isScanning = true;
    scanProgress.scannedFiles = 0;
    scanProgress.totalFiles = 0;
    scanProgress.errors = [];
    scanProgress.currentFile = '';

    const {
      extractArtwork = true,
      parallel = false,
      batchSize = 10
    } = options;

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

      // Process files with enhanced metadata and artwork extraction
      console.log('🎶 Processing metadata and artwork...');
      
      if (parallel) {
        await processFilesParallel(allFiles, batchSize, extractArtwork);
      } else {
        await processFilesSequential(allFiles, extractArtwork);
      }
      
      scanProgress.isScanning = false;
      const successMessage = `✅ Enhanced scan completed! Processed ${scanProgress.scannedFiles} files`;
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
      console.error('❌ Enhanced scan failed:', error);
      scanProgress.errors.push(`Enhanced scan failed: ${error.message}`);
      throw error;
    }
  });

  // Enhanced file processing functions
  const processFilesSequential = async (files: string[], extractArtwork: boolean) => {
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      scanProgress.currentFile = path.basename(filePath);
      
      const track = await processAudioFileEnhanced(filePath, extractArtwork);
      
      if (track) {
        await saveTrackToDatabase(track);
      }
      
      scanProgress.scannedFiles = i + 1;
      
      // Log progress every 100 files
      if ((i + 1) % 100 === 0) {
        console.log(`📊 Processed ${i + 1}/${files.length} files`);
      }
    }
  };

  const processFilesParallel = async (files: string[], batchSize: number, extractArtwork: boolean) => {
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const promises = batch.map(filePath => processAudioFileEnhanced(filePath, extractArtwork));
      
      try {
        const tracks = await Promise.all(promises);
        
        // Save tracks to database in batch
        for (const track of tracks) {
          if (track) {
            await saveTrackToDatabase(track);
          }
        }
        
        scanProgress.scannedFiles += batch.length;
      } catch (error) {
        console.warn('Error in parallel batch processing:', error);
        scanProgress.errors.push(`Batch processing error: ${error.message}`);
      }
    }
  };

  // Enhanced audio file processing with artwork extraction
  const processAudioFileEnhanced = async (filePath: string, extractArtwork: boolean): Promise<any> => {
    try {
      const metadata = await musicMetadata.parseFile(filePath);
      const stats = await fs.stat(filePath);
      
      let albumArt: string | undefined;
      let artworkInfo: any = null;

      // Extract album artwork if enabled
      if (extractArtwork && metadata.common.picture && metadata.common.picture.length > 0) {
        try {
          const picture = metadata.common.picture[0];
          
          // Process artwork with sharp for optimization
          const processedImage = await sharp(picture.data)
            .resize(800, 800, { 
              fit: 'inside',
              withoutEnlargement: true 
            })
            .jpeg({ quality: 85 })
            .toBuffer();

          albumArt = `data:image/jpeg;base64,${processedImage.toString('base64')}`;
          
          artworkInfo = {
            format: 'image/jpeg',
            size: processedImage.length,
            originalSize: picture.data.length,
            source: 'embedded'
          };
        } catch (artError: any) {
          console.warn(`Failed to process artwork for ${filePath}:`, artError);
          scanProgress.errors.push(`Artwork processing failed for ${filePath}: ${artError.message}`);
        }
      }

      // Check for directory artwork if no embedded artwork
      if (extractArtwork && !albumArt) {
        try {
          const directoryPath = path.dirname(filePath);
          const directoryArtwork = await findDirectoryArtwork(directoryPath);
          if (directoryArtwork) {
            albumArt = directoryArtwork.data;
            artworkInfo = directoryArtwork.info;
          }
        } catch (dirError) {
          console.warn(`Failed to find directory artwork for ${filePath}:`, dirError);
        }
      }
      
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
        codec: metadata.format.codec,
        bitrate: metadata.format.bitrate || 0,
        sampleRate: metadata.format.sampleRate || 0,
        filePath: filePath,
        fileSize: stats.size,
        albumArt,
        artworkInfo,
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

  // Enhanced database save function
  const saveTrackToDatabase = async (track: any) => {
    try {
      // Insert or update track in database
      const stmt = database.prepare(`
        INSERT OR REPLACE INTO tracks (
          id, name, artist, album, album_artist, genre, year, track_number,
          duration, codec, bitrate, sample_rate, file_path, file_name, file_size, format,
          album_art, date_added, date_modified, play_count, last_played
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const fileExtension = path.extname(track.filePath).toLowerCase().substring(1);
      const fileName = path.basename(track.filePath);
      
      stmt.run(
        track.id, track.title, track.artist, track.album, track.albumArtist,
        track.genre, track.year, track.track, track.duration,
        track.codec, track.bitrate, track.sampleRate, track.filePath, fileName, track.fileSize, fileExtension,
        track.albumArt, track.dateAdded, track.lastModified, 0, null
      );

      // Update album stats
      const albumId = `${track.albumArtist}_${track.album}`.replace(/[^a-zA-Z0-9]/g, '_');
      updateAlbumStats(albumId, track.album, track.albumArtist, track.year, track.albumArt);

      // Update artist stats  
      updateArtistStats(track.artist);
      if (track.albumArtist !== track.artist) {
        updateArtistStats(track.albumArtist);
      }

      // Save artwork separately if present
      if (track.artworkInfo) {
        await saveAlbumArtwork(track.id, albumId, track.albumArt, track.artworkInfo);
      }
      
    } catch (dbError) {
      console.error(`Database error for ${track.filePath}:`, dbError);
      scanProgress.errors.push(`Database error for ${track.filePath}: ${dbError.message}`);
    }
  };

  // Directory artwork detection
  const findDirectoryArtwork = async (directoryPath: string): Promise<{ data: string; info: any } | null> => {
    try {
      const files = await fs.readdir(directoryPath);
      const artworkPatterns = [
        /^cover\.(jpg|jpeg|png|webp)$/i,
        /^folder\.(jpg|jpeg|png|webp)$/i,
        /^front\.(jpg|jpeg|png|webp)$/i,
        /^albumart\.(jpg|jpeg|png|webp)$/i
      ];

      for (const pattern of artworkPatterns) {
        const artworkFile = files.find(file => pattern.test(file));
        if (artworkFile) {
          const artworkPath = path.join(directoryPath, artworkFile);
          const imageBuffer = await fs.readFile(artworkPath);
          
          // Process with sharp
          const processedImage = await sharp(imageBuffer)
            .resize(800, 800, { 
              fit: 'inside',
              withoutEnlargement: true 
            })
            .jpeg({ quality: 85 })
            .toBuffer();

          return {
            data: `data:image/jpeg;base64,${processedImage.toString('base64')}`,
            info: {
              format: 'image/jpeg',
              size: processedImage.length,
              originalSize: imageBuffer.length,
              source: 'directory',
              filePath: artworkPath
            }
          };
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Error finding directory artwork in ${directoryPath}:`, error);
      return null;
    }
  };

  // Enhanced album/artist update functions
  const updateAlbumStats = (albumId: string, albumName: string, artistName: string, year?: number, albumArt?: string) => {
    try {
      const stats = database.prepare(`
        SELECT COUNT(*) as track_count, SUM(duration) as total_duration
        FROM tracks WHERE album = ? AND album_artist = ?
      `).get(albumName, artistName);

      const albumStmt = database.prepare(`
        INSERT OR REPLACE INTO albums (
          id, name, artist, year, album_art, track_count, total_duration, date_added
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      albumStmt.run(
        albumId, albumName, artistName, year, albumArt,
        stats.track_count, stats.total_duration, new Date().toISOString()
      );
    } catch (error) {
      console.error(`Error updating album stats for ${albumName}:`, error);
    }
  };

  const updateArtistStats = (artistName: string) => {
    try {
      const stats = database.prepare(`
        SELECT 
          COUNT(DISTINCT album) as album_count,
          COUNT(*) as track_count,
          SUM(duration) as total_duration
        FROM tracks WHERE artist = ? OR album_artist = ?
      `).get(artistName, artistName);

      const artistId = artistName.replace(/[^a-zA-Z0-9]/g, '_');
      const artistStmt = database.prepare(`
        INSERT OR REPLACE INTO artists (
          id, name, album_count, track_count, total_duration, date_added
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      artistStmt.run(
        artistId, artistName, stats.album_count, stats.track_count,
        stats.total_duration, new Date().toISOString()
      );
    } catch (error) {
      console.error(`Error updating artist stats for ${artistName}:`, error);
    }
  };

  // Save album artwork to separate table
  const saveAlbumArtwork = async (trackId: string, albumId: string, artworkData: string, artworkInfo: any) => {
    try {
      // Create artwork table if it doesn't exist
      database.exec(`
        CREATE TABLE IF NOT EXISTS album_artwork (
          id TEXT PRIMARY KEY,
          track_id TEXT,
          album_id TEXT,
          data TEXT NOT NULL,
          format TEXT NOT NULL,
          width INTEGER,
          height INTEGER,
          file_size INTEGER NOT NULL,
          source TEXT NOT NULL,
          file_path TEXT,
          date_added TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const artworkId = `artwork_${trackId}_${Date.now()}`;
      const stmt = database.prepare(`
        INSERT OR REPLACE INTO album_artwork (
          id, track_id, album_id, data, format, width, height, file_size, source, file_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        artworkId, trackId, albumId, artworkData, artworkInfo.format,
        800, 800, artworkInfo.size, artworkInfo.source, artworkInfo.filePath
      );
    } catch (error) {
      console.error('Error saving album artwork:', error);
    }
  };
}
