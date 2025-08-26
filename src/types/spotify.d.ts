/**
 * @fileoverview Spotify and Local Music Type Definitions
 * 
 * Comprehensive type definitions for the Vorbis Player application,
 * supporting both Spotify Web Playback SDK integration and local music
 * library management. Provides unified interfaces for cross-platform
 * music playback.
 * 
 * @architecture
 * This file defines the core data structures used throughout the application:
 * - Spotify Web Playback SDK interfaces
 * - Local music library types
 * - Enhanced unified track interface
 * - Database and API response types
 * 
 * @relationships
 * - SpotifyTrack: Base interface for Spotify track data
 * - LocalTrack: Detailed interface for local music metadata
 * - EnhancedTrack: Unified interface extending SpotifyTrack with local properties
 * - SpotifyPlaybackState: Real-time playback state from Spotify SDK
 * 
 * @usage
 * ```typescript
 * import type { EnhancedTrack, LocalTrack, SpotifyTrack } from './types/spotify';
 * 
 * // Use unified track interface for any music source
 * const track: EnhancedTrack = {
 *   id: 'spotify:track:123',
 *   name: 'Song Title',
 *   source: 'spotify',
 *   // ... other properties
 * };
 * ```
 * 
 * @author Vorbis Player Team
 * @version 2.0.0
 */

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }

  interface SpotifyPlayer {
    connect(): Promise<boolean>;
    disconnect(): void;
    getCurrentState(): Promise<SpotifyPlaybackState | null>;
    getVolume(): Promise<number>;
    nextTrack(): Promise<void>;
    pause(): Promise<void>;
    previousTrack(): Promise<void>;
    resume(): Promise<void>;
    seek(position_ms: number): Promise<void>;
    setName(name: string): Promise<void>;
    setVolume(volume: number): Promise<void>;
    togglePlay(): Promise<void>;
    
    addListener(event: 'ready', callback: (data: { device_id: string }) => void): void;
    addListener(event: 'not_ready', callback: (data: { device_id: string }) => void): void;
    addListener(event: 'initialization_error', callback: (data: { message: string }) => void): void;
    addListener(event: 'authentication_error', callback: (data: { message: string }) => void): void;
    addListener(event: 'account_error', callback: (data: { message: string }) => void): void;
    addListener(event: 'playback_error', callback: (data: { message: string }) => void): void;
    addListener(event: 'player_state_changed', callback: (state: SpotifyPlaybackState | null) => void): void;
    
    removeListener(event: string, callback?: (...args: unknown[]) => void): void;
  }

  interface SpotifyPlaybackState {
    context: {
      uri: string;
      metadata: Record<string, unknown>;
    };
    disallows: {
      pausing: boolean;
      peeking_next: boolean;
      peeking_prev: boolean;
      resuming: boolean;
      seeking: boolean;
      skipping_next: boolean;
      skipping_prev: boolean;
    };
    paused: boolean;
    position: number;
    repeat_mode: number;
    shuffle: boolean;
    track_window: {
      current_track: SpotifyTrack;
      next_tracks: SpotifyTrack[];
      previous_tracks: SpotifyTrack[];
    };
  }

  interface SpotifyTrack {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    artists: Array<{
      name: string;
      uri: string;
    }>;
    album: {
      name: string;
      uri: string;
      images: Array<{
        url: string;
        height: number;
        width: number;
      }>;
    };
  }
}

/**
 * Local music library track interface
 * 
 * Represents a track from the local music library with comprehensive
 * metadata extracted from audio files. Includes file system information
 * and audio format details.
 * 
 * @interface LocalTrack
 * 
 * @property {string} id - Unique track identifier (generated)
 * @property {string} name - Track name from metadata
 * @property {string} artist - Primary artist name
 * @property {string} album - Album name
 * @property {number} duration - Track duration in milliseconds
 * @property {string} filePath - Full file system path
 * @property {string} fileName - Original filename
 * @property {number} fileSize - File size in bytes
 * @property {string} format - Audio format (mp3, flac, wav, m4a, etc.)
 * @property {string} [codec] - Audio codec (ALAC, AAC, MP3, FLAC, etc.)
 * @property {number} [bitrate] - Audio bitrate in kbps
 * @property {number} [sampleRate] - Audio sample rate in Hz
 * @property {number} [trackNumber] - Track number on album
 * @property {number} [year] - Release year
 * @property {string} [genre] - Genre
 * @property {string} [albumArtist] - Album artist
 * @property {string} [composer] - Composer
 * @property {string} [comment] - User comments
 * @property {string} [lyrics] - Track lyrics
 * @property {string} [albumArt] - Album artwork data
 * @property {Date} dateAdded - When track was added to library
 * @property {Date} dateModified - When track metadata was last modified
 * @property {number} playCount - Number of times track has been played
 * @property {Date} [lastPlayed] - When track was last played
 * @property {'local'} source - Source identifier (always 'local')
 * 
 * @example
 * ```typescript
 * const localTrack: LocalTrack = {
 *   id: 'local_abc123',
 *   name: 'Bohemian Rhapsody',
 *   artist: 'Queen',
 *   album: 'A Night at the Opera',
 *   duration: 354000,
 *   filePath: '/Music/Queen/A Night at the Opera/01 Bohemian Rhapsody.flac',
 *   fileName: '01 Bohemian Rhapsody.flac',
 *   fileSize: 45678901,
 *   format: 'flac',
 *   codec: 'FLAC',
 *   bitrate: 1000,
 *   sampleRate: 44100,
 *   trackNumber: 1,
 *   year: 1975,
 *   genre: 'Rock',
 *   albumArtist: 'Queen',
 *   dateAdded: new Date('2024-01-15'),
 *   dateModified: new Date('2024-01-15'),
 *   playCount: 42,
 *   lastPlayed: new Date('2024-01-20'),
 *   source: 'local'
 * };
 * ```
 */
export interface LocalTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number; // in milliseconds
  filePath: string;
  fileName: string;
  fileSize: number;
  format: string; // 'mp3', 'flac', 'wav', 'm4a', etc.
  codec?: string; // 'ALAC', 'AAC', 'MP3', 'FLAC', etc.
  bitrate?: number;
  sampleRate?: number;
  trackNumber?: number;
  year?: number;
  genre?: string;
  albumArtist?: string;
  composer?: string;
  comment?: string;
  lyrics?: string;
  albumArt?: string; // base64 encoded or file path
  dateAdded: Date;
  dateModified: Date;
  playCount: number;
  lastPlayed?: Date;
  source: 'local';
}

// Enhanced Track interface to support both Spotify and local tracks
export interface EnhancedTrack extends SpotifyTrack {
  source: 'spotify' | 'local';
  filePath?: string; // for local tracks
  format?: string; // for local tracks
  bitrate?: number; // for local tracks
}

// Audio player configuration
export interface AudioPlayerConfig {
  enableLocalPlayback: boolean;
  maxCacheSize: number; // in MB
  audioQuality: 'auto' | 'high' | 'medium' | 'low';
  crossfadeDuration: number; // in seconds
  gaplessPlayback: boolean;
}

// Local library settings
export interface LocalLibrarySettings {
  musicDirectories: string[];
  watchForChanges: boolean;
  scanOnStartup: boolean;
  autoIndexNewFiles: boolean;
  supportedFormats: string[];
  excludePatterns: string[];
  includeSubdirectories: boolean;
}

// Database schema types
export interface DbTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  file_path: string;
  file_name: string;
  file_size: number;
  format: string;
  codec?: string;
  bitrate?: number;
  sample_rate?: number;
  track_number?: number;
  year?: number;
  genre?: string;
  album_artist?: string;
  composer?: string;
  comment?: string;
  lyrics?: string;
  album_art?: string;
  date_added: string; // ISO string
  date_modified: string; // ISO string
  play_count: number;
  last_played?: string; // ISO string
}

export interface DbAlbum {
  id: string;
  name: string;
  artist: string;
  year?: number;
  genre?: string;
  album_art?: string;
  track_count: number;
  total_duration: number;
  date_added: string;
}

export interface DbArtist {
  id: string;
  name: string;
  album_count: number;
  track_count: number;
  total_duration: number;
  date_added: string;
}

// New types for Phase 2 features
export interface DbPlaylist {
  id: string;
  name: string;
  description?: string;
  track_ids: string; // JSON array of track IDs
  is_mixed: boolean; // true if contains both local and Spotify tracks
  spotify_tracks?: string; // JSON array of Spotify track data
  cover_art?: string;
  date_created: string;
  date_modified: string;
  created_by: 'user' | 'system';
}

export interface DbSearchHistory {
  id: string;
  query: string;
  search_type: 'tracks' | 'albums' | 'artists' | 'all';
  result_count: number;
  timestamp: string;
}

export interface DbSavedFilter {
  id: string;
  name: string;
  filter_criteria: string; // JSON object with filter parameters
  date_created: string;
  date_modified: string;
}

export interface DbMigration {
  id: number;
  version: string;
  description: string;
  executed_at: string;
}

// Enhanced filter types
export interface AdvancedFilterCriteria {
  artists?: string[];
  albums?: string[];
  genres?: string[];
  years?: { min?: number; max?: number };
  duration?: { min?: number; max?: number }; // in seconds
  bitrate?: { min?: number; max?: number };
  formats?: string[];
  playCount?: { min?: number; max?: number };
  dateAdded?: { from?: string; to?: string };
  hasLyrics?: boolean;
  hasAlbumArt?: boolean;
}

export interface SearchOptions {
  query: string;
  type: 'tracks' | 'albums' | 'artists' | 'all';
  limit?: number;
  offset?: number;
  fuzzyMatch?: boolean;
  sortBy?: 'relevance' | 'name' | 'artist' | 'album' | 'year' | 'dateAdded';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  tracks: LocalTrack[];
  albums: DbAlbum[];
  artists: DbArtist[];
  totalResults: number;
  searchTime: number; // in milliseconds
}

// Album art processing types
export interface AlbumArtwork {
  id: string;
  track_id?: string;
  album_id?: string;
  data: string; // base64 encoded image
  format: string; // 'image/jpeg', 'image/png', etc.
  width: number;
  height: number;
  file_size: number;
  source: 'embedded' | 'directory' | 'online';
  file_path?: string; // for directory-based artwork
  date_added: string;
}

export interface DbAlbumArtwork {
  id: string;
  track_id?: string;
  album_id?: string;
  data: string;
  format: string;
  width: number;
  height: number;
  file_size: number;
  source: string;
  file_path?: string;
  date_added: string;
}

// Performance monitoring types
export interface DbPerformanceMetric {
  id: string;
  operation: string;
  duration: number; // in milliseconds
  timestamp: string;
  metadata?: string; // JSON object with additional data
}

export {};