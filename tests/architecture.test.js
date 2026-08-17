const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('preload stays DOM-free and exposes only the IPC bridge', () => {
  const preload = read('preload.js');
  assert.match(preload, /contextBridge\.exposeInMainWorld\('clipdeck'/);
  assert.equal(/\bdocument\b/.test(preload), false);
  assert.equal(/\bwindow\b/.test(preload), false);
  assert.equal(/createElement|querySelector|DOMContentLoaded/.test(preload), false);
});

test('renderer owns media and shortcut settings UI modules', () => {
  const html = read('src/renderer/index.html');
  assert.match(html, /<script src="\.\/shortcut-settings\.js"><\/script>/);
  assert.match(html, /<script src="\.\/media-ui\.js"><\/script>/);
  assert.match(html, /id="mediaImagesView"/);
  assert.match(html, /id="qrCenterView"/);
  assert.match(html, /id="expandShortcutCapture"/);
});
