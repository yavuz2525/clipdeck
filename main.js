const path = require('node:path');
const {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  Tray,
} = require('electron');
const { autoUpdater } = require('electron-updater');
const { DEFAULT_SHORTCUT, HistoryStore } = require('./src/history-store');

const TRAY_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA9klEQVR4nGNgGOmAEZ+kfH7of2pZ9HDiaqx2YRWkpsWEHMJET8uxmc+ITxIXuBT5Eqec3nJxohwCCwmMEKDEcmLk0QHcAbQOenQAs4+FGMUPJqyCsz+dtCdJvUJBGF61BKMA2TByACH9JKcBagOSHcBnfpAieXRAVBqg1BJ8YMCjgKQQIJSiyUmwRIcAIcuJVUO2A4jxHTkhQFIUUFomUOwAYoOYFIdSNQ2Qo5aqaYActcMjDVDiMKqkAXLyP8kOwOdLSkIA3ibE1yKixAJ8ofNw4mpGshql1ABkN0qpDVAcgKv3Qm2AbA9GCNDaEejmD3jfcMABANvWX/lLOs+WAAAAAElFTkSuQmCC';
const WINDOWS_HIDDEN_START_ARG = '--hidden-start';
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let mainWindow = null;
let quickWindow = null;
let tray = null;
let store = null;
let monitorTimer = null;
let updateTimer = null;
let lastObservedText = '';
let registeredShortcut = null;
let isQuitting = false;
let updateState = {
  supported: false,
  status: 'disabled',
  currentVersion: null,
  availableVersion: null,
  progress: null,
  error: null,
};

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function getState() {
  return store.snapshot();
}

function getUpdateState() {
  return { ...updateState };
}

function sendState(window) {
  if (window && !window.isDestroyed()) {
    window.webContents.send('history:changed', getState());
  }
}

function sendUpdateState(window) {
  if (window && !window.isDestroyed()) {
    window.webContents.send('updates:changed', getUpdateState());
  }
}

function broadcastState() {
  sendState(mainWindow);
  sendState(quickWindow);
}

function broadcastUpdateState() {
  sendUpdateState(mainWindow);
}

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  broadcastUpdateState();
  refreshTrayMenu();
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

function tryRegisterQuickShortcut(shortcut) {
  try {
    return globalShortcut.register(shortcut, showQuickPanel);
  } catch (error) {
    console.error(`Global shortcut registration failed for ${shortcut}:`, error);
    return false;
  }
}

function registerQuickShortcut(shortcut, { persist = false } = {}) {
  const candidate = typeof shortcut === 'string' && shortcut.trim()
    ? shortcut.trim()
    : DEFAULT_SHORTCUT;
  const previous = registeredShortcut;

  if (previous) globalShortcut.unregister(previous);

  if (tryRegisterQuickShortcut(candidate)) {
    registeredShortcut = candidate;
    if (persist) store.setShortcut(candidate);
    refreshTrayMenu();
    broadcastState();
    return { ok: true, shortcut: candidate };
  }

  if (previous && tryRegisterQuickShortcut(previous)) {
    registeredShortcut = previous;
  } else if (candidate !== DEFAULT_SHORTCUT && tryRegisterQuickShortcut(DEFAULT_SHORTCUT)) {
    registeredShortcut = DEFAULT_SHORTCUT;
    if (!previous) store.setShortcut(DEFAULT_SHORTCUT);
  } else {
    registeredShortcut = null;
  }

  refreshTrayMenu();
  broadcastState();
  return {
    ok: false,
    shortcut: registeredShortcut || store.state.settings.shortcut || DEFAULT_SHORTCUT,
    error: 'Bu kısayol başka bir uygulama tarafından kullanılıyor veya Windows tarafından desteklenmiyor.',
  };
}

function refreshTrayMenu() {
  if (!tray || tray.isDestroyed()) return;

  const paused = Boolean(store?.state.settings.paused);
  const shortcut = store?.state.settings.shortcut || DEFAULT_SHORTCUT;
  const template = [
    {
      label: `Hızlı Panel (${shortcut})`,
      click: showQuickPanel,
    },
    {
      label: 'ClipDeck’i Aç',
      click: showWindow,
    },
  ];

  if (updateState.status === 'ready') {
    template.push({
      label: `Güncellemeyi Kur (${updateState.availableVersion || 'yeni sürüm'})`,
      click: installDownloadedUpdate,
    });
  }

  template.push(
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
  );

  tray.setContextMenu(Menu.buildFromTemplate(template));
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
    sendUpdateState(mainWindow);
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

function checkForUpdates() {
  if (!updateState.supported) {
    return Promise.resolve({ ok: false, error: 'Güncellemeler yalnızca kurulu Windows sürümünde kullanılabilir.' });
  }

  setUpdateState({ status: 'checking', error: null, progress: null });
  return autoUpdater.checkForUpdates()
    .then(() => ({ ok: true }))
    .catch((error) => {
      setUpdateState({ status: 'error', error: error.message || 'Güncelleme kontrolü başarısız.' });
      return { ok: false, error: updateState.error };
    });
}

function installDownloadedUpdate() {
  if (!updateState.supported || updateState.status !== 'ready') {
    return { ok: false, error: 'Kurulmaya hazır bir güncelleme yok.' };
  }

  isQuitting = true;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return { ok: true };
}

function setupAutoUpdater() {
  updateState = {
    ...updateState,
    currentVersion: app.getVersion(),
    supported: process.platform === 'win32' && app.isPackaged,
    status: process.platform === 'win32' && app.isPackaged ? 'idle' : 'disabled',
  };
  broadcastUpdateState();

  if (!updateState.supported) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    setUpdateState({ status: 'checking', error: null, progress: null });
  });

  autoUpdater.on('update-available', (info) => {
    setUpdateState({
      status: 'downloading',
      availableVersion: info.version,
      progress: 0,
      error: null,
    });
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateState({
      status: 'up-to-date',
      availableVersion: null,
      progress: null,
      error: null,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateState({
      status: 'downloading',
      progress: Math.max(0, Math.min(100, Math.round(progress.percent || 0))),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateState({
      status: 'ready',
      availableVersion: info.version,
      progress: 100,
      error: null,
    });

    if (Notification.isSupported()) {
      const notification = new Notification({
        title: `ClipDeck ${info.version} hazır`,
        body: 'Güncelleme indirildi. Yeniden başlattığında kurulabilir.',
      });
      notification.on('click', showWindow);
      notification.show();
    }
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto update failed:', error);
    setUpdateState({
      status: 'error',
      error: error.message || 'Güncelleme işlemi başarısız.',
    });
  });

  setTimeout(checkForUpdates, 12_000);
  updateTimer = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
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

  ipcMain.handle('settings:shortcut', (_event, shortcut) => registerQuickShortcut(shortcut, { persist: true }));
  ipcMain.handle('updates:get', () => getUpdateState());
  ipcMain.handle('updates:check', () => checkForUpdates());
  ipcMain.handle('updates:install', () => installDownloadedUpdate());
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

    const shortcutResult = registerQuickShortcut(store.state.settings.shortcut);
    if (!shortcutResult.ok) {
      console.warn(`Global shortcut ${store.state.settings.shortcut} could not be registered.`);
    }

    setupAutoUpdater();
    monitorTimer = setInterval(pollClipboard, 700);

    app.on('activate', showWindow);
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  if (monitorTimer) clearInterval(monitorTimer);
  if (updateTimer) clearInterval(updateTimer);
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // ClipDeck intentionally keeps running in the background.
  // Use the tray menu's “Çıkış” item to quit the application completely.
});
