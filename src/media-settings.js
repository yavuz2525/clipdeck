const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MEDIA_SETTINGS = Object.freeze({
  imageHistory: true,
  snippetSuggestions: true,
});

class MediaSettingsStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = { ...DEFAULT_MEDIA_SETTINGS };
    this.load();
  }

  load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.state = {
        imageHistory: parsed.imageHistory !== false,
        snippetSuggestions: parsed.snippetSuggestions !== false,
      };
    } catch {
      this.state = { ...DEFAULT_MEDIA_SETTINGS };
    }
  }

  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(temp, this.filePath);
  }

  snapshot() {
    return { ...this.state };
  }

  set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_MEDIA_SETTINGS, key)) return this.snapshot();
    this.state[key] = Boolean(value);
    this.persist();
    return this.snapshot();
  }
}

module.exports = { MediaSettingsStore };
