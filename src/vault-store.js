const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function sanitizeEntry(input = {}) {
  return {
    title: typeof input.title === 'string' ? input.title.trim() : '',
    username: typeof input.username === 'string' ? input.username : '',
    password: typeof input.password === 'string' ? input.password : '',
    url: typeof input.url === 'string' ? input.url : '',
    notes: typeof input.notes === 'string' ? input.notes : '',
  };
}

class VaultStore {
  constructor(filePath, codec) {
    this.filePath = filePath;
    this.codec = codec;
    this.records = [];
    this.load();
  }

  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.records = Array.isArray(parsed.records)
        ? parsed.records.filter((record) => record && typeof record.id === 'string' && typeof record.payload === 'string')
        : [];
    } catch {
      this.records = [];
    }
  }

  persist() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify({ version: 1, records: this.records }, null, 2), 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  async list() {
    const items = [];
    for (const record of this.records) {
      try {
        const decrypted = await this.codec.decrypt(Buffer.from(record.payload, 'base64'));
        const data = sanitizeEntry(JSON.parse(decrypted));
        items.push({
          id: record.id,
          ...data,
          createdAt: Number(record.createdAt) || Date.now(),
          updatedAt: Number(record.updatedAt) || Number(record.createdAt) || Date.now(),
        });
      } catch {
        // Skip unreadable/corrupt records rather than exposing broken data.
      }
    }
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async save(input, now = Date.now()) {
    const data = sanitizeEntry(input);
    if (!data.title || !data.password) return null;

    const encrypted = await this.codec.encrypt(JSON.stringify(data));
    const payload = Buffer.from(encrypted).toString('base64');
    const id = typeof input.id === 'string' ? input.id : null;
    const index = id ? this.records.findIndex((record) => record.id === id) : -1;
    let record;

    if (index >= 0) {
      record = {
        ...this.records[index],
        payload,
        updatedAt: now,
      };
      this.records.splice(index, 1);
    } else {
      record = {
        id: crypto.randomUUID(),
        payload,
        createdAt: now,
        updatedAt: now,
      };
    }

    this.records.unshift(record);
    this.persist();
    return {
      id: record.id,
      ...data,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  remove(id) {
    const before = this.records.length;
    this.records = this.records.filter((record) => record.id !== id);
    const changed = before !== this.records.length;
    if (changed) this.persist();
    return changed;
  }
}

module.exports = {
  VaultStore,
  sanitizeEntry,
};
