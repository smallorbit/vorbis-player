// Desktop utility functions for the Vorbis Player

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SystemInfo {
  platform: string;
  version: string;
  arch: string;
  isElectron: boolean;
  isDevelopment: boolean;
}

export class DesktopUtils {
  private static isElectron = !!(window as any).electronAPI?.isElectron;

  /**
   * Get system information
   */
  static getSystemInfo(): SystemInfo {
    return {
      platform: navigator.platform,
      version: navigator.userAgent,
      arch: navigator.userAgent.includes('x64') ? 'x64' : 'x86',
      isElectron: this.isElectron,
      isDevelopment: (window as any).electronAPI?.isDevelopment || false
    };
  }

  /**
   * Check if running in Electron
   */
  static isElectronApp(): boolean {
    return this.isElectron;
  }

  /**
   * Check if running in development mode
   */
  static isDevelopmentMode(): boolean {
    return (window as any).electronAPI?.isDevelopment || false;
  }

  /**
   * Get platform-specific class name
   */
  static getPlatformClass(): string {
    if (!this.isElectron) return 'platform-web';
    
    const platform = (window as any).electronAPI?.platform;
    switch (platform) {
      case 'darwin':
        return 'platform-mac';
      case 'win32':
        return 'platform-windows';
      case 'linux':
        return 'platform-linux';
      default:
        return 'platform-unknown';
    }
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format duration in seconds to MM:SS format
   */
  static formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Debounce function for performance optimization
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Throttle function for performance optimization
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Generate a unique ID
   */
  static generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Deep clone an object
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as any;
    if (obj instanceof Array) return obj.map(item => this.deepClone(item)) as any;
    if (typeof obj === 'object') {
      const clonedObj = {} as any;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
    return obj;
  }

  /**
   * Check if two objects are deeply equal
   */
  static deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 !== 'object') return obj1 === obj2;
    
    if (obj1 instanceof Date && obj2 instanceof Date) {
      return obj1.getTime() === obj2.getTime();
    }
    
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length !== obj2.length) return false;
      for (let i = 0; i < obj1.length; i++) {
        if (!this.deepEqual(obj1[i], obj2[i])) return false;
      }
      return true;
    }
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }

  /**
   * Get window bounds relative to screen
   */
  static getWindowBounds(): WindowBounds {
    return {
      x: window.screenX,
      y: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight
    };
  }

  /**
   * Check if window is in fullscreen mode
   */
  static isFullscreen(): boolean {
    return !!(document.fullscreenElement || 
              (document as any).webkitFullscreenElement || 
              (document as any).mozFullScreenElement);
  }

  /**
   * Request fullscreen mode
   */
  static async requestFullscreen(element: HTMLElement = document.documentElement): Promise<void> {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if ((element as any).webkitRequestFullscreen) {
      await (element as any).webkitRequestFullscreen();
    } else if ((element as any).mozRequestFullScreen) {
      await (element as any).mozRequestFullScreen();
    }
  }

  /**
   * Exit fullscreen mode
   */
  static async exitFullscreen(): Promise<void> {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      await (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      await (document as any).mozCancelFullScreen();
    }
  }

  /**
   * Copy text to clipboard
   */
  static async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Read text from clipboard
   */
  static async readFromClipboard(): Promise<string> {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      console.error('Failed to read from clipboard:', error);
      return '';
    }
  }

  /**
   * Check if clipboard API is supported
   */
  static isClipboardSupported(): boolean {
    return 'clipboard' in navigator;
  }

  /**
   * Get system theme preference
   */
  static getSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Listen for system theme changes
   */
  static onSystemThemeChange(callback: (theme: 'light' | 'dark') => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      callback(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handler);
    
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }

  /**
   * Check if reduced motion is preferred
   */
  static prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Check if high contrast mode is enabled
   */
  static prefersHighContrast(): boolean {
    return window.matchMedia('(prefers-contrast: high)').matches;
  }

  /**
   * Get system language
   */
  static getSystemLanguage(): string {
    return navigator.language || 'en-US';
  }

  /**
   * Check if the app is focused
   */
  static isAppFocused(): boolean {
    return document.hasFocus();
  }

  /**
   * Listen for app focus/blur events
   */
  static onAppFocusChange(callback: (isFocused: boolean) => void): () => void {
    const handleFocus = () => callback(true);
    const handleBlur = () => callback(false);
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }
}