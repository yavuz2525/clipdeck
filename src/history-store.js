const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_SETTINGS = Object.freeze({
  limit: 100,
  paused: false,
});

function clampLimit(value) {
  const numeric = Number(value);
  if (![25, 50, 100, 250].includes(numeric)) return 100;
  return numeric;
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
            createdAt: Number(item.createdAt) || Date.now(),
            lastCopiedAt: Number(item.lastCopiedAt) || Number(item.createdAt) || Date.now(),
            favorite: Boolean(item.favorite),
          })),
        settings: {
          limit: clampLimit(settings.limit),
          paused: Boolean(settings.paused),
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
    } else {
      item = {
        id: crypto.randomUUID(),
        text,
        createdAt: now,
        lastCopiedAt: now,
        favorite: false,
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

  remove(id) {
    const before = this.state.items.length;
    this.state.items = this.state.items.filter((item) => item.id !== id);
    const changed = this.state.items.length !== before;
    if (changed) this.persist();
    return changed;
  }

  clear({ keepFavorites = true } = {}) {
    this.state.items = keepFavorites
      ? this.state.items.filter((item) => item.favorite)
      : [];
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

  enforceLimit() {
    const limit = this.state.settings.limit;
    if (this.state.items.length <= limit) return;

    const favorites = this.state.items.filter((item) => item.favorite);
    const others = this.state.items.filter((item) => !item.favorite);
    const remainingSlots = Math.max(0, limit - favorites.length);
    this.state.items = [...favorites, ...others.slice(0, remainingSlots)]
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

module.exports = {
  HistoryStore,
  clampLimit,
};
