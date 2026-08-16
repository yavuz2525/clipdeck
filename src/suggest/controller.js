const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow, screen } = require('electron');

const MAX_TOKEN_LENGTH = 64;
const MAX_SUGGESTIONS = 3;

function normalizeToken(value) {
  return String(value || '').trim().toLocaleLowerCase().slice(-MAX_TOKEN_LENGTH);
}

function createKeyMap(UiohookKey) {
  const map = new Map();
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') map.set(UiohookKey[letter], letter.toLowerCase());
  for (const digit of '0123456789') map.set(UiohookKey[digit], digit);
  map.set(UiohookKey.Minus, '-');
  map.set(UiohookKey.Period, '.');
  return map;
}

class SnippetSuggestionController {
  constructor({ snippetFilePath, iconPath }) {
    this.snippetFilePath = snippetFilePath;
    this.iconPath = iconPath;
    this.window = null;
    this.hook = null;
    this.UiohookKey = null;
    this.keyMap = null;
    this.token = '';
    this.cache = [];
    this.cacheMtime = -1;
    this.started = false;
    this.enabled = true;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
  }

  start() {
    if (process.platform !== 'win32' || this.started) return false;
    try {
      const { uIOhook, UiohookKey } = require('uiohook-napi');
      this.hook = uIOhook;
      this.UiohookKey = UiohookKey;
      this.keyMap = createKeyMap(UiohookKey);
      this.hook.on('keydown', this.onKeyDown);
      this.hook.on('mousedown', this.onMouseDown);
      this.hook.start();
      this.started = true;
      return true;
    } catch (error) {
      console.error('Snippet suggestion hook could not start:', error);
      return false;
    }
  }

  stop() {
    if (!this.started || !this.hook) return;
    try {
      this.hook.off('keydown', this.onKeyDown);
      this.hook.off('mousedown', this.onMouseDown);
      this.hook.stop();
    } catch (error) {
      console.error('Snippet suggestion hook could not stop cleanly:', error);
    }
    this.started = false;
    this.hide();
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    if (!this.enabled) this.clear();
  }

  onMouseDown() {
    this.clear();
  }

  onKeyDown(event) {
    if (!this.enabled || !this.UiohookKey) return;

    if (event.ctrlKey || event.altKey || event.metaKey) {
      this.clear();
      return;
    }

    const key = event.keycode;
    if (key === this.UiohookKey.Backspace) {
      this.token = this.token.slice(0, -1);
      this.update();
      return;
    }

    if (
      key === this.UiohookKey.Space ||
      key === this.UiohookKey.Tab ||
      key === this.UiohookKey.Enter ||
      key === this.UiohookKey.Escape ||
      key === this.UiohookKey.Delete ||
      key === this.UiohookKey.ArrowLeft ||
      key === this.UiohookKey.ArrowRight ||
      key === this.UiohookKey.ArrowUp ||
      key === this.UiohookKey.ArrowDown ||
      key === this.UiohookKey.Home ||
      key === this.UiohookKey.End
    ) {
      this.clear();
      return;
    }

    const char = this.keyMap.get(key);
    if (!char) {
      this.clear();
      return;
    }

    this.token = normalizeToken(`${this.token}${char}`);
    this.update();
  }

  readSnippets() {
    try {
      const stat = fs.statSync(this.snippetFilePath);
      if (stat.mtimeMs === this.cacheMtime) return this.cache;
      const parsed = JSON.parse(fs.readFileSync(this.snippetFilePath, 'utf8'));
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      this.cache = items
        .filter((item) => item && typeof item.trigger === 'string' && item.trigger.trim())
        .map((item) => ({
          id: item.id,
          name: String(item.name || item.trigger),
          trigger: String(item.trigger).toLocaleLowerCase(),
          template: String(item.template || ''),
          hasVariables: /{{\s*[a-zA-Z0-9_.-]+\s*}}/.test(String(item.template || '')),
        }));
      this.cacheMtime = stat.mtimeMs;
      return this.cache;
    } catch {
      this.cache = [];
      this.cacheMtime = -1;
      return this.cache;
    }
  }

  matchingSnippets() {
    if (this.token.length < 2) return [];
    const exact = [];
    const prefix = [];
    for (const item of this.readSnippets()) {
      if (item.trigger === this.token) exact.push(item);
      else if (item.trigger.startsWith(this.token)) prefix.push(item);
    }
    return [...exact, ...prefix].slice(0, MAX_SUGGESTIONS);
  }

  ensureWindow() {
    if (this.window && !this.window.isDestroyed()) return this.window;
    this.window = new BrowserWindow({
      width: 390,
      height: 150,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      hasShadow: true,
      icon: this.iconPath,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.window.setAlwaysOnTop(true, 'pop-up-menu');
    this.window.loadFile(path.join(__dirname, 'index.html'));
    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.window.webContents.on('will-navigate', (event) => event.preventDefault());
    this.window.on('closed', () => { this.window = null; });
    return this.window;
  }

  positionWindow() {
    const win = this.ensureWindow();
    const point = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    const bounds = display.workArea;
    const size = win.getSize();
    const x = Math.min(Math.max(bounds.x + 12, point.x + 18), bounds.x + bounds.width - size[0] - 12);
    const y = Math.min(Math.max(bounds.y + 12, point.y + 22), bounds.y + bounds.height - size[1] - 12);
    win.setPosition(Math.round(x), Math.round(y), false);
  }

  update() {
    const matches = this.matchingSnippets();
    if (!matches.length) {
      this.hide();
      return;
    }
    const win = this.ensureWindow();
    this.positionWindow();
    win.webContents.send('suggestions:update', {
      token: this.token,
      items: matches.map((item) => ({
        name: item.name,
        trigger: item.trigger,
        preview: item.template.length > 90 ? `${item.template.slice(0, 87)}…` : item.template,
        hasVariables: item.hasVariables,
      })),
    });
    win.showInactive();
  }

  hide() {
    if (this.window && !this.window.isDestroyed()) this.window.hide();
  }

  clear() {
    this.token = '';
    this.hide();
  }
}

module.exports = {
  SnippetSuggestionController,
  createKeyMap,
  normalizeToken,
};
