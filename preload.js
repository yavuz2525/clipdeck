const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clipdeck', {
  getState: () => ipcRenderer.invoke('history:get'),
  copy: (id) => ipcRenderer.invoke('history:copy', id),
  toggleFavorite: (id) => ipcRenderer.invoke('history:favorite', id),
  remove: (id) => ipcRenderer.invoke('history:remove', id),
  clear: () => ipcRenderer.invoke('history:clear'),
  setPaused: (paused) => ipcRenderer.invoke('settings:paused', paused),
  setLimit: (limit) => ipcRenderer.invoke('settings:limit', limit),
  setShortcut: (shortcut) => ipcRenderer.invoke('settings:shortcut', shortcut),
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
