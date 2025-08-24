import type { LocalTrack, DbTrack, DbAlbum, DbArtist } from '../types/spotify.d.ts';

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

  // Placeholder methods for future implementation
  async addTrack(track: LocalTrack): Promise<void> {
    // TODO: Implement when needed
    throw new Error('Not implemented yet');
  }

  async updateTrack(track: LocalTrack): Promise<void> {
    // TODO: Implement when needed
    throw new Error('Not implemented yet');
  }

  async deleteTrack(id: string): Promise<void> {
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
