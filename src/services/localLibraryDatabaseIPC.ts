import type { LocalTrack, DbAlbum, DbArtist } from '../types/spotify.d.ts';

// IPC-based database service for renderer process
// This uses the electronAPI bridge instead of importing better-sqlite3 directly
export class LocalLibraryDatabaseService {
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
      console.log('🗄️ Local library database IPC service initialized');
    } catch (error) {
      console.error('Failed to initialize database IPC service:', error);
      throw error;
    }
  }

  async getAllTracks(): Promise<LocalTrack[]> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    if (!this.initialized) {
      await this.initialize();
    }

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

    if (!this.initialized) {
      await this.initialize();
    }

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

    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await window.electronAPI.dbGetAllArtists();
    } catch (error) {
      console.error('Failed to get all artists:', error);
      throw error;
    }
  }

  async getStats(): Promise<{
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalDuration: number;
  }> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await window.electronAPI.dbGetStats();
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw error;
    }
  }

  async clearLibrary(): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await window.electronAPI.dbClearLibrary();
      console.log('✅ Library cleared via IPC');
    } catch (error) {
      console.error('Failed to clear library:', error);
      throw error;
    }
  }

  /**
   * TODO: Implement track update functionality
   * 
   * @priority: Low
   * @context: Track metadata editing feature
   * @dependencies: Database schema updates, UI components
   * @requirements:
   * - Validate track metadata before update
   * - Handle file system changes
   * - Update related album/artist records
   * - Trigger UI refresh after update
   * - Handle concurrent update conflicts
   * 
   * @issue: Track metadata editing capabilities
   * @estimated-effort: 2-3 days
   * @impact: User ability to edit track information
   */
  // TODO: Implement when needed

  /**
   * TODO: Implement playlist management functionality
   * 
   * @priority: Medium
   * @context: Playlist creation and management
   * @dependencies: Database schema for playlists, UI components
   * @requirements:
   * - Create playlist database table
   * - Implement playlist CRUD operations
   * - Add track reordering capabilities
   * - Handle playlist sharing and export
   * - Support mixed local/Spotify playlists
   * 
   * @issue: Playlist management system
   * @estimated-effort: 3-4 days
   * @impact: Enhanced playlist functionality
   */
  // TODO: Implement when needed

  /**
   * TODO: Implement user preferences and settings
   * 
   * @priority: Low
   * @context: User customization and preferences
   * @dependencies: Settings storage system, UI components
   * @requirements:
   * - Create settings database table
   * - Implement settings persistence
   * - Add user preference UI
   * - Handle settings migration
   * - Support theme customization
   * 
   * @issue: User preferences and settings management
   * @estimated-effort: 2-3 days
   * @impact: Improved user experience and customization
   */
  // TODO: Implement when needed

  async addTrack(): Promise<void> {
    // TODO: Implement when needed
    throw new Error('Not implemented yet');
  }

  async updateTrack(): Promise<void> {
    // TODO: Implement when needed
    throw new Error('Not implemented yet');
  }

  async deleteTrack(): Promise<void> {
    // TODO: Implement when needed
    throw new Error('Not implemented yet');
  }

  close(): void {
    // IPC service doesn't need explicit closing
    this.initialized = false;
  }
}

// Singleton instance
export const localLibraryDatabase = new LocalLibraryDatabaseService();
