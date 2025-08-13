const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  windowControls: {
    minimize: () => ipcRenderer.invoke('window-controls', 'minimize'),
    maximize: () => ipcRenderer.invoke('window-controls', 'maximize'),
    close: () => ipcRenderer.invoke('window-controls', 'close'),
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window-controls', 'toggle-always-on-top'),
    getWindowState: () => ipcRenderer.invoke('get-window-state')
  },

  // Global shortcuts
  onGlobalShortcut: (callback) => {
    ipcRenderer.on('global-shortcut', (event, shortcut) => callback(shortcut));
  },

  // Notifications
  showNotification: (notification) => ipcRenderer.invoke('show-notification', notification),

  // Platform detection
  platform: process.platform,

  // Environment detection
  isElectron: true,
  isDevelopment: process.env.NODE_ENV === 'development'
});

// Remove all listeners when the window is closed
window.addEventListener('beforeunload', () => {
  ipcRenderer.removeAllListeners('global-shortcut');
});