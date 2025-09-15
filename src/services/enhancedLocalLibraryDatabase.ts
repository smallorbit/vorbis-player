import Database from 'better-sqlite3';
import type { 
  LocalTrack, 
  DbTrack, 
  DbAlbum, 
  DbArtist, 
  DbSearchHistory,
  DbSavedFilter,
  DbAlbumArtwork,
  DbPerformanceMetric,
  AdvancedFilterCriteria,
  SearchOptions,
  SearchResult,
  AlbumArtwork
} from '../types/spotify.d.ts';

export class EnhancedLocalLibraryDatabaseService {
  private db: Database.Database | null = null;
  private initialized = false;
  private currentVersion = '2.0.0';

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (!window.electronAPI) {
        console.warn('Database not available in web environment');
        return;
      }

      // Get database path from electron
      const dbPath = await window.electronAPI.getDatabasePath();
      this.db = new Database(dbPath);
      
      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 2000');
      this.db.pragma('temp_store = memory');
      this.db.pragma('mmap_size = 268435456'); // 256MB
      this.db.pragma('foreign_keys = ON');

      // Run migrations
      await this.runMigrations();
      
      this.initialized = true;
      console.log('🗄️ Enhanced local library database initialized');
    } catch (error) {
      console.error('Failed to initialize enhanced database:', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    // Create migrations table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrations = [
      {
        version: '1.0.0',
        description: 'Initial schema with tracks, albums, artists',
        sql: this.getInitialSchemaSql()
      },
      {
        version: '1.1.0',
        description: 'Add FTS5 search index',
        sql: this.getFtsIndexSql()
      },
      {
        version: '2.0.0', 
        description: 'Add playlists, search history, saved filters, album artwork, performance metrics',
        sql: this.getPhase2SchemaSql()
      }
    ];

    for (const migration of migrations) {
      const existing = this.db.prepare('SELECT version FROM migrations WHERE version = ?').get(migration.version);
      
      if (!existing) {
        console.log(`🔄 Running migration ${migration.version}: ${migration.description}`);
        
        try {
          this.db.exec(migration.sql);
          
          this.db.prepare(`
            INSERT INTO migrations (version, description, executed_at) 
            VALUES (?, ?, ?)
          `).run(migration.version, migration.description, new Date().toISOString());
          
          console.log(`✅ Migration ${migration.version} completed`);
        } catch (error) {
          console.error(`❌ Migration ${migration.version} failed:`, error);
          throw error;
        }
      }
    }
  }

  private getInitialSchemaSql(): string {
    return `
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
        name TEXT UNIQUE NOT NULL,
        album_count INTEGER DEFAULT 0,
        track_count INTEGER DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        date_added TEXT NOT NULL
      );
    `;
  }

  private getFtsIndexSql(): string {
    return `
      CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
        id UNINDEXED,
        name,
        artist,
        album,
        genre,
        composer,
        lyrics,
        content='tracks',
        content_rowid='rowid'
      );

      -- Populate FTS index with existing data
      INSERT OR REPLACE INTO tracks_fts (id, name, artist, album, genre, composer, lyrics)
      SELECT id, name, artist, album, genre, composer, lyrics FROM tracks;

      -- Create triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS tracks_fts_insert AFTER INSERT ON tracks
      BEGIN
        INSERT INTO tracks_fts (id, name, artist, album, genre, composer, lyrics)
        VALUES (NEW.id, NEW.name, NEW.artist, NEW.album, NEW.genre, NEW.composer, NEW.lyrics);
      END;

      CREATE TRIGGER IF NOT EXISTS tracks_fts_update AFTER UPDATE ON tracks
      BEGIN
        UPDATE tracks_fts SET
          name = NEW.name,
          artist = NEW.artist,
          album = NEW.album,
          genre = NEW.genre,
          composer = NEW.composer,
          lyrics = NEW.lyrics
        WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS tracks_fts_delete AFTER DELETE ON tracks
      BEGIN
        DELETE FROM tracks_fts WHERE id = OLD.id;
      END;
    `;
  }

  private getPhase2SchemaSql(): string {
    return `
      -- Playlists table for mixed local/Spotify content
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        track_ids TEXT NOT NULL DEFAULT '[]', -- JSON array of track IDs
        is_mixed BOOLEAN DEFAULT FALSE,
        spotify_tracks TEXT DEFAULT '[]', -- JSON array of Spotify track data
        cover_art TEXT,
        date_created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        date_modified TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT DEFAULT 'user' CHECK (created_by IN ('user', 'system'))
      );

      -- Search history
      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        search_type TEXT NOT NULL CHECK (search_type IN ('tracks', 'albums', 'artists', 'all')),
        result_count INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Saved filters
      CREATE TABLE IF NOT EXISTS saved_filters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        filter_criteria TEXT NOT NULL, -- JSON object
        date_created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        date_modified TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Album artwork table
      CREATE TABLE IF NOT EXISTS album_artwork (
        id TEXT PRIMARY KEY,
        track_id TEXT,
        album_id TEXT,
        data TEXT NOT NULL, -- base64 encoded
        format TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        file_size INTEGER NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('embedded', 'directory', 'online')),
        file_path TEXT,
        date_added TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL,
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
      );

      -- Performance metrics
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        duration INTEGER NOT NULL, -- in milliseconds
        timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT -- JSON object
      );

      -- Enhanced indexes for Phase 2
      CREATE INDEX IF NOT EXISTS idx_tracks_duration ON tracks(duration);
      CREATE INDEX IF NOT EXISTS idx_tracks_bitrate ON tracks(bitrate);
      CREATE INDEX IF NOT EXISTS idx_tracks_format ON tracks(format);
      CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks(play_count);
      CREATE INDEX IF NOT EXISTS idx_tracks_has_lyrics ON tracks((lyrics IS NOT NULL));
      CREATE INDEX IF NOT EXISTS idx_tracks_has_album_art ON tracks((album_art IS NOT NULL));
      
      CREATE INDEX IF NOT EXISTS idx_albums_year ON albums(year);
      CREATE INDEX IF NOT EXISTS idx_albums_track_count ON albums(track_count);
      
      CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query);
      
      CREATE INDEX IF NOT EXISTS idx_album_artwork_track_id ON album_artwork(track_id);
      CREATE INDEX IF NOT EXISTS idx_album_artwork_album_id ON album_artwork(album_id);
      CREATE INDEX IF NOT EXISTS idx_album_artwork_source ON album_artwork(source);
      
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_operation ON performance_metrics(operation);
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
    `;
  }

  // Performance monitoring decorator
  private async withPerformanceTracking<T>(
    operation: string, 
    fn: () => Promise<T> | T, 
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      // Log performance metrics for operations > 100ms
      if (duration > 100) {
        await this.recordPerformanceMetric(operation, duration, metadata);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.recordPerformanceMetric(`${operation}_error`, duration, { 
        error: error.message, 
        ...metadata 
      });
      throw error;
    }
  }

  private async recordPerformanceMetric(operation: string, duration: number, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.db || !this.initialized) return;
    
    try {
      const stmt = this.db.prepare(`
        INSERT INTO performance_metrics (id, operation, duration, metadata)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(
        `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        operation,
        duration,
        metadata ? JSON.stringify(metadata) : null
      );
    } catch (error) {
      console.warn('Failed to record performance metric:', error);
    }
  }

  // Enhanced Track Operations with transaction support
  async saveTrack(track: LocalTrack): Promise<void> {
    return this.withPerformanceTracking('saveTrack', async () => {
      if (!this.db || !this.initialized) {
        throw new Error('Database not initialized');
      }

      const transaction = this.db.transaction(() => {
        const stmt = this.db!.prepare(`
          INSERT OR REPLACE INTO tracks (
            id, name, artist, album, duration, file_path, file_name, file_size,
            format, bitrate, sample_rate, track_number, year, genre, album_artist,
            composer, comment, lyrics, album_art, date_added, date_modified,
            play_count, last_played
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          track.id, track.name, track.artist, track.album, track.duration,
          track.filePath, track.fileName, track.fileSize, track.format,
          track.bitrate, track.sampleRate, track.trackNumber, track.year,
          track.genre, track.albumArtist, track.composer, track.comment,
          track.lyrics, track.albumArt, track.dateAdded.toISOString(),
          track.dateModified.toISOString(), track.playCount,
          track.lastPlayed?.toISOString()
        );

        // Update aggregated data
        this.updateAlbumStats(track.album, track.artist);
        this.updateArtistStats(track.artist);
      });

      transaction();
    }, { trackId: track.id });
  }

  async saveTracksBatch(tracks: LocalTrack[]): Promise<void> {
    return this.withPerformanceTracking('saveTracksBatch', async () => {
      if (!this.db || !this.initialized) {
        throw new Error('Database not initialized');
      }

      const transaction = this.db.transaction(() => {
        const stmt = this.db!.prepare(`
          INSERT OR REPLACE INTO tracks (
            id, name, artist, album, duration, file_path, file_name, file_size,
            format, bitrate, sample_rate, track_number, year, genre, album_artist,
            composer, comment, lyrics, album_art, date_added, date_modified,
            play_count, last_played
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const track of tracks) {
          stmt.run(
            track.id, track.name, track.artist, track.album, track.duration,
            track.filePath, track.fileName, track.fileSize, track.format,
            track.bitrate, track.sampleRate, track.trackNumber, track.year,
            track.genre, track.albumArtist, track.composer, track.comment,
            track.lyrics, track.albumArt, track.dateAdded.toISOString(),
            track.dateModified.toISOString(), track.playCount,
            track.lastPlayed?.toISOString()
          );
        }

        // Rebuild aggregated data after batch operation
        this.rebuildAggregatedData();
      });

      transaction();
    }, { trackCount: tracks.length });
  }

  // Enhanced search with FTS5, fuzzy matching, and relevance ranking
  async searchTracks(options: SearchOptions): Promise<SearchResult> {
    return this.withPerformanceTracking('searchTracks', async () => {
      if (!this.db || !this.initialized) {
        throw new Error('Database not initialized');
      }

      const startTime = Date.now();
      let tracks: LocalTrack[] = [];
      let albums: DbAlbum[] = [];
      let artists: DbArtist[] = [];

      // Save search to history
      await this.saveSearchHistory(options.query, options.type);

      if (options.type === 'tracks' || options.type === 'all') {
        tracks = await this.searchTracksWithFTS(options);
      }

      if (options.type === 'albums' || options.type === 'all') {
        albums = await this.searchAlbums(options);
      }

      if (options.type === 'artists' || options.type === 'all') {
        artists = await this.searchArtists(options);
      }

      const searchTime = Date.now() - startTime;
      const totalResults = tracks.length + albums.length + artists.length;

      return {
        tracks,
        albums,
        artists,
        totalResults,
        searchTime
      };
    }, { query: options.query, type: options.type });
  }

  private async searchTracksWithFTS(options: SearchOptions): Promise<LocalTrack[]> {
    if (!this.db) return [];

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    try {
      // Try FTS5 search first
      let query = options.query;
      
      // If fuzzy matching is enabled, add wildcards
      if (options.fuzzyMatch) {
        query = query.split(' ').map(term => `${term}*`).join(' ');
      }

      const stmt = this.db.prepare(`
        SELECT t.*, bm25(tracks_fts) as rank
        FROM tracks t
        JOIN tracks_fts ON t.id = tracks_fts.id
        WHERE tracks_fts MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `);

      const rows = stmt.all(query, limit, offset) as (DbTrack & { rank: number })[];
      return rows.map(row => this.dbTrackToLocalTrack(row));
      
    } catch (error) {
      console.warn('FTS search failed, using fallback:', error);
      return this.searchTracksSimple(options);
    }
  }

  private async searchTracksSimple(options: SearchOptions): Promise<LocalTrack[]> {
    if (!this.db) return [];

    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const searchTerm = `%${options.query}%`;

    const stmt = this.db.prepare(`
      SELECT * FROM tracks
      WHERE name LIKE ? OR artist LIKE ? OR album LIKE ? OR genre LIKE ? OR composer LIKE ?
      ORDER BY 
        CASE 
          WHEN name LIKE ? THEN 1
          WHEN artist LIKE ? THEN 2
          WHEN album LIKE ? THEN 3
          ELSE 4
        END,
        name COLLATE NOCASE
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(
      searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
      searchTerm, searchTerm, searchTerm,
      limit, offset
    ) as DbTrack[];

    return rows.map(row => this.dbTrackToLocalTrack(row));
  }

  private async searchAlbums(options: SearchOptions): Promise<DbAlbum[]> {
    if (!this.db) return [];

    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const searchTerm = `%${options.query}%`;

    const stmt = this.db.prepare(`
      SELECT * FROM albums
      WHERE name LIKE ? OR artist LIKE ?
      ORDER BY name COLLATE NOCASE
      LIMIT ? OFFSET ?
    `);

    return stmt.all(searchTerm, searchTerm, limit, offset) as DbAlbum[];
  }

  private async searchArtists(options: SearchOptions): Promise<DbArtist[]> {
    if (!this.db) return [];

    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const searchTerm = `%${options.query}%`;

    const stmt = this.db.prepare(`
      SELECT * FROM artists
      WHERE name LIKE ?
      ORDER BY name COLLATE NOCASE
      LIMIT ? OFFSET ?
    `);

    return stmt.all(searchTerm, limit, offset) as DbArtist[];
  }

  // Advanced filtering
  async getTracksWithFilters(criteria: AdvancedFilterCriteria, limit = 1000, offset = 0): Promise<LocalTrack[]> {
    return this.withPerformanceTracking('getTracksWithFilters', async () => {
      if (!this.db || !this.initialized) return [];

      let sql = 'SELECT * FROM tracks WHERE 1=1';
      const params: unknown[] = [];

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
          params.push(criteria.duration.min * 1000); // convert to milliseconds
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

      if (criteria.formats && criteria.formats.length > 0) {
        const placeholders = criteria.formats.map(() => '?').join(',');
        sql += ` AND format IN (${placeholders})`;
        params.push(...criteria.formats);
      }

      if (criteria.playCount) {
        if (criteria.playCount.min !== undefined) {
          sql += ' AND play_count >= ?';
          params.push(criteria.playCount.min);
        }
        if (criteria.playCount.max !== undefined) {
          sql += ' AND play_count <= ?';
          params.push(criteria.playCount.max);
        }
      }

      if (criteria.dateAdded) {
        if (criteria.dateAdded.from) {
          sql += ' AND date_added >= ?';
          params.push(criteria.dateAdded.from);
        }
        if (criteria.dateAdded.to) {
          sql += ' AND date_added <= ?';
          params.push(criteria.dateAdded.to);
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

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as DbTrack[];

      return rows.map(row => this.dbTrackToLocalTrack(row));
    }, { criteriaKeys: Object.keys(criteria) });
  }

  // Saved filters management
  async saveFilter(name: string, criteria: AdvancedFilterCriteria): Promise<void> {
    if (!this.db || !this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO saved_filters (id, name, filter_criteria, date_modified)
      VALUES (?, ?, ?, ?)
    `);

    const id = `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    stmt.run(id, name, JSON.stringify(criteria), new Date().toISOString());
  }

  async getSavedFilters(): Promise<DbSavedFilter[]> {
    if (!this.db || !this.initialized) return [];

    const stmt = this.db.prepare('SELECT * FROM saved_filters ORDER BY name');
    return stmt.all() as DbSavedFilter[];
  }

  async deleteSavedFilter(id: string): Promise<void> {
    if (!this.db || !this.initialized) return;

    const stmt = this.db.prepare('DELETE FROM saved_filters WHERE id = ?');
    stmt.run(id);
  }

  // Search history management
  private async saveSearchHistory(query: string, searchType: string): Promise<void> {
    if (!this.db) return;

    try {
      // Clean old history (keep last 1000 entries)
      const cleanupStmt = this.db.prepare(`
        DELETE FROM search_history 
        WHERE id NOT IN (
          SELECT id FROM search_history 
          ORDER BY timestamp DESC 
          LIMIT 1000
        )
      `);
      cleanupStmt.run();

      // Add new entry
      const stmt = this.db.prepare(`
        INSERT INTO search_history (id, query, search_type, result_count)
        VALUES (?, ?, ?, ?)
      `);
      
      const id = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      stmt.run(id, query, searchType, 0); // result_count will be updated later
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }

  async getSearchHistory(limit = 20): Promise<DbSearchHistory[]> {
    if (!this.db || !this.initialized) return [];

    const stmt = this.db.prepare(`
      SELECT * FROM search_history 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    
    return stmt.all(limit) as DbSearchHistory[];
  }

  async clearSearchHistory(): Promise<void> {
    if (!this.db || !this.initialized) return;

    const stmt = this.db.prepare('DELETE FROM search_history');
    stmt.run();
  }

  // Album artwork management
  async saveAlbumArtwork(artwork: AlbumArtwork): Promise<void> {
    if (!this.db || !this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO album_artwork (
        id, track_id, album_id, data, format, width, height, 
        file_size, source, file_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      artwork.id, artwork.track_id, artwork.album_id, artwork.data,
      artwork.format, artwork.width, artwork.height, artwork.file_size,
      artwork.source, artwork.file_path
    );
  }

  async getAlbumArtworkByTrack(trackId: string): Promise<DbAlbumArtwork | null> {
    if (!this.db || !this.initialized) return null;

    const stmt = this.db.prepare('SELECT * FROM album_artwork WHERE track_id = ? ORDER BY date_added DESC LIMIT 1');
    return stmt.get(trackId) as DbAlbumArtwork || null;
  }

  async getAlbumArtworkByAlbum(albumId: string): Promise<DbAlbumArtwork | null> {
    if (!this.db || !this.initialized) return null;

    const stmt = this.db.prepare('SELECT * FROM album_artwork WHERE album_id = ? ORDER BY date_added DESC LIMIT 1');
    return stmt.get(albumId) as DbAlbumArtwork || null;
  }

  // Backup and recovery
  async createBackup(backupPath: string): Promise<void> {
    return this.withPerformanceTracking('createBackup', async () => {
      if (!this.db || !this.initialized) {
        throw new Error('Database not initialized');
      }

      await this.db.backup(backupPath);
      console.log(`📦 Database backup created: ${backupPath}`);
    }, { backupPath });
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    return this.withPerformanceTracking('restoreFromBackup', async () => {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      // Close current database
      this.db.close();
      
      // Restore from backup would require platform-specific file operations
      // This would be handled by the main process
      throw new Error('Backup restoration must be handled by main process');
    }, { backupPath });
  }

  // Database maintenance and optimization
  async vacuum(): Promise<void> {
    return this.withPerformanceTracking('vacuum', async () => {
      if (!this.db) return;
      this.db.exec('VACUUM');
      console.log('🧹 Database vacuumed');
    });
  }

  async analyze(): Promise<void> {
    return this.withPerformanceTracking('analyze', async () => {
      if (!this.db) return;
      this.db.exec('ANALYZE');
      console.log('📊 Database statistics updated');
    });
  }

  async getPerformanceMetrics(limit = 100): Promise<DbPerformanceMetric[]> {
    if (!this.db || !this.initialized) return [];

    const stmt = this.db.prepare(`
      SELECT * FROM performance_metrics 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    
    return stmt.all(limit) as DbPerformanceMetric[];
  }

  async clearOldPerformanceMetrics(olderThanDays = 30): Promise<void> {
    if (!this.db || !this.initialized) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const stmt = this.db.prepare('DELETE FROM performance_metrics WHERE timestamp < ?');
    stmt.run(cutoffDate.toISOString());
  }

  // Utility methods (keeping existing ones)
  private dbTrackToLocalTrack(dbTrack: DbTrack): LocalTrack {
    return {
      id: dbTrack.id,
      name: dbTrack.name,
      artist: dbTrack.artist,
      album: dbTrack.album,
      duration: dbTrack.duration,
      filePath: dbTrack.file_path,
      fileName: dbTrack.file_name,
      fileSize: dbTrack.file_size,
      format: dbTrack.format,
      bitrate: dbTrack.bitrate,
      sampleRate: dbTrack.sample_rate,
      trackNumber: dbTrack.track_number,
      year: dbTrack.year,
      genre: dbTrack.genre,
      albumArtist: dbTrack.album_artist,
      composer: dbTrack.composer,
      comment: dbTrack.comment,
      lyrics: dbTrack.lyrics,
      albumArt: dbTrack.album_art,
      dateAdded: new Date(dbTrack.date_added),
      dateModified: new Date(dbTrack.date_modified),
      playCount: dbTrack.play_count,
      lastPlayed: dbTrack.last_played ? new Date(dbTrack.last_played) : undefined,
      source: 'local'
    };
  }

  private updateAlbumStats(albumName: string, artistName: string): void {
    if (!this.db) return;

    const stats = this.db.prepare(`
      SELECT COUNT(*) as track_count, SUM(duration) as total_duration
      FROM tracks
      WHERE album = ? AND (artist = ? OR album_artist = ?)
    `).get(albumName, artistName, artistName) as { track_count: number; total_duration: number };

    const albumId = this.generateAlbumId(albumName, artistName);

    if (stats.track_count > 0) {
      const trackInfo = this.db.prepare(`
        SELECT album_art, year, genre FROM tracks
        WHERE album = ? AND (artist = ? OR album_artist = ?)
        AND album_art IS NOT NULL
        LIMIT 1
      `).get(albumName, artistName, artistName) as { album_art?: string; year?: number; genre?: string };

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO albums (
          id, name, artist, year, genre, album_art, track_count, total_duration, date_added
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        albumId, albumName, artistName, trackInfo?.year, trackInfo?.genre,
        trackInfo?.album_art, stats.track_count, stats.total_duration,
        new Date().toISOString()
      );
    } else {
      const stmt = this.db.prepare('DELETE FROM albums WHERE id = ?');
      stmt.run(albumId);
    }
  }

  private updateArtistStats(artistName: string): void {
    if (!this.db) return;

    const stats = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT album) as album_count,
        COUNT(*) as track_count,
        SUM(duration) as total_duration
      FROM tracks
      WHERE artist = ? OR album_artist = ?
    `).get(artistName, artistName) as { album_count: number; track_count: number; total_duration: number };

    const artistId = this.generateArtistId(artistName);

    if (stats.track_count > 0) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO artists (
          id, name, album_count, track_count, total_duration, date_added
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        artistId, artistName, stats.album_count, stats.track_count,
        stats.total_duration, new Date().toISOString()
      );
    } else {
      const stmt = this.db.prepare('DELETE FROM artists WHERE id = ?');
      stmt.run(artistId);
    }
  }

  private generateAlbumId(albumName: string, artistName: string): string {
    return 'album_' + btoa(`${artistName}:${albumName}`).replace(/[+/=]/g, '');
  }

  private generateArtistId(artistName: string): string {
    return 'artist_' + btoa(artistName).replace(/[+/=]/g, '');
  }

  private rebuildAggregatedData(): void {
    if (!this.db) return;

    // Clear existing aggregated data
    this.db.exec('DELETE FROM albums');
    this.db.exec('DELETE FROM artists');

    // Get all unique albums
    const albums = this.db.prepare(`
      SELECT DISTINCT album, artist FROM tracks
      WHERE album IS NOT NULL AND artist IS NOT NULL
    `).all() as { album: string; artist: string }[];

    for (const { album, artist } of albums) {
      this.updateAlbumStats(album, artist);
    }

    // Get all unique artists
    const artists = this.db.prepare(`
      SELECT DISTINCT artist FROM tracks
      WHERE artist IS NOT NULL
      UNION
      SELECT DISTINCT album_artist FROM tracks
      WHERE album_artist IS NOT NULL
    `).all() as { artist: string }[];

    for (const { artist } of artists) {
      this.updateArtistStats(artist);
    }
  }

  // Enhanced stats with more detailed information
  async getDetailedStats(): Promise<{
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalDuration: number;
    totalFileSize: number;
    formatBreakdown: { format: string; count: number; totalSize: number }[];
    genreBreakdown: { genre: string; count: number }[];
    yearBreakdown: { year: number; count: number }[];
    averageBitrate: number;
    databaseSize: number;
    performanceMetrics: {
      averageSearchTime: number;
      slowestOperations: { operation: string; avgDuration: number }[];
    };
  }> {
    return this.withPerformanceTracking('getDetailedStats', async () => {
      if (!this.db || !this.initialized) {
        return {
          totalTracks: 0,
          totalAlbums: 0,
          totalArtists: 0,
          totalDuration: 0,
          totalFileSize: 0,
          formatBreakdown: [],
          genreBreakdown: [],
          yearBreakdown: [],
          averageBitrate: 0,
          databaseSize: 0, // TODO: Get actual database file size
          // TODO: Implement database size calculation
          // 
          // @priority: Low
          // @context: Database statistics and monitoring
          // @dependencies: File system access, database file path
          // @requirements:
          // - Get database file size from file system
          // - Handle database file not found scenarios
          // - Update size calculation on database changes
          // - Cache size information for performance
          // 
          // @issue: Database size monitoring and statistics
          // @estimated-effort: 0.5 days
          // @impact: Better database monitoring and maintenance
          performanceMetrics: { averageSearchTime: 0, slowestOperations: [] }
        };
      }

      // Basic stats
      const basicStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_tracks,
          SUM(duration) as total_duration,
          SUM(file_size) as total_file_size,
          AVG(bitrate) as average_bitrate,
          COUNT(DISTINCT album) as total_albums,
          COUNT(DISTINCT artist) as total_artists
        FROM tracks
      `).get() as {
        total_tracks: number;
        total_duration: number;
        total_file_size: number;
        average_bitrate: number;
        total_albums: number;
        total_artists: number;
      };

      // Format breakdown
      const formatBreakdown = this.db.prepare(`
        SELECT format, COUNT(*) as count, SUM(file_size) as total_size
        FROM tracks
        GROUP BY format
        ORDER BY count DESC
      `).all() as { format: string; count: number; total_size: number }[];

      // Genre breakdown
      const genreBreakdown = this.db.prepare(`
        SELECT genre, COUNT(*) as count
        FROM tracks
        WHERE genre IS NOT NULL
        GROUP BY genre
        ORDER BY count DESC
        LIMIT 20
      `).all() as { genre: string; count: number }[];

      // Year breakdown
      const yearBreakdown = this.db.prepare(`
        SELECT year, COUNT(*) as count
        FROM tracks
        WHERE year IS NOT NULL
        GROUP BY year
        ORDER BY year DESC
        LIMIT 20
      `).all() as { year: number; count: number }[];

      // Performance metrics
      const avgSearchTime = this.db.prepare(`
        SELECT AVG(duration) as avg_duration
        FROM performance_metrics
        WHERE operation LIKE '%search%'
        AND timestamp > datetime('now', '-7 days')
      `).get() as { avg_duration: number } || { avg_duration: 0 };

      const slowestOps = this.db.prepare(`
        SELECT operation, AVG(duration) as avg_duration
        FROM performance_metrics
        WHERE timestamp > datetime('now', '-7 days')
        GROUP BY operation
        ORDER BY avg_duration DESC
        LIMIT 10
      `).all() as { operation: string; avg_duration: number }[];

      return {
        totalTracks: basicStats.total_tracks || 0,
        totalAlbums: basicStats.total_albums || 0,
        totalArtists: basicStats.total_artists || 0,
        totalDuration: basicStats.total_duration || 0,
        totalFileSize: basicStats.total_file_size || 0,
        formatBreakdown: formatBreakdown.map(f => ({ 
          format: f.format, 
          count: f.count, 
          totalSize: f.total_size 
        })),
        genreBreakdown,
        yearBreakdown,
        averageBitrate: Math.round(basicStats.average_bitrate || 0),
        databaseSize: 0, // TODO: Get actual database file size
        // TODO: Implement database size calculation
        // 
        // @priority: Low
        // @context: Database statistics and monitoring
        // @dependencies: File system access, database file path
        // @requirements:
        // - Get database file size from file system
        // - Handle database file not found scenarios
        // - Update size calculation on database changes
        // - Cache size information for performance
        // 
        // @issue: Database size monitoring and statistics
        // @estimated-effort: 0.5 days
        // @impact: Better database monitoring and maintenance
        performanceMetrics: {
          averageSearchTime: Math.round(avgSearchTime.avg_duration || 0),
          slowestOperations: slowestOps.map(op => ({
            operation: op.operation,
            avgDuration: Math.round(op.avg_duration)
          }))
        }
      };
    });
  }

  // Cleanup
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

// Singleton instance
export const enhancedLocalLibraryDatabase = new EnhancedLocalLibraryDatabaseService();