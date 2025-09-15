// Electron API interface for local music library functionality
// Note: Types imported inline to avoid circular dependency with spotify.d.ts

interface LocalTrackBase {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  format: string;
  source: 'local';
}

interface DbAlbumBase {
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

interface DbArtistBase {
  id: string;
  name: string;
  album_count: number;
  track_count: number;
  total_duration: number;
  date_added: string;
}

interface DbAlbumArtworkBase {
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

interface DbPerformanceMetricBase {
  id: string;
  operation: string;
  duration: number;
  timestamp: string;
  metadata?: string;
}

interface LocalLibrarySettingsBase {
  musicDirectories: string[];
  watchForChanges: boolean;
  scanOnStartup: boolean;
  autoIndexNewFiles: boolean;
  supportedFormats: string[];
  excludePatterns: string[];
  includeSubdirectories: boolean;
}

interface AdvancedFilterCriteriaBase {
  artists?: string[];
  albums?: string[];
  genres?: string[];
  years?: { min?: number; max?: number };
  duration?: { min?: number; max?: number };
  bitrate?: { min?: number; max?: number };
  formats?: string[];
  playCount?: { min?: number; max?: number };
  dateAdded?: { from?: string; to?: string };
  hasLyrics?: boolean;
  hasAlbumArt?: boolean;
}
export interface ElectronAPI {
  // File system operations
  getAudioFiles(directory: string, options: {
    recursive: boolean;
    extensions: string[];
    exclude: string[];
  }): Promise<string[]>;
  
  getFileStats(filePath: string): Promise<{
    size: number;
    mtime: Date;
    isFile: boolean;
    isDirectory: boolean;
  }>;
  
  readAudioFile(filePath: string): Promise<ArrayBuffer>;
  readFileBuffer(filePath: string): Promise<Buffer>;
  
  // Directory operations
  selectMusicDirectory(): Promise<string | null>;
  getDirectoryFiles(directoryPath: string): Promise<string[]>;
  
  // Image processing operations (Phase 2)
  processImage(imageData: Buffer, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
  }): Promise<{ data: Buffer; format: string }>;
  
  getImageDimensions(imageData: Buffer): Promise<{ width: number; height: number }>;
  
  // Database operations
  getDatabasePath(): Promise<string>;
  
  // Path operations
  joinPath(...paths: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
  
  // App operations
  getAppVersion(): Promise<string>;
  getAppPath(): Promise<string>;
  getUserDataPath(): Promise<string>;
  
  // Basic database operations
  dbInitialize(): Promise<boolean>;
  dbGetAllTracks(): Promise<LocalTrackBase[]>;
  dbGetAllAlbums(): Promise<DbAlbumBase[]>;
  dbGetAllArtists(): Promise<DbArtistBase[]>;
  dbClearLibrary(): Promise<void>;
  dbGetStats(): Promise<{
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalDuration: number;
  }>;
  dbUpdatePlayCount(trackId: string): Promise<void>;
  
  // Enhanced Phase 2 database operations
  dbSearchTracks(options: {
    query: string;
    type: string;
    limit?: number;
    offset?: number;
    fuzzyMatch?: boolean;
  }): Promise<LocalTrackBase[]>;
  
  dbFilterTracks(criteria: AdvancedFilterCriteriaBase, limit?: number, offset?: number): Promise<LocalTrackBase[]>;
  dbGetAlbumArtwork(trackId: string): Promise<DbAlbumArtworkBase | null>;
  dbVacuum(): Promise<{ success: boolean }>;
  dbAnalyze(): Promise<{ success: boolean }>;
  dbGetPerformanceMetrics(limit?: number): Promise<DbPerformanceMetricBase[]>;
  dbGetDetailedStats(): Promise<{
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalDuration: number;
    totalFileSize: number;
    averageBitrate: number;
    formatBreakdown: { format: string; count: number; total_size: number }[];
    genreBreakdown: { genre: string; count: number }[];
    yearBreakdown: { year: number; count: number }[];
  }>;
  
  // Scanner operations
  scannerGetSettings(): Promise<LocalLibrarySettingsBase>;
  scannerUpdateSettings(settings: Partial<LocalLibrarySettingsBase>): Promise<{ success: boolean; message?: string }>;
  scannerAddDirectory(directory: string): Promise<void>;
  scannerRemoveDirectory(directory: string): Promise<void>;
  scannerGetProgress(): Promise<{
    isScanning: boolean;
    totalFiles: number;
    scannedFiles: number;
    currentFile: string;
    errors: string[];
  }>;
  scannerScanDirectories(options?: {
    extractArtwork?: boolean;
    parallel?: boolean;
    batchSize?: number;
  }): Promise<{ 
    success: boolean;
    message: string;
    totalFiles?: number;
    processedFiles?: number;
    errors?: number;
  }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}