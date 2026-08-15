const path = require('node:path');
const {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
} = require('electron');
const { HistoryStore } = require('./src/history-store');

let mainWindow = null;
let store = null;
let monitorTimer = null;
let lastObservedText = '';

function getState() {
  return store.snapshot();
}

function broadcastState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('history:changed', getState());
  }
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 720,
    minWidth: 360,
    minHeight: 520,
    title: 'ClipDeck',
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
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
    return { ok: true, paused: value };
  });

  ipcMain.handle('settings:limit', (_event, limit) => {
    const value = store.setLimit(limit);
    broadcastState();
    return { ok: true, limit: value };
  });
}

app.whenReady().then(() => {
  store = new HistoryStore(path.join(app.getPath('userData'), 'clipdeck.json'));
  lastObservedText = clipboard.readText();

  registerIpc();
  createWindow();

  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+V', showWindow);
  if (!shortcutRegistered) {
    console.warn('Global shortcut Ctrl/Cmd+Shift+V could not be registered.');
  }

  monitorTimer = setInterval(pollClipboard, 700);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  if (monitorTimer) clearInterval(monitorTimer);
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
