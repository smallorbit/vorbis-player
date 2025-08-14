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

// Local music library types
export interface LocalTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number; // in milliseconds
  filePath: string;
  fileName: string;
  fileSize: number;
  format: string; // 'mp3', 'flac', 'wav', etc.
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

export {};