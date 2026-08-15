const { contextBridge, ipcRenderer } = require('electron');

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
  onChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('history:changed', listener);
    return () => ipcRenderer.removeListener('history:changed', listener);
  },
  onUpdateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('updates:changed', listener);
    return () => ipcRenderer.removeListener('updates:changed', listener);
  },
});
