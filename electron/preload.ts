import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../src/types/electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  // File system operations
  getAudioFiles: (directory: string, options: {
    recursive: boolean;
    extensions: string[];
    exclude: string[];
  }) => ipcRenderer.invoke('get-audio-files', directory, options),

  getFileStats: (filePath: string) => ipcRenderer.invoke('get-file-stats', filePath),

  readAudioFile: (filePath: string) => ipcRenderer.invoke('read-audio-file', filePath),

  readFileBuffer: (filePath: string) => ipcRenderer.invoke('read-file-buffer', filePath),

  // Directory operations
  selectMusicDirectory: () => ipcRenderer.invoke('select-music-directory'),

  // Database operations
  getDatabasePath: () => ipcRenderer.invoke('get-database-path'),

  // Path operations
  joinPath: (...paths: string[]) => ipcRenderer.invoke('join-path', ...paths),
  dirname: (path: string) => ipcRenderer.invoke('dirname', path),
  basename: (path: string) => ipcRenderer.invoke('basename', path),

  // App operations
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

  // Database operations
  dbInitialize: () => ipcRenderer.invoke('db-initialize'),
  dbGetAllTracks: () => ipcRenderer.invoke('db-get-all-tracks'),
  dbGetAllAlbums: () => ipcRenderer.invoke('db-get-all-albums'),
  dbGetAllArtists: () => ipcRenderer.invoke('db-get-all-artists'),
  dbClearLibrary: () => ipcRenderer.invoke('db-clear-library'),
  dbGetStats: () => ipcRenderer.invoke('db-get-stats'),
  dbUpdatePlayCount: (trackId: string) => ipcRenderer.invoke('db-update-play-count', trackId),
  
  // Scanner operations
  scannerGetSettings: () => ipcRenderer.invoke('scanner-get-settings'),
  scannerUpdateSettings: (settings: any) => ipcRenderer.invoke('scanner-update-settings', settings),
  scannerAddDirectory: (directory: string) => ipcRenderer.invoke('scanner-add-directory', directory),
  scannerRemoveDirectory: (directory: string) => ipcRenderer.invoke('scanner-remove-directory', directory),
  scannerGetProgress: () => ipcRenderer.invoke('scanner-get-progress'),
  scannerScanDirectories: (options?: {
    extractArtwork?: boolean;
    parallel?: boolean;
    batchSize?: number;
  }) => ipcRenderer.invoke('scanner-scan-directories', options),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Listen for messages from main process
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, (process.versions as any)[type]);
  }
});
