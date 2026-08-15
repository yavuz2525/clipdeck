const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function extractVariables(template) {
  if (typeof template !== 'string') return [];
  const names = [];
  const seen = new Set();
  const pattern = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;
  let match;
  while ((match = pattern.exec(template)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

function renderTemplate(template, values = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_full, name) => {
    const value = values && Object.prototype.hasOwnProperty.call(values, name)
      ? values[name]
      : '';
    return String(value ?? '');
  });
}

class SnippetStore {
  constructor(filePath = null) {
    this.filePath = filePath;
    this.items = [];
    this.load();
  }

  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      this.items = items
        .filter((item) => item && typeof item.name === 'string' && typeof item.template === 'string')
        .map((item) => ({
          id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
          name: item.name.trim() || 'Untitled snippet',
          template: item.template,
          createdAt: Number(item.createdAt) || Date.now(),
          updatedAt: Number(item.updatedAt) || Number(item.createdAt) || Date.now(),
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
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

  list() {
    return this.items.map((item) => ({
      ...item,
      variables: extractVariables(item.template),
    }));
  }

  save(input, now = Date.now()) {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const template = typeof input?.template === 'string' ? input.template : '';
    if (!name || !template.trim()) return null;

    const id = typeof input.id === 'string' ? input.id : null;
    const index = id ? this.items.findIndex((item) => item.id === id) : -1;
    let item;

    if (index >= 0) {
      item = {
        ...this.items[index],
        name,
        template,
        updatedAt: now,
      };
      this.items.splice(index, 1);
    } else {
      item = {
        id: crypto.randomUUID(),
        name,
        template,
        createdAt: now,
        updatedAt: now,
      };
    }

    this.items.unshift(item);
    this.persist();
    return { ...item, variables: extractVariables(template) };
  }

  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);
    const changed = before !== this.items.length;
    if (changed) this.persist();
    return changed;
  }

  get(id) {
    const item = this.items.find((entry) => entry.id === id);
    return item ? { ...item, variables: extractVariables(item.template) } : null;
  }
}

module.exports = {
  SnippetStore,
  extractVariables,
  renderTemplate,
};
