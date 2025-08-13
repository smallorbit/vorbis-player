import { renderHook, act } from '@testing-library/react';
import { useDesktopIntegration } from './useDesktopIntegration';

// Mock the Electron API
const mockElectronAPI = {
  windowControls: {
    minimize: jest.fn(),
    maximize: jest.fn(),
    close: jest.fn(),
    toggleAlwaysOnTop: jest.fn(),
    getWindowState: jest.fn()
  },
  onGlobalShortcut: jest.fn(),
  showNotification: jest.fn(),
  platform: 'darwin',
  isElectron: true,
  isDevelopment: false
};

describe('useDesktopIntegration', () => {
  beforeEach(() => {
    // Reset window.electronAPI
    delete (window as any).electronAPI;
    jest.clearAllMocks();
  });

  it('should detect web environment when electronAPI is not available', () => {
    const { result } = renderHook(() => useDesktopIntegration());

    expect(result.current.isElectron).toBe(false);
    expect(result.current.isMac).toBe(false);
    expect(result.current.isWindows).toBe(false);
    expect(result.current.isLinux).toBe(false);
  });

  it('should detect Electron environment when electronAPI is available', () => {
    (window as any).electronAPI = mockElectronAPI;

    const { result } = renderHook(() => useDesktopIntegration());

    expect(result.current.isElectron).toBe(true);
    expect(result.current.isMac).toBe(true);
    expect(result.current.isWindows).toBe(false);
    expect(result.current.isLinux).toBe(false);
  });

  it('should detect Windows platform correctly', () => {
    (window as any).electronAPI = {
      ...mockElectronAPI,
      platform: 'win32'
    };

    const { result } = renderHook(() => useDesktopIntegration());

    expect(result.current.isElectron).toBe(true);
    expect(result.current.isMac).toBe(false);
    expect(result.current.isWindows).toBe(true);
    expect(result.current.isLinux).toBe(false);
  });

  it('should detect Linux platform correctly', () => {
    (window as any).electronAPI = {
      ...mockElectronAPI,
      platform: 'linux'
    };

    const { result } = renderHook(() => useDesktopIntegration());

    expect(result.current.isElectron).toBe(true);
    expect(result.current.isMac).toBe(false);
    expect(result.current.isWindows).toBe(false);
    expect(result.current.isLinux).toBe(true);
  });

  it('should initialize with default window state', () => {
    const { result } = renderHook(() => useDesktopIntegration());

    expect(result.current.windowState).toEqual({
      isMaximized: false,
      isAlwaysOnTop: false
    });
  });

  it('should call window control functions in Electron environment', async () => {
    (window as any).electronAPI = mockElectronAPI;

    const { result } = renderHook(() => useDesktopIntegration());

    await act(async () => {
      await result.current.minimize();
    });

    expect(mockElectronAPI.windowControls.minimize).toHaveBeenCalled();

    await act(async () => {
      await result.current.maximize();
    });

    expect(mockElectronAPI.windowControls.maximize).toHaveBeenCalled();

    await act(async () => {
      await result.current.close();
    });

    expect(mockElectronAPI.windowControls.close).toHaveBeenCalled();
  });

  it('should not call window control functions in web environment', async () => {
    const { result } = renderHook(() => useDesktopIntegration());

    await act(async () => {
      await result.current.minimize();
    });

    expect(mockElectronAPI.windowControls.minimize).not.toHaveBeenCalled();
  });

  it('should handle mouse events correctly', () => {
    const { result } = renderHook(() => useDesktopIntegration());

    const mockEvent = {
      target: document.createElement('div')
    } as React.MouseEvent;

    act(() => {
      result.current.handleMouseDown(mockEvent);
    });

    expect(result.current.isDragging).toBe(false); // Should be false in web environment

    act(() => {
      result.current.handleMouseUp();
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('should prevent dragging from interactive elements', () => {
    (window as any).electronAPI = mockElectronAPI;

    const { result } = renderHook(() => useDesktopIntegration());

    const button = document.createElement('button');
    const mockEvent = {
      target: button
    } as React.MouseEvent;

    act(() => {
      result.current.handleMouseDown(mockEvent);
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('should show notifications in Electron environment', async () => {
    (window as any).electronAPI = mockElectronAPI;

    const { result } = renderHook(() => useDesktopIntegration());

    await act(async () => {
      await result.current.showNotification('Test Title', 'Test Body');
    });

    expect(mockElectronAPI.showNotification).toHaveBeenCalledWith({
      title: 'Test Title',
      body: 'Test Body'
    });
  });

  it('should not show notifications in web environment', async () => {
    const { result } = renderHook(() => useDesktopIntegration());

    await act(async () => {
      await result.current.showNotification('Test Title', 'Test Body');
    });

    expect(mockElectronAPI.showNotification).not.toHaveBeenCalled();
  });

  it('should update window state when getWindowState is called', async () => {
    const mockWindowState = {
      isMaximized: true,
      isAlwaysOnTop: true
    };

    (window as any).electronAPI = {
      ...mockElectronAPI,
      windowControls: {
        ...mockElectronAPI.windowControls,
        getWindowState: jest.fn().mockResolvedValue(mockWindowState)
      }
    };

    const { result } = renderHook(() => useDesktopIntegration());

    await act(async () => {
      await result.current.maximize();
    });

    expect(result.current.windowState).toEqual(mockWindowState);
  });
});