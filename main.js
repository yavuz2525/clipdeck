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
  safeStorage,
  Tray,
} = require('electron');
const { autoUpdater } = require('electron-updater');
const { DEFAULT_SHORTCUT, HistoryStore } = require('./src/history-store');
const { SnippetStore, renderTemplate } = require('./src/snippet-store');
const { generatePassword } = require('./src/password-generator');
const { VaultStore } = require('./src/vault-store');

const TRAY_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA9klEQVR4nGNgGOmAEZ+kfH7of2pZ9HDiaqx2YRWkpsWEHMJET8uxmc+ITxIXuBT5Eqec3nJxohwCCwmMEKDEcmLk0QHcAbQOenQAs4+FGMUPJqyCsz+dtCdJvUJBGF61BKMA2TByACH9JKcBagOSHcBnfpAieXRAVBqg1BJ8YMCjgKQQIJSiyUmwRIcAIcuJVUO2A4jxHTkhQFIUUFomUOwAYoOYFIdSNQ2Qo5aqaYActcMjDVDiMKqkAXLyP8kOwOdLSkIA3ibE1yKixAJ8ofNw4mpGshql1ABkN0qpDVAcgKv3Qm2AbA9GCNDaEejmD3jfcMABANvWX/lLOs+WAAAAAElFTkSuQmCC';
const WINDOWS_HIDDEN_START_ARG = '--hidden-start';
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let mainWindow = null;
let quickWindow = null;
let tray = null;
let store = null;
let snippetStore = null;
let vaultStore = null;
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

function copyWithoutHistory(text) {
  if (typeof text !== 'string') return { ok: false };
  clipboard.writeText(text);
  lastObservedText = text;
  return { ok: true };
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
    width: 560,
    height: 760,
    minWidth: 420,
    minHeight: 560,
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

async function safeStorageAvailable() {
  if (typeof safeStorage.isAsyncEncryptionAvailable === 'function') {
    return safeStorage.isAsyncEncryptionAvailable();
  }
  return safeStorage.isEncryptionAvailable();
}

async function encryptSecret(plainText) {
  if (!(await safeStorageAvailable())) throw new Error('Secure OS storage is unavailable.');
  if (typeof safeStorage.encryptStringAsync === 'function') {
    return safeStorage.encryptStringAsync(plainText);
  }
  return safeStorage.encryptString(plainText);
}

async function decryptSecret(buffer) {
  if (!(await safeStorageAvailable())) throw new Error('Secure OS storage is unavailable.');
  if (typeof safeStorage.decryptStringAsync === 'function') {
    const response = await safeStorage.decryptStringAsync(buffer);
    return response.result;
  }
  return safeStorage.decryptString(buffer);
}

async function getVaultStatus() {
  const available = await safeStorageAvailable().catch(() => false);
  let backend = 'OS protected storage';
  let secure = available;

  if (process.platform === 'win32') backend = 'Windows DPAPI';
  if (process.platform === 'darwin') backend = 'macOS Keychain';
  if (process.platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function') {
    backend = safeStorage.getSelectedStorageBackend();
    if (backend === 'basic_text') secure = false;
  }

  return { available, secure, backend };
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
    setUpdateState({ status: 'downloading', availableVersion: info.version, progress: 0, error: null });
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateState({ status: 'up-to-date', availableVersion: null, progress: null, error: null });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateState({
      status: 'downloading',
      progress: Math.max(0, Math.min(100, Math.round(progress.percent || 0))),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateState({ status: 'ready', availableVersion: info.version, progress: 100, error: null });

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
    setUpdateState({ status: 'error', error: error.message || 'Güncelleme işlemi başarısız.' });
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

  ipcMain.handle('history:pin', (_event, id) => {
    const item = store.togglePin(id);
    broadcastState();
    return { ok: Boolean(item), item };
  });

  ipcMain.handle('history:remove', (_event, id) => {
    const removed = store.remove(id);
    broadcastState();
    return { ok: removed };
  });

  ipcMain.handle('history:clear', () => {
    store.clear({ keepFavorites: true, keepPinned: true });
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

  ipcMain.handle('settings:theme', (_event, theme) => {
    const value = store.setTheme(theme);
    broadcastState();
    return { ok: true, theme: value };
  });

  ipcMain.handle('settings:shortcut', (_event, shortcut) => registerQuickShortcut(shortcut, { persist: true }));

  ipcMain.handle('snippets:list', () => snippetStore.list());
  ipcMain.handle('snippets:save', (_event, input) => {
    const item = snippetStore.save(input);
    return item ? { ok: true, item } : { ok: false, error: 'Name and template are required.' };
  });
  ipcMain.handle('snippets:remove', (_event, id) => ({ ok: snippetStore.remove(id) }));
  ipcMain.handle('snippets:copy', (_event, id, values) => {
    const item = snippetStore.get(id);
    if (!item) return { ok: false, error: 'Snippet not found.' };
    const text = renderTemplate(item.template, values || {});
    return { ...copyWithoutHistory(text), text };
  });

  ipcMain.handle('password:generate', (_event, options) => ({
    ok: true,
    password: generatePassword(options || {}),
  }));

  ipcMain.handle('vault:status', () => getVaultStatus());
  ipcMain.handle('vault:list', async () => {
    try {
      const status = await getVaultStatus();
      if (!status.available) return { ok: false, items: [], status, error: 'Secure OS storage is unavailable.' };
      return { ok: true, items: await vaultStore.list(), status };
    } catch (error) {
      return { ok: false, items: [], error: error.message || 'Vault could not be opened.' };
    }
  });
  ipcMain.handle('vault:save', async (_event, input) => {
    try {
      const status = await getVaultStatus();
      if (!status.available) return { ok: false, error: 'Secure OS storage is unavailable.' };
      const item = await vaultStore.save(input);
      return item ? { ok: true, item } : { ok: false, error: 'Title and password are required.' };
    } catch (error) {
      return { ok: false, error: error.message || 'Password could not be stored.' };
    }
  });
  ipcMain.handle('vault:remove', (_event, id) => ({ ok: vaultStore.remove(id) }));
  ipcMain.handle('vault:copy', (_event, text) => copyWithoutHistory(String(text || '')));

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
    const userDataPath = app.getPath('userData');
    store = new HistoryStore(path.join(userDataPath, 'clipdeck.json'));
    snippetStore = new SnippetStore(path.join(userDataPath, 'clipdeck-snippets.json'));
    vaultStore = new VaultStore(path.join(userDataPath, 'clipdeck-vault.json'), {
      encrypt: encryptSecret,
      decrypt: decryptSecret,
    });
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
