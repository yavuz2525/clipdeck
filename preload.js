const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const media = Object.freeze({
  listImages: () => ipcRenderer.invoke('media:images:list'),
  getSettings: () => ipcRenderer.invoke('media:settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('media:settings:set', key, value),
  previewImage: (id, maxWidth) => ipcRenderer.invoke('media:image:preview', id, maxWidth),
  copyImage: (id) => ipcRenderer.invoke('media:image:copy', id),
  toggleImagePin: (id) => ipcRenderer.invoke('media:image:pin', id),
  removeImage: (id) => ipcRenderer.invoke('media:image:remove', id),
  clearImages: () => ipcRenderer.invoke('media:image:clear'),
  ocrImage: (id) => ipcRenderer.invoke('media:image:ocr', id),
  scanImageQr: (id) => ipcRenderer.invoke('media:qr:scanImage', id),
  scanClipboardQr: () => ipcRenderer.invoke('media:qr:scanClipboard'),
  generateQr: (text) => ipcRenderer.invoke('media:qr:generate', text),
  copyQrImage: (text) => ipcRenderer.invoke('media:qr:copyImage', text),
  copyText: (text) => ipcRenderer.invoke('media:text:copy', text),
  onImagesChanged: (callback) => subscribe('media:imagesChanged', callback),
  onSettingsChanged: (callback) => subscribe('media:settingsChanged', callback),
  onOcrProgress: (callback) => subscribe('media:ocrProgress', callback),
});

contextBridge.exposeInMainWorld('clipdeck', {
  getState: () => ipcRenderer.invoke('history:get'),
  copy: (id) => ipcRenderer.invoke('history:copy', id),
  toggleFavorite: (id) => ipcRenderer.invoke('history:favorite', id),
  togglePin: (id) => ipcRenderer.invoke('history:pin', id),
  remove: (id) => ipcRenderer.invoke('history:remove', id),
  clear: () => ipcRenderer.invoke('history:clear'),
  setPaused: (paused) => ipcRenderer.invoke('settings:paused', paused),
  setLimit: (limit) => ipcRenderer.invoke('settings:limit', limit),
  setTheme: (theme) => ipcRenderer.invoke('settings:theme', theme),
  setShortcut: (shortcut) => ipcRenderer.invoke('settings:shortcut', shortcut),
  setExpandShortcut: (shortcut) => ipcRenderer.invoke('settings:expandShortcut', shortcut),
  listSnippets: () => ipcRenderer.invoke('snippets:list'),
  saveSnippet: (input) => ipcRenderer.invoke('snippets:save', input),
  removeSnippet: (id) => ipcRenderer.invoke('snippets:remove', id),
  copySnippet: (id, values) => ipcRenderer.invoke('snippets:copy', id, values),
  generatePassword: (options) => ipcRenderer.invoke('password:generate', options),
  getVaultStatus: () => ipcRenderer.invoke('vault:status'),
  listVault: () => ipcRenderer.invoke('vault:list'),
  saveVaultEntry: (input) => ipcRenderer.invoke('vault:save', input),
  removeVaultEntry: (id) => ipcRenderer.invoke('vault:remove', id),
  copySensitive: (text) => ipcRenderer.invoke('vault:copy', text),
  getUpdateState: () => ipcRenderer.invoke('updates:get'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onChanged: (callback) => subscribe('history:changed', callback),
  onUpdateChanged: (callback) => subscribe('updates:changed', callback),
  media,
});
