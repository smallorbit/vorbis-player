import type { 
  LocalTrack, 
  DbAlbum, 
  DbArtist, 
  AdvancedFilterCriteria, 
  SearchOptions, 
  SearchResult 
} from '../types/spotify.d.ts';

/**
 * Enhanced IPC-based database service for renderer process
 * Provides Phase 2 features including advanced search, filtering, and album art management
 */
export class EnhancedLocalLibraryDatabaseIPCService {
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

      // Initialize database in main process
      await window.electronAPI.dbInitialize();
      
      this.initialized = true;
      console.log('🗄️ Enhanced local library database IPC service initialized');
    } catch (error) {
      console.error('Failed to initialize enhanced database IPC service:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Basic track operations
  async getAllTracks(): Promise<LocalTrack[]> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      return await window.electronAPI.dbGetAllTracks();
    } catch (error) {
      console.error('Failed to get all tracks:', error);
      throw error;
    }
  }

  async getAllAlbums(): Promise<DbAlbum[]> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      return await window.electronAPI.dbGetAllAlbums();
    } catch (error) {
      console.error('Failed to get all albums:', error);
      throw error;
    }
  }

  async getAllArtists(): Promise<DbArtist[]> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      return await window.electronAPI.dbGetAllArtists();
    } catch (error) {
      console.error('Failed to get all artists:', error);
      throw error;
    }
  }

  // Enhanced Phase 2 operations

  /**
   * Advanced search with FTS5, fuzzy matching, and relevance ranking
   */
  async searchTracks(options: SearchOptions): Promise<SearchResult> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      const startTime = Date.now();
      
      let tracks: LocalTrack[] = [];
      const albums: DbAlbum[] = [];
      const artists: DbArtist[] = [];

      if (options.type === 'tracks' || options.type === 'all') {
        tracks = await window.electronAPI.dbSearchTracks({
          query: options.query,
          type: 'tracks',
          limit: options.limit,
          offset: options.offset,
          fuzzyMatch: options.fuzzyMatch
        });
      }

      /**
       * TODO: Implement album and artist search in main process
       * 
       * @priority: Medium
       * @context: Search functionality enhancement
       * @dependencies: Main process database methods, IPC communication
       * @requirements:
       * - Add album search method to main process database service
       * - Add artist search method to main process database service
       * - Implement IPC handlers for search requests
       * - Add search result caching for performance
       * - Handle fuzzy matching and partial searches
       * 
       * @issue: Search functionality for albums and artists
       * @estimated-effort: 2-3 days
       * @impact: Improved search capabilities and user experience
       */
      // TODO: Implement album and artist search in main process

      if (options.type === 'artists' || options.type === 'all') {
        // artists = await this.searchArtists(options);
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
    } catch (error) {
      console.error('Enhanced search failed:', error);
      throw error;
    }
  }

  /**
   * Advanced filtering with multiple criteria
   */
  async getTracksWithFilters(
    criteria: AdvancedFilterCriteria, 
    limit = 1000, 
    offset = 0
  ): Promise<LocalTrack[]> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      return await window.electronAPI.dbFilterTracks(criteria, limit, offset);
    } catch (error) {
      console.error('Advanced filtering failed:', error);
      throw error;
    }
  }

  /**
   * Get album artwork for a track
   */
  async getAlbumArtwork(trackId: string): Promise<string | null> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      const artwork = await window.electronAPI.dbGetAlbumArtwork(trackId);
      return artwork ? artwork.data : null;
    } catch (error) {
      console.error('Failed to get album artwork:', error);
      return null;
    }
  }

  /**
   * Get comprehensive database statistics
   */
  async getDetailedStats(): Promise<{
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalDuration: number;
    totalFileSize: number;
    averageBitrate: number;
    formatBreakdown: { format: string; count: number; totalSize: number }[];
    genreBreakdown: { genre: string; count: number }[];
    yearBreakdown: { year: number; count: number }[];
  }> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      const stats = await window.electronAPI.dbGetDetailedStats();
      
      // Transform format breakdown to match expected interface
      const formatBreakdown = stats.formatBreakdown.map(f => ({
        format: f.format,
        count: f.count,
        totalSize: f.total_size
      }));

      return {
        ...stats,
        formatBreakdown
      };
    } catch (error) {
      console.error('Failed to get detailed stats:', error);
      throw error;
    }
  }

  /**
   * Get basic database statistics (legacy compatibility)
   */
  async getStats(): Promise<{
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalDuration: number;
  }> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      return await window.electronAPI.dbGetStats();
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw error;
    }
  }

  /**
   * Database maintenance operations
   */
  async vacuum(): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      await window.electronAPI.dbVacuum();
      console.log('🧹 Database vacuum completed');
    } catch (error) {
      console.error('Database vacuum failed:', error);
      throw error;
    }
  }

  async analyze(): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      await window.electronAPI.dbAnalyze();
      console.log('📊 Database analysis completed');
    } catch (error) {
      console.error('Database analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(limit = 100): Promise<Record<string, unknown>[]> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      return await window.electronAPI.dbGetPerformanceMetrics(limit);
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return [];
    }
  }

  // Utility methods for common queries

  /**
   * Get tracks by artist with enhanced filtering
   */
  async getTracksByArtist(artistName: string): Promise<LocalTrack[]> {
    return this.getTracksWithFilters({
      artists: [artistName]
    });
  }

  /**
   * Get tracks by album with enhanced filtering
   */
  async getTracksByAlbum(albumName: string, artistName?: string): Promise<LocalTrack[]> {
    const criteria: AdvancedFilterCriteria = {
      albums: [albumName]
    };

    if (artistName) {
      criteria.artists = [artistName];
    }

    return this.getTracksWithFilters(criteria);
  }

  /**
   * Get tracks by genre
   */
  async getTracksByGenre(genre: string): Promise<LocalTrack[]> {
    return this.getTracksWithFilters({
      genres: [genre]
    });
  }

  /**
   * Get tracks by year range
   */
  async getTracksByYear(minYear?: number, maxYear?: number): Promise<LocalTrack[]> {
    return this.getTracksWithFilters({
      years: { min: minYear, max: maxYear }
    });
  }

  /**
   * Get high quality tracks (above specified bitrate)
   */
  async getHighQualityTracks(minBitrate = 320): Promise<LocalTrack[]> {
    return this.getTracksWithFilters({
      bitrate: { min: minBitrate }
    });
  }

  /**
   * Get tracks with lyrics
   */
  async getTracksWithLyrics(): Promise<LocalTrack[]> {
    return this.getTracksWithFilters({
      hasLyrics: true
    });
  }

  /**
   * Get tracks with album art
   */
  async getTracksWithAlbumArt(): Promise<LocalTrack[]> {
    return this.getTracksWithFilters({
      hasAlbumArt: true
    });
  }

  /**
   * Get recently added tracks
   */
  async getRecentlyAddedTracks(days = 7): Promise<LocalTrack[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.getTracksWithFilters({
      dateAdded: { from: cutoffDate.toISOString() }
    });
  }

  /**
   * Quick search across all fields
   */
  async quickSearch(query: string, limit = 20): Promise<SearchResult> {
    return this.searchTracks({
      query,
      type: 'all',
      limit,
      fuzzyMatch: true,
      sortBy: 'relevance'
    });
  }

  // Health check and diagnostics

  /**
   * Check database health and connectivity
   */
  async healthCheck(): Promise<{
    connected: boolean;
    initialized: boolean;
    basicStats: Record<string, unknown> | null;
    performanceScore: number;
  }> {
    try {
      const connected = !!window.electronAPI;
      const initialized = this.initialized;
      
      if (!connected || !initialized) {
        return {
          connected,
          initialized,
          basicStats: null,
          performanceScore: 0
        };
      }

      const basicStats = await this.getStats();
      
      // Calculate a basic performance score based on recent metrics
      const metrics = await this.getPerformanceMetrics(10);
      const avgDuration = metrics.length > 0 
        ? metrics.reduce((sum, m) => sum + (m.duration || 0), 0) / metrics.length
        : 100;
      
      // Score: lower average duration = higher score (max 100)
      const performanceScore = Math.max(0, Math.min(100, 100 - (avgDuration / 10)));

      return {
        connected,
        initialized,
        basicStats,
        performanceScore: Math.round(performanceScore)
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        connected: false,
        initialized: false,
        basicStats: null,
        performanceScore: 0
      };
    }
  }

  /**
   * Get database size and usage information
   */
  async getDatabaseInfo(): Promise<{
    size: string;
    tables: number;
    indexes: number;
    lastVacuum?: Date;
    lastAnalyze?: Date;
  }> {
    try {
      // This would require additional IPC methods to get detailed database info
      // For now, return basic information
      return {
        size: 'Unknown',
        tables: 8, // tracks, albums, artists, playlists, search_history, saved_filters, album_artwork, performance_metrics
        indexes: 15, // Approximate number of indexes created
        lastVacuum: undefined,
        lastAnalyze: undefined
      };
    } catch (error) {
      console.error('Failed to get database info:', error);
      throw error;
    }
  }

  /**
   * Update play count for a track
   */
  async updatePlayCount(trackId: string): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    await this.ensureInitialized();

    try {
      await window.electronAPI.dbUpdatePlayCount(trackId);
      console.log(`📊 Updated play count for track: ${trackId}`);
    } catch (error) {
      console.error('Failed to update play count:', error);
      throw error;
    }
  }

  // Cleanup
  close(): void {
    this.initialized = false;
  }
}

// Singleton instance
export const enhancedLocalLibraryDatabaseIPC = new EnhancedLocalLibraryDatabaseIPCService();