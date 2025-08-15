import Database from 'better-sqlite3';
import type { LocalTrack, DbTrack, DbAlbum, DbArtist } from '../types/spotify.d.ts';

export class LocalLibraryDatabaseService {
  private db: Database.Database | null = null;
  private initialized = false;

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
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');

      this.createTables();
      this.createIndexes();
      
      this.initialized = true;
      console.log('🗄️ Local library database initialized');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private createTables(): void {
    if (!this.db) return;

    // Tracks table
    this.db.exec(`
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
      )
    `);

    // Albums table
    this.db.exec(`
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
      )
    `);

    // Artists table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS artists (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        album_count INTEGER DEFAULT 0,
        track_count INTEGER DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        date_added TEXT NOT NULL
      )
    `);

    // Playlists table for local playlists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        track_ids TEXT,
        date_created TEXT NOT NULL,
        date_modified TEXT NOT NULL
      )
    `);

    // Search index table for FTS
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
        id UNINDEXED,
        name,
        artist,
        album,
        genre,
        composer,
        content='tracks',
        content_rowid='rowid'
      )
    `);
  }

  private createIndexes(): void {
    if (!this.db) return;

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_year ON tracks(year)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_file_path ON tracks(file_path)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_date_added ON tracks(date_added)',
      'CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks(play_count)',
      'CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist)',
      'CREATE INDEX IF NOT EXISTS idx_albums_year ON albums(year)'
    ];

    indexes.forEach(indexSql => {
      try {
        this.db!.exec(indexSql);
      } catch (error) {
        console.warn('Failed to create index:', error);
      }
    });
  }

  // Track operations
  async saveTrack(track: LocalTrack): Promise<void> {
    if (!this.db || !this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tracks (
        id, name, artist, album, duration, file_path, file_name, file_size,
        format, bitrate, sample_rate, track_number, year, genre, album_artist,
        composer, comment, lyrics, album_art, date_added, date_modified,
        play_count, last_played
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        track.id,
        track.name,
        track.artist,
        track.album,
        track.duration,
        track.filePath,
        track.fileName,
        track.fileSize,
        track.format,
        track.bitrate,
        track.sampleRate,
        track.trackNumber,
        track.year,
        track.genre,
        track.albumArtist,
        track.composer,
        track.comment,
        track.lyrics,
        track.albumArt,
        track.dateAdded.toISOString(),
        track.dateModified.toISOString(),
        track.playCount,
        track.lastPlayed?.toISOString()
      );

      // Update FTS index
      const ftsStmt = this.db.prepare(`
        INSERT OR REPLACE INTO tracks_fts (id, name, artist, album, genre, composer)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      ftsStmt.run(track.id, track.name, track.artist, track.album, track.genre, track.composer);

      // Update aggregated data
      await this.updateAlbumStats(track.album, track.artist);
      await this.updateArtistStats(track.artist);

    } catch (error) {
      console.error('Failed to save track:', error);
      throw error;
    }
  }

  async getTrackById(id: string): Promise<LocalTrack | null> {
    if (!this.db || !this.initialized) return null;

    const stmt = this.db.prepare('SELECT * FROM tracks WHERE id = ?');
    const row = stmt.get(id) as DbTrack;

    return row ? this.dbTrackToLocalTrack(row) : null;
  }

  async getTrackByPath(filePath: string): Promise<LocalTrack | null> {
    if (!this.db || !this.initialized) return null;

    const stmt = this.db.prepare('SELECT * FROM tracks WHERE file_path = ?');
    const row = stmt.get(filePath) as DbTrack;

    return row ? this.dbTrackToLocalTrack(row) : null;
  }

  async getAllTracks(limit?: number, offset?: number): Promise<LocalTrack[]> {
    if (!this.db || !this.initialized) return [];

    let sql = 'SELECT * FROM tracks ORDER BY artist, album, track_number, name';
    if (limit) {
      sql += ` LIMIT ${limit}`;
      if (offset) {
        sql += ` OFFSET ${offset}`;
      }
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as DbTrack[];

    return rows.map(row => this.dbTrackToLocalTrack(row));
  }

  async getTracksByArtist(artist: string): Promise<LocalTrack[]> {
    if (!this.db || !this.initialized) return [];

    const stmt = this.db.prepare(`
      SELECT * FROM tracks 
      WHERE artist = ? OR album_artist = ?
      ORDER BY album, track_number, name
    `);
    const rows = stmt.all(artist, artist) as DbTrack[];

    return rows.map(row => this.dbTrackToLocalTrack(row));
  }

  async getTracksByAlbum(album: string, artist?: string): Promise<LocalTrack[]> {
    if (!this.db || !this.initialized) return [];

    let sql = 'SELECT * FROM tracks WHERE album = ?';
    const params = [album];

    if (artist) {
      sql += ' AND (artist = ? OR album_artist = ?)';
      params.push(artist, artist);
    }

    sql += ' ORDER BY track_number, name';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as DbTrack[];

    return rows.map(row => this.dbTrackToLocalTrack(row));
  }

  async searchTracks(query: string, limit = 50): Promise<LocalTrack[]> {
    if (!this.db || !this.initialized) return [];

    // Use FTS for better search performance
    const stmt = this.db.prepare(`
      SELECT t.* FROM tracks t
      JOIN tracks_fts fts ON t.id = fts.id
      WHERE tracks_fts MATCH ?
      ORDER BY bm25(tracks_fts)
      LIMIT ?
    `);

    try {
      const rows = stmt.all(query, limit) as DbTrack[];
      return rows.map(row => this.dbTrackToLocalTrack(row));
    } catch (error) {
      // Fallback to simple LIKE search if FTS fails
      console.warn('FTS search failed, using fallback:', error);
      return this.simpleSearch(query, limit);
    }
  }

  private async simpleSearch(query: string, limit: number): Promise<LocalTrack[]> {
    if (!this.db) return [];

    const stmt = this.db.prepare(`
      SELECT * FROM tracks
      WHERE name LIKE ? OR artist LIKE ? OR album LIKE ? OR genre LIKE ?
      ORDER BY name
      LIMIT ?
    `);

    const searchTerm = `%${query}%`;
    const rows = stmt.all(searchTerm, searchTerm, searchTerm, searchTerm, limit) as DbTrack[];

    return rows.map(row => this.dbTrackToLocalTrack(row));
  }

  async removeTrackByPath(filePath: string): Promise<void> {
    if (!this.db || !this.initialized) return;

    const track = await this.getTrackByPath(filePath);
    if (!track) return;

    const stmt = this.db.prepare('DELETE FROM tracks WHERE file_path = ?');
    stmt.run(filePath);

    // Remove from FTS
    const ftsStmt = this.db.prepare('DELETE FROM tracks_fts WHERE id = ?');
    ftsStmt.run(track.id);

    // Update aggregated data
    await this.updateAlbumStats(track.album, track.artist);
    await this.updateArtistStats(track.artist);
  }

  async removeTracksByDirectory(directory: string): Promise<void> {
    if (!this.db || !this.initialized) return;

    const stmt = this.db.prepare('DELETE FROM tracks WHERE file_path LIKE ?');
    stmt.run(`${directory}%`);

    // This is a bulk operation, rebuild aggregated data
    await this.rebuildAggregatedData();
  }

  async updatePlayCount(trackId: string): Promise<void> {
    if (!this.db || !this.initialized) return;

    const stmt = this.db.prepare(`
      UPDATE tracks 
      SET play_count = play_count + 1, last_played = ?
      WHERE id = ?
    `);
    
    stmt.run(new Date().toISOString(), trackId);
  }

  // Album operations
  private async updateAlbumStats(albumName: string, artistName: string): Promise<void> {
    if (!this.db) return;

    const stats = this.db.prepare(`
      SELECT COUNT(*) as track_count, SUM(duration) as total_duration
      FROM tracks
      WHERE album = ? AND (artist = ? OR album_artist = ?)
    `).get(albumName, artistName, artistName) as { track_count: number; total_duration: number };

    const albumId = this.generateAlbumId(albumName, artistName);

    if (stats.track_count > 0) {
      // Get album art and other info from first track
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
        albumId,
        albumName,
        artistName,
        trackInfo?.year,
        trackInfo?.genre,
        trackInfo?.album_art,
        stats.track_count,
        stats.total_duration,
        new Date().toISOString()
      );
    } else {
      // Remove album if no tracks
      const stmt = this.db.prepare('DELETE FROM albums WHERE id = ?');
      stmt.run(albumId);
    }
  }

  async getAllAlbums(): Promise<DbAlbum[]> {
    if (!this.db || !this.initialized) return [];

    const stmt = this.db.prepare('SELECT * FROM albums ORDER BY artist, name');
    return stmt.all() as DbAlbum[];
  }

  // Artist operations
  private async updateArtistStats(artistName: string): Promise<void> {
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
        artistId,
        artistName,
        stats.album_count,
        stats.track_count,
        stats.total_duration,
        new Date().toISOString()
      );
    } else {
      // Remove artist if no tracks
      const stmt = this.db.prepare('DELETE FROM artists WHERE id = ?');
      stmt.run(artistId);
    }
  }

  async getAllArtists(): Promise<DbArtist[]> {
    if (!this.db || !this.initialized) return [];

    const stmt = this.db.prepare('SELECT * FROM artists ORDER BY name');
    return stmt.all() as DbArtist[];
  }

  // Utility methods
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

  private generateAlbumId(albumName: string, artistName: string): string {
    return 'album_' + btoa(`${artistName}:${albumName}`).replace(/[+/=]/g, '');
  }

  private generateArtistId(artistName: string): string {
    return 'artist_' + btoa(artistName).replace(/[+/=]/g, '');
  }

  private async rebuildAggregatedData(): Promise<void> {
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
      await this.updateAlbumStats(album, artist);
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
      await this.updateArtistStats(artist);
    }
  }

  // Database maintenance
  async vacuum(): Promise<void> {
    if (!this.db) return;
    this.db.exec('VACUUM');
  }

  async getStats(): Promise<{
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalDuration: number;
    databaseSize: number;
  }> {
    if (!this.db || !this.initialized) {
      return { totalTracks: 0, totalAlbums: 0, totalArtists: 0, totalDuration: 0, databaseSize: 0 };
    }

    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_tracks,
        SUM(duration) as total_duration,
        COUNT(DISTINCT album) as total_albums,
        COUNT(DISTINCT artist) as total_artists
      FROM tracks
    `).get() as { total_tracks: number; total_duration: number; total_albums: number; total_artists: number };

    return {
      totalTracks: stats.total_tracks,
      totalAlbums: stats.total_albums,
      totalArtists: stats.total_artists,
      totalDuration: stats.total_duration || 0,
      databaseSize: 0 // TODO: Get actual database file size
    };
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
export const localLibraryDatabase = new LocalLibraryDatabaseService();