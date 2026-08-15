const { contextBridge, ipcRenderer } = require('electron');

const DEFAULT_EXPAND_SHORTCUT = 'CommandOrControl+Alt+E';

function prettyShortcut(shortcut) {
  if (!shortcut) return 'Not set';
  return shortcut
    .replaceAll('CommandOrControl', 'Ctrl/⌘')
    .replaceAll('Control', 'Ctrl')
    .replaceAll('Command', '⌘')
    .replaceAll('+', ' + ');
}

function shortcutFromKeyboardEvent(event) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null;
  const parts = [];
  if (event.ctrlKey) parts.push('CommandOrControl');
  if (event.metaKey) parts.push('Command');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  const keyMap = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Esc',
  };
  let key = keyMap[event.key] || event.key;
  if (/^[a-z0-9]$/i.test(key)) key = key.toUpperCase();
  const isFunctionKey = /^F(?:[1-9]|1\d|2[0-4])$/.test(key);
  if (parts.length === 0 && !isFunctionKey) return null;
  parts.push(key);
  return parts.join('+');
}

function installExpandShortcutSettings() {
  let currentShortcut = DEFAULT_EXPAND_SHORTCUT;
  let capturing = false;

  const settingsCard = [...document.querySelectorAll('.setting-card')]
    .find((card) => card.querySelector('h3')?.textContent?.trim() === 'Snippet expansion');
  const footerSpan = [...document.querySelectorAll('.footer span')]
    .find((span) => span.textContent?.trim().startsWith('Expand snippet:'));

  if (!settingsCard) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'shortcut-capture';
  button.textContent = prettyShortcut(currentShortcut);
  button.setAttribute('aria-label', 'Change snippet expansion shortcut');

  const error = document.createElement('div');
  error.className = 'setting-error hidden';
  error.setAttribute('role', 'alert');
  settingsCard.append(button, error);

  function render(shortcut) {
    currentShortcut = shortcut || DEFAULT_EXPAND_SHORTCUT;
    if (!capturing) button.textContent = prettyShortcut(currentShortcut);
    const kbd = footerSpan?.querySelector('kbd');
    if (kbd) kbd.textContent = prettyShortcut(currentShortcut);
  }

  ipcRenderer.invoke('history:get').then((state) => {
    render(state?.settings?.expandShortcut);
  }).catch(() => {});

  ipcRenderer.on('history:changed', (_event, state) => {
    render(state?.settings?.expandShortcut);
  });

  button.addEventListener('click', () => {
    capturing = true;
    button.classList.add('recording');
    button.textContent = 'Press a shortcut…';
    error.classList.add('hidden');
    button.focus();
  });

  document.addEventListener('keydown', async (event) => {
    if (!capturing) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.key === 'Escape') {
      capturing = false;
      button.classList.remove('recording');
      button.textContent = prettyShortcut(currentShortcut);
      return;
    }

    const shortcut = shortcutFromKeyboardEvent(event);
    if (!shortcut) {
      button.textContent = 'Use Ctrl/Alt/⌘ + a key';
      return;
    }

    capturing = false;
    button.classList.remove('recording');
    button.textContent = prettyShortcut(shortcut);

    const result = await ipcRenderer.invoke('settings:expandShortcut', shortcut);
    if (!result.ok) {
      render(result.shortcut || currentShortcut);
      error.textContent = result.error || 'That shortcut could not be registered.';
      error.classList.remove('hidden');
      return;
    }

    error.classList.add('hidden');
    render(result.shortcut);
  }, true);
}

window.addEventListener('DOMContentLoaded', installExpandShortcutSettings, { once: true });

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
