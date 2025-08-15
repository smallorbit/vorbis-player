// Environment detection utilities

/**
 * Detect if the app is running in Electron environment
 */
export const isElectron = (): boolean => {
  return !!(window.electronAPI || navigator.userAgent.toLowerCase().includes('electron'));
};

/**
 * Detect if the app is running in a web browser
 */
export const isWeb = (): boolean => {
  return !isElectron();
};

/**
 * Get the appropriate mode for the current environment
 */
export const getAppMode = (): 'local' | 'spotify' => {
  return isElectron() ? 'local' : 'spotify';
};

/**
 * Check if Spotify features should be enabled
 */
export const shouldEnableSpotify = (): boolean => {
  return isWeb();
};

/**
 * Check if local music features should be enabled
 */
export const shouldEnableLocalMusic = (): boolean => {
  return isElectron();
};
