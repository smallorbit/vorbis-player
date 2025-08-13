const { app, BrowserWindow, globalShortcut, ipcMain, shell, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize electron-store for persistent settings
const store = new Store();

let mainWindow;
let tray;
let isQuitting = false;

// Window state management
const windowState = {
  width: store.get('windowState.width', 1024),
  height: store.get('windowState.height', 1186),
  x: store.get('windowState.x', undefined),
  y: store.get('windowState.y', undefined),
  isMaximized: store.get('windowState.isMaximized', false),
  isAlwaysOnTop: store.get('windowState.isAlwaysOnTop', false)
};

function createWindow() {
  // Create the browser window with transparent support
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    transparent: true,
    frame: false,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    alwaysOnTop: windowState.isAlwaysOnTop,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    icon: path.join(__dirname, '../public/icon.png'),
    show: false,
    titleBarStyle: 'hidden',
    vibrancy: 'under-window', // macOS only
    visualEffectState: 'active', // macOS only
    titleBarOverlay: false
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://127.0.0.1:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Restore maximized state if it was maximized
    if (windowState.isMaximized) {
      mainWindow.maximize();
    }
  });

  // Handle window state changes
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      windowState.width = bounds.width;
      windowState.height = bounds.height;
      store.set('windowState.width', bounds.width);
      store.set('windowState.height', bounds.height);
    }
  });

  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized()) {
      const bounds = mainWindow.getBounds();
      windowState.x = bounds.x;
      windowState.y = bounds.y;
      store.set('windowState.x', bounds.x);
      store.set('windowState.y', bounds.y);
    }
  });

  mainWindow.on('maximize', () => {
    windowState.isMaximized = true;
    store.set('windowState.isMaximized', true);
  });

  mainWindow.on('unmaximize', () => {
    windowState.isMaximized = false;
    store.set('windowState.isMaximized', false);
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: Prevent new window creation
  mainWindow.webContents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Vorbis Player',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Toggle Always on Top',
      type: 'checkbox',
      checked: windowState.isAlwaysOnTop,
      click: (menuItem) => {
        toggleAlwaysOnTop(menuItem.checked);
      }
    },
    { type: 'separator' },
    {
      label: 'Play/Pause',
      accelerator: 'MediaPlayPause',
      click: () => {
        mainWindow.webContents.send('global-shortcut', 'play-pause');
      }
    },
    {
      label: 'Next Track',
      accelerator: 'MediaNextTrack',
      click: () => {
        mainWindow.webContents.send('global-shortcut', 'next-track');
      }
    },
    {
      label: 'Previous Track',
      accelerator: 'MediaPreviousTrack',
      click: () => {
        mainWindow.webContents.send('global-shortcut', 'previous-track');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Vorbis Player');
  
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function registerGlobalShortcuts() {
  // Register media key shortcuts
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow.webContents.send('global-shortcut', 'play-pause');
  });
  
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow.webContents.send('global-shortcut', 'next-track');
  });
  
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow.webContents.send('global-shortcut', 'previous-track');
  });
  
  // Register custom shortcuts
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    toggleAlwaysOnTop(!windowState.isAlwaysOnTop);
  });
}

function toggleAlwaysOnTop(alwaysOnTop) {
  windowState.isAlwaysOnTop = alwaysOnTop;
  store.set('windowState.isAlwaysOnTop', alwaysOnTop);
  mainWindow.setAlwaysOnTop(alwaysOnTop);
  
  // Update tray menu
  if (tray) {
    const contextMenu = tray.getContextMenu();
    const alwaysOnTopItem = contextMenu.getMenuItemById('always-on-top');
    if (alwaysOnTopItem) {
      alwaysOnTopItem.checked = alwaysOnTop;
    }
  }
}

// IPC handlers
ipcMain.handle('window-controls', async (event, action) => {
  switch (action) {
    case 'minimize':
      mainWindow.minimize();
      break;
    case 'maximize':
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;
    case 'close':
      mainWindow.hide();
      break;
    case 'toggle-always-on-top':
      toggleAlwaysOnTop(!windowState.isAlwaysOnTop);
      break;
  }
});

ipcMain.handle('get-window-state', async () => {
  return {
    isMaximized: mainWindow.isMaximized(),
    isAlwaysOnTop: windowState.isAlwaysOnTop
  };
});

ipcMain.handle('show-notification', async (event, { title, body, icon }) => {
  // This will be implemented with proper notification service
  console.log('Notification:', { title, body, icon });
});

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createTray();
  registerGlobalShortcuts();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
  isQuitting = true;
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.origin !== 'http://127.0.0.1:3000' && parsedUrl.origin !== 'file://') {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });
});