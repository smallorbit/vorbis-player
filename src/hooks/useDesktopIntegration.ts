import { useEffect, useState, useCallback } from 'react';

interface WindowState {
  isMaximized: boolean;
  isAlwaysOnTop: boolean;
}

interface ElectronAPI {
  windowControls: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    toggleAlwaysOnTop: () => Promise<void>;
    getWindowState: () => Promise<WindowState>;
  };
  onGlobalShortcut: (callback: (shortcut: string) => void) => void;
  showNotification: (notification: { title: string; body: string; icon?: string }) => Promise<void>;
  platform: string;
  isElectron: boolean;
  isDevelopment: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const useDesktopIntegration = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [windowState, setWindowState] = useState<WindowState>({
    isMaximized: false,
    isAlwaysOnTop: false
  });
  const [isDragging, setIsDragging] = useState(false);

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(!!window.electronAPI?.isElectron);
  }, []);

  // Get initial window state
  useEffect(() => {
    if (isElectron && window.electronAPI) {
      window.electronAPI.windowControls.getWindowState().then(setWindowState);
    }
  }, [isElectron]);

  // Handle global shortcuts
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    const handleGlobalShortcut = (shortcut: string) => {
      // Dispatch custom events that the player can listen to
      const event = new CustomEvent('global-shortcut', { detail: shortcut });
      window.dispatchEvent(event);
    };

    window.electronAPI.onGlobalShortcut(handleGlobalShortcut);

    return () => {
      // Cleanup is handled by the preload script
    };
  }, [isElectron]);

  // Window control functions
  const minimize = useCallback(async () => {
    if (isElectron && window.electronAPI) {
      await window.electronAPI.windowControls.minimize();
    }
  }, [isElectron]);

  const maximize = useCallback(async () => {
    if (isElectron && window.electronAPI) {
      await window.electronAPI.windowControls.maximize();
      // Update local state
      const newState = await window.electronAPI.windowControls.getWindowState();
      setWindowState(newState);
    }
  }, [isElectron]);

  const close = useCallback(async () => {
    if (isElectron && window.electronAPI) {
      await window.electronAPI.windowControls.close();
    }
  }, [isElectron]);

  const toggleAlwaysOnTop = useCallback(async () => {
    if (isElectron && window.electronAPI) {
      await window.electronAPI.windowControls.toggleAlwaysOnTop();
      // Update local state
      const newState = await window.electronAPI.windowControls.getWindowState();
      setWindowState(newState);
    }
  }, [isElectron]);

  // Show notification
  const showNotification = useCallback(async (title: string, body: string, icon?: string) => {
    if (isElectron && window.electronAPI) {
      await window.electronAPI.showNotification({ title, body, icon });
    }
  }, [isElectron]);

  // Window dragging functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only allow dragging from non-interactive elements
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, input, select, textarea, [role="button"], [tabindex]');
    
    if (!isInteractive && isElectron) {
      setIsDragging(true);
      // The actual dragging is handled by CSS and Electron's frameless window
    }
  }, [isElectron]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Platform-specific utilities
  const isMac = isElectron && window.electronAPI?.platform === 'darwin';
  const isWindows = isElectron && window.electronAPI?.platform === 'win32';
  const isLinux = isElectron && window.electronAPI?.platform === 'linux';

  return {
    isElectron,
    windowState,
    isDragging,
    minimize,
    maximize,
    close,
    toggleAlwaysOnTop,
    showNotification,
    handleMouseDown,
    handleMouseUp,
    isMac,
    isWindows,
    isLinux
  };
};