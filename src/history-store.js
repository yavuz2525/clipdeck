const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+V';
const THEMES = new Set(['system', 'dark', 'light']);

const DEFAULT_SETTINGS = Object.freeze({
  limit: 100,
  paused: false,
  shortcut: DEFAULT_SHORTCUT,
  theme: 'system',
});

function clampLimit(value) {
  const numeric = Number(value);
  if (![25, 50, 100, 250].includes(numeric)) return 100;
  return numeric;
}

function clampTheme(value) {
  return THEMES.has(value) ? value : 'system';
}

function looksLikeJson(value) {
  if (!/^[\[{]/.test(value)) return false;

  try {
    const parsed = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object';
  } catch {
    return false;
  }
}

function looksLikeIp(value) {
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return false;
  return value.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255);
}

function looksLikePhone(value) {
  if (!/^[+()\d\s.-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function detectTag(text) {
  if (typeof text !== 'string' || !text.trim()) return 'Text';
  const value = text.trim();

  if (/^https?:\/\/\S+$/i.test(value)) return 'URL';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email';
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return 'Color';
  if (looksLikeIp(value)) return 'IP';
  if (/^[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\?)+$/.test(value) || /^\/(?:[^/\0]+\/?)+$/.test(value)) {
    return 'Path';
  }
  if (looksLikeJson(value)) return 'JSON';
  if (/^(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|GRANT|REVOKE)\b/i.test(value)) {
    return 'SQL';
  }
  if (/^(?:\$ ?)?(?:npm|npx|pnpm|yarn|git|docker|kubectl|curl|wget|ssh|scp|powershell|pwsh|cmd|node|python|python3|pip|pip3|cargo|go)\b/i.test(value)) {
    return 'Command';
  }
  if (looksLikePhone(value)) return 'Phone';
  if (
    /```[\s\S]*```/.test(value) ||
    /(?:^|\n)\s*(?:const|let|var|function|class|interface|type|enum|import|export|def|async\s+def|from)\b/m.test(value) ||
    /=>\s*[{(]?/.test(value) ||
    /<\/?[a-z][^>]*>/i.test(value)
  ) {
    return 'Code';
  }

  return 'Text';
}

class HistoryStore {
  constructor(filePath = null) {
    this.filePath = filePath;
    this.state = {
      items: [],
      settings: { ...DEFAULT_SETTINGS },
    };
    this.load();
  }

  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      const settings = parsed.settings && typeof parsed.settings === 'object'
        ? parsed.settings
        : {};

      this.state = {
        items: items
          .filter((item) => item && typeof item.text === 'string' && item.text.trim())
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
            text: item.text,
            tag: detectTag(item.text),
            createdAt: Number(item.createdAt) || Date.now(),
            lastCopiedAt: Number(item.lastCopiedAt) || Number(item.createdAt) || Date.now(),
            favorite: Boolean(item.favorite),
            pinned: Boolean(item.pinned),
          })),
        settings: {
          limit: clampLimit(settings.limit),
          paused: Boolean(settings.paused),
          shortcut: typeof settings.shortcut === 'string' && settings.shortcut.trim()
            ? settings.shortcut.trim()
            : DEFAULT_SHORTCUT,
          theme: clampTheme(settings.theme),
        },
      };
      this.enforceLimit();
    } catch {
      this.state = {
        items: [],
        settings: { ...DEFAULT_SETTINGS },
      };
    }
  }

  persist() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  snapshot() {
    return {
      items: this.state.items.map((item) => ({ ...item })),
      settings: { ...this.state.settings },
    };
  }

  add(text, now = Date.now()) {
    if (typeof text !== 'string' || !text.trim()) return null;

    const existingIndex = this.state.items.findIndex((item) => item.text === text);
    let item;

    if (existingIndex >= 0) {
      item = this.state.items.splice(existingIndex, 1)[0];
      item.createdAt = now;
      item.lastCopiedAt = now;
      item.tag = detectTag(text);
    } else {
      item = {
        id: crypto.randomUUID(),
        text,
        tag: detectTag(text),
        createdAt: now,
        lastCopiedAt: now,
        favorite: false,
        pinned: false,
      };
    }

    this.state.items.unshift(item);
    this.enforceLimit();
    this.persist();
    return { ...item };
  }

  touch(id, now = Date.now()) {
    const index = this.state.items.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const item = this.state.items.splice(index, 1)[0];
    item.lastCopiedAt = now;
    this.state.items.unshift(item);
    this.persist();
    return { ...item };
  }

  toggleFavorite(id) {
    const item = this.state.items.find((entry) => entry.id === id);
    if (!item) return null;
    item.favorite = !item.favorite;
    this.persist();
    return { ...item };
  }

  togglePin(id) {
    const item = this.state.items.find((entry) => entry.id === id);
    if (!item) return null;
    item.pinned = !item.pinned;
    this.persist();
    return { ...item };
  }

  remove(id) {
    const before = this.state.items.length;
    this.state.items = this.state.items.filter((item) => item.id !== id);
    const changed = this.state.items.length !== before;
    if (changed) this.persist();
    return changed;
  }

  clear({ keepFavorites = true, keepPinned = true } = {}) {
    this.state.items = this.state.items.filter((item) => (
      (keepFavorites && item.favorite) || (keepPinned && item.pinned)
    ));
    this.persist();
  }

  setPaused(paused) {
    this.state.settings.paused = Boolean(paused);
    this.persist();
    return this.state.settings.paused;
  }

  setLimit(limit) {
    this.state.settings.limit = clampLimit(limit);
    this.enforceLimit();
    this.persist();
    return this.state.settings.limit;
  }

  setShortcut(shortcut) {
    if (typeof shortcut !== 'string' || !shortcut.trim()) return this.state.settings.shortcut;
    this.state.settings.shortcut = shortcut.trim();
    this.persist();
    return this.state.settings.shortcut;
  }

  setTheme(theme) {
    this.state.settings.theme = clampTheme(theme);
    this.persist();
    return this.state.settings.theme;
  }

  enforceLimit() {
    const limit = this.state.settings.limit;
    if (this.state.items.length <= limit) return;

    const pinned = this.state.items.filter((item) => item.pinned);
    const favorites = this.state.items.filter((item) => !item.pinned && item.favorite);
    const others = this.state.items.filter((item) => !item.pinned && !item.favorite);
    this.state.items = [...pinned, ...favorites, ...others]
      .slice(0, limit)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

module.exports = {
  DEFAULT_SHORTCUT,
  HistoryStore,
  clampLimit,
  clampTheme,
  detectTag,
};
