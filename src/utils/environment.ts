/**
 * @fileoverview Environment Detection Utility
 * 
 * Environment detection and feature flag utilities for the Vorbis Player application.
 * Determines the runtime environment (Electron vs Web) and enables/disables
 * features accordingly for optimal user experience.
 * 
 * @architecture
 * This utility provides a centralized way to detect the application's runtime
 * environment and manage feature flags based on platform capabilities.
 * 
 * @features
 * - Electron vs Web browser detection
 * - Feature flag management
 * - Platform-specific behavior control
 * - Environment-aware UI rendering
 * 
 * @environments
 * - Electron: Desktop application with local file access
 * - Web: Browser-based application with Spotify integration
 * 
 * @usage
 * ```typescript
 * import { isElectron, getAppMode, shouldEnableLocalMusic } from './utils/environment';
 * 
 * if (isElectron()) {
 *   // Enable local music features
 *   enableLocalLibrary();
 * } else {
 *   // Enable Spotify features
 *   enableSpotifyIntegration();
 * }
 * 
 * const mode = getAppMode(); // 'local' or 'spotify'
 * ```
 * 
 * @dependencies
 * - window.electronAPI: Electron-specific API (if available)
 * - navigator.userAgent: Browser user agent string
 * 
 * @author Vorbis Player Team
 * @version 2.0.0
 */

/**
 * Detects if the application is running in an Electron environment
 * 
 * Checks for Electron-specific APIs and user agent strings to determine
 * if the app is running as a desktop application.
 * 
 * @returns True if running in Electron, false otherwise
 * 
 * @example
 * ```typescript
 * if (isElectron()) {
 *   console.log('Running in Electron desktop app');
 *   // Enable local file system access
 * } else {
 *   console.log('Running in web browser');
 *   // Enable web-specific features
 * }
 * ```
 * 
 * @detection-methods
 * - Checks for window.electronAPI (Electron preload script)
 * - Checks navigator.userAgent for 'electron' string
 * - Falls back to user agent detection for older Electron versions
 */
export const isElectron = (): boolean => {
  return !!(window.electronAPI || navigator.userAgent.toLowerCase().includes('electron'));
};

/**
 * Detects if the application is running in a web browser
 * 
 * Inverse of isElectron(). Determines if the app is running
 * in a standard web browser environment.
 * 
 * @returns True if running in web browser, false otherwise
 * 
 * @example
 * ```typescript
 * if (isWeb()) {
 *   console.log('Running in web browser');
 *   // Enable web-specific features like Spotify integration
 * }
 * ```
 * 
 * @see isElectron - For Electron environment detection
 */
export const isWeb = (): boolean => {
  return !isElectron();
};

/**
 * Gets the appropriate application mode for the current environment
 * 
 * Returns the recommended mode based on the detected environment.
 * Electron environments default to 'local' mode, while web environments
 * default to 'spotify' mode.
 * 
 * @returns 'local' for Electron environments, 'spotify' for web environments
 * 
 * @example
 * ```typescript
 * const mode = getAppMode();
 * switch (mode) {
 *   case 'local':
 *     initializeLocalLibrary();
 *     break;
 *   case 'spotify':
 *     initializeSpotifyIntegration();
 *     break;
 * }
 * ```
 * 
 * @modes
 * - local: Local music library mode (Electron)
 * - spotify: Spotify streaming mode (Web)
 * 
 * @see isElectron - For environment detection logic
 */
export const getAppMode = (): 'local' | 'spotify' => {
  return isElectron() ? 'local' : 'spotify';
};

/**
 * Checks if Spotify features should be enabled
 * 
 * Determines if Spotify integration features should be available
 * based on the current environment. Spotify features are typically
 * only available in web browser environments.
 * 
 * @returns True if Spotify features should be enabled
 * 
 * @example
 * ```typescript
 * if (shouldEnableSpotify()) {
 *   // Show Spotify login button
 *   // Enable Spotify playlist features
 *   // Initialize Spotify Web Playback SDK
 * }
 * ```
 * 
 * @features
 * - Spotify Web Playback SDK integration
 * - Spotify playlist management
 * - Spotify user authentication
 * - Spotify track streaming
 * 
 * @see isWeb - For web environment detection
 */
export const shouldEnableSpotify = (): boolean => {
  return isWeb();
};

/**
 * Checks if local music features should be enabled
 * 
 * Determines if local music library features should be available
 * based on the current environment. Local music features are typically
 * only available in Electron desktop environments.
 * 
 * @returns True if local music features should be enabled
 * 
 * @example
 * ```typescript
 * if (shouldEnableLocalMusic()) {
 *   // Show local library browser
 *   // Enable file system access
 *   // Initialize local audio player
 * }
 * ```
 * 
 * @features
 * - Local file system access
 * - Local music library scanning
 * - Local audio playback
 * - Local playlist management
 * 
 * @see isElectron - For Electron environment detection
 */
export const shouldEnableLocalMusic = (): boolean => {
  return isElectron();
};
