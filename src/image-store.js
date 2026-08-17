const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class ImageStore {
  constructor(filePath, imageDir, { limit = 80 } = {}) {
    this.filePath = filePath;
    this.imageDir = imageDir;
    this.limit = Math.max(10, Math.min(250, Number(limit) || 80));
    this.items = [];
    this.load();
    this.cleanupOrphans();
  }

  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      this.items = items
        .filter((item) => item && typeof item.fileName === 'string' && typeof item.hash === 'string')
        .map((item) => ({
          id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
          kind: 'image',
          fileName: path.basename(item.fileName),
          hash: item.hash,
          width: Math.max(1, Number(item.width) || 1),
          height: Math.max(1, Number(item.height) || 1),
          createdAt: Number(item.createdAt) || Date.now(),
          lastCopiedAt: Number(item.lastCopiedAt) || Number(item.createdAt) || Date.now(),
          pinned: Boolean(item.pinned),
          ocrText: typeof item.ocrText === 'string' ? item.ocrText : '',
          qrText: typeof item.qrText === 'string' ? item.qrText : '',
        }))
        .filter((item) => fs.existsSync(this.pathFor(item)))
        .sort((a, b) => b.createdAt - a.createdAt);
      this.enforceLimit();
    } catch {
      this.items = [];
    }
  }

  persist() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify({ items: this.items }, null, 2), 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  pathFor(itemOrId) {
    const item = typeof itemOrId === 'string' ? this.items.find((entry) => entry.id === itemOrId) : itemOrId;
    if (!item) return null;
    return path.join(this.imageDir, path.basename(item.fileName));
  }

  list() {
    return this.items.map((item) => this.publicItem(item));
  }

  get(id) {
    const item = this.items.find((entry) => entry.id === id);
    return item ? { ...item } : null;
  }

  readBuffer(id) {
    const filePath = this.pathFor(id);
    if (!filePath || !fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  addPng(buffer, { width, height, now = Date.now() } = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const existingIndex = this.items.findIndex((item) => item.hash === hash);

    if (existingIndex >= 0) {
      const item = this.items.splice(existingIndex, 1)[0];
      item.createdAt = now;
      item.lastCopiedAt = now;
      this.items.unshift(item);
      this.persist();
      return { item: this.publicItem(item), isNew: false };
    }

    const id = crypto.randomUUID();
    const fileName = `${id}.png`;
    fs.mkdirSync(this.imageDir, { recursive: true });
    fs.writeFileSync(path.join(this.imageDir, fileName), buffer);

    const item = {
      id,
      kind: 'image',
      fileName,
      hash,
      width: Math.max(1, Number(width) || 1),
      height: Math.max(1, Number(height) || 1),
      createdAt: now,
      lastCopiedAt: now,
      pinned: false,
      ocrText: '',
      qrText: '',
    };
    this.items.unshift(item);
    this.enforceLimit();
    this.persist();
    return { item: this.publicItem(item), isNew: true };
  }

  publicItem(item) {
    const { fileName, hash, ...publicFields } = item;
    return { ...publicFields };
  }

  touch(id, now = Date.now()) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const item = this.items.splice(index, 1)[0];
    item.lastCopiedAt = now;
    this.items.unshift(item);
    this.persist();
    return this.publicItem(item);
  }

  togglePin(id) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return null;
    item.pinned = !item.pinned;
    this.persist();
    return this.publicItem(item);
  }

  updateAnalysis(id, patch = {}) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) return null;
    if (typeof patch.ocrText === 'string') item.ocrText = patch.ocrText.trim();
    if (typeof patch.qrText === 'string') item.qrText = patch.qrText.trim();
    this.persist();
    return this.publicItem(item);
  }

  remove(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index < 0) return false;
    const [item] = this.items.splice(index, 1);
    this.deleteFile(item);
    this.persist();
    return true;
  }

  clear({ keepPinned = true } = {}) {
    const kept = [];
    for (const item of this.items) {
      if (keepPinned && item.pinned) kept.push(item);
      else this.deleteFile(item);
    }
    this.items = kept;
    this.persist();
  }

  deleteFile(item) {
    const filePath = this.pathFor(item);
    if (!filePath) return;
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // Best-effort cleanup. Metadata remains authoritative.
    }
  }

  enforceLimit() {
    if (this.items.length <= this.limit) return;
    const pinned = this.items.filter((item) => item.pinned);
    const regular = this.items.filter((item) => !item.pinned);
    const keep = new Set([...pinned, ...regular].slice(0, Math.max(this.limit, pinned.length)).map((item) => item.id));
    const removed = this.items.filter((item) => !keep.has(item.id));
    for (const item of removed) this.deleteFile(item);
    this.items = this.items.filter((item) => keep.has(item.id)).sort((a, b) => b.createdAt - a.createdAt);
  }

  cleanupOrphans() {
    if (!this.imageDir || !fs.existsSync(this.imageDir)) return;
    const valid = new Set(this.items.map((item) => path.basename(item.fileName)));
    for (const fileName of fs.readdirSync(this.imageDir)) {
      if (!fileName.toLowerCase().endsWith('.png') || valid.has(fileName)) continue;
      try {
        fs.rmSync(path.join(this.imageDir, fileName), { force: true });
      } catch {
        // Ignore cleanup failures.
      }
    }
  }
}

module.exports = { ImageStore };
