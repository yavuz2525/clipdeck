const path = require('node:path');
const {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
} = require('electron');
const { HistoryStore } = require('./src/history-store');

const TRAY_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA9klEQVR4nGNgGOmAEZ+kfH7of2pZ9HDiaqx2YRWkpsWEHMJET8uxmc+ITxIXuBT5Eqec3nJxohwCCwmMEKDEcmLk0QHcAbQOenQAs4+FGMUPJqyCsz+dtCdJvUJBGF61BKMA2TByACH9JKcBagOSHcBnfpAieXRAVBqg1BJ8YMCjgKQQIJSiyUmwRIcAIcuJVUO2A4jxHTkhQFIUUFomUOwAYoOYFIdSNQ2Qo5aqaYActcMjDVDiMKqkAXLyP8kOwOdLSkIA3ibE1yKixAJ8ofNw4mpGshql1ABkN0qpDVAcgKv3Qm2AbA9GCNDaEejmD3jfcMABANvWX/lLOs+WAAAAAElFTkSuQmCC';
const WINDOWS_HIDDEN_START_ARG = '--hidden-start';

let mainWindow = null;
let quickWindow = null;
let tray = null;
let store = null;
let monitorTimer = null;
let lastObservedText = '';
let isQuitting = false;

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function getState() {
  return store.snapshot();
}

function sendState(window) {
  if (window && !window.isDestroyed()) {
    window.webContents.send('history:changed', getState());
  }
}

function broadcastState() {
  sendState(mainWindow);
  sendState(quickWindow);
}

function pollClipboard() {
  if (!store || store.state.settings.paused) return;

  try {
    const text = clipboard.readText();
    if (!text || !text.trim() || text === lastObservedText) return;

    lastObservedText = text;
    store.add(text);
    broadcastState();
  } catch (error) {
    console.error('Clipboard read failed:', error);
  }
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow({ showOnReady: true });
    return;
  }

  if (process.platform === 'darwin' && app.dock) app.dock.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.setSkipTaskbar(false);
  mainWindow.show();
  mainWindow.focus();
}

function revealQuickWindow() {
  if (!quickWindow || quickWindow.isDestroyed()) return;
  quickWindow.center();
  quickWindow.show();
  quickWindow.focus();
}

function showQuickPanel() {
  if (!quickWindow || quickWindow.isDestroyed()) {
    createQuickWindow();
    quickWindow.once('ready-to-show', revealQuickWindow);
    return;
  }

  revealQuickWindow();
}

function refreshTrayMenu() {
  if (!tray || tray.isDestroyed()) return;

  const paused = Boolean(store?.state.settings.paused);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Hızlı Panel',
      accelerator: 'CommandOrControl+Shift+V',
      click: showQuickPanel,
    },
    {
      label: 'ClipDeck’i Aç',
      click: showWindow,
    },
    {
      label: paused ? 'Pano Takibini Sürdür' : 'Pano Takibini Duraklat',
      click: () => {
        if (!store) return;

        const value = store.setPaused(!paused);
        if (!value) lastObservedText = clipboard.readText();
        broadcastState();
        refreshTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray() {
  if (tray && !tray.isDestroyed()) return;

  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL).resize({
    width: 16,
    height: 16,
  });

  tray = new Tray(icon);
  tray.setToolTip('ClipDeck — pano geçmişi arka planda çalışıyor');
  refreshTrayMenu();
  tray.on('click', showWindow);
}

function secureWindowOptions() {
  return {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
}

function protectWebContents(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
}

function createWindow({ showOnReady = true } = {}) {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 720,
    minWidth: 360,
    minHeight: 520,
    title: 'ClipDeck',
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    show: false,
    skipTaskbar: !showOnReady,
    webPreferences: secureWindowOptions(),
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (showOnReady) mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return;

    event.preventDefault();
    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();

    if (process.platform === 'darwin' && app.dock) app.dock.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  protectWebContents(mainWindow);
}

function createQuickWindow() {
  quickWindow = new BrowserWindow({
    width: 620,
    height: 460,
    minWidth: 520,
    minHeight: 360,
    maxWidth: 760,
    maxHeight: 620,
    title: 'ClipDeck Quick Panel',
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#0f1115',
    webPreferences: secureWindowOptions(),
  });

  quickWindow.loadFile(path.join(__dirname, 'src', 'quick', 'index.html'));

  quickWindow.on('blur', () => {
    if (!isQuitting && quickWindow && !quickWindow.isDestroyed()) quickWindow.hide();
  });

  quickWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    quickWindow.hide();
  });

  quickWindow.on('closed', () => {
    quickWindow = null;
  });

  protectWebContents(quickWindow);
}

function configureWindowsStartup() {
  if (process.platform !== 'win32' || !app.isPackaged) return;

  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      enabled: true,
      name: 'ClipDeck',
      path: process.execPath,
      args: [WINDOWS_HIDDEN_START_ARG],
    });
  } catch (error) {
    console.error('Windows startup registration failed:', error);
  }
}

function registerIpc() {
  ipcMain.handle('history:get', () => getState());

  ipcMain.handle('history:copy', (_event, id) => {
    const item = store.state.items.find((entry) => entry.id === id);
    if (!item) return { ok: false };

    clipboard.writeText(item.text);
    lastObservedText = item.text;
    store.touch(id);
    broadcastState();
    return { ok: true };
  });

  ipcMain.handle('history:favorite', (_event, id) => {
    const item = store.toggleFavorite(id);
    broadcastState();
    return { ok: Boolean(item) };
  });

  ipcMain.handle('history:remove', (_event, id) => {
    const removed = store.remove(id);
    broadcastState();
    return { ok: removed };
  });

  ipcMain.handle('history:clear', () => {
    store.clear({ keepFavorites: true });
    broadcastState();
    return { ok: true };
  });

  ipcMain.handle('settings:paused', (_event, paused) => {
    const value = store.setPaused(paused);
    if (!value) lastObservedText = clipboard.readText();
    broadcastState();
    refreshTrayMenu();
    return { ok: true, paused: value };
  });

  ipcMain.handle('settings:limit', (_event, limit) => {
    const value = store.setLimit(limit);
    broadcastState();
    return { ok: true, limit: value };
  });
}

if (hasSingleInstanceLock) {
  app.on('second-instance', (_event, argv) => {
    const isBackgroundStartup = argv.includes(WINDOWS_HIDDEN_START_ARG);
    if (!isBackgroundStartup) showWindow();
  });

  app.whenReady().then(() => {
    store = new HistoryStore(path.join(app.getPath('userData'), 'clipdeck.json'));
    lastObservedText = clipboard.readText();

    configureWindowsStartup();
    registerIpc();

    const isBackgroundStartup =
      process.platform === 'win32' && process.argv.includes(WINDOWS_HIDDEN_START_ARG);

    createWindow({ showOnReady: !isBackgroundStartup });
    createQuickWindow();
    createTray();

    const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+V', showQuickPanel);
    if (!shortcutRegistered) {
      console.warn('Global shortcut Ctrl/Cmd+Shift+V could not be registered.');
    }

    monitorTimer = setInterval(pollClipboard, 700);

    app.on('activate', showWindow);
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  if (monitorTimer) clearInterval(monitorTimer);
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // ClipDeck intentionally keeps running in the background.
  // Use the tray menu's “Çıkış” item to quit the application completely.
});
