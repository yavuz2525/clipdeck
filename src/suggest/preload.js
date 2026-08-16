const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clipdeckSuggestions', {
  onUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('suggestions:update', listener);
    return () => ipcRenderer.removeListener('suggestions:update', listener);
  },
});
