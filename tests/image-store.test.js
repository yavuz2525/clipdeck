const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ImageStore } = require('../src/image-store');

function tempStore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clipdeck-images-'));
  return {
    root,
    store: new ImageStore(path.join(root, 'images.json'), path.join(root, 'images'), { limit: 10 }),
  };
}

test('deduplicates identical image buffers', () => {
  const { root, store } = tempStore();
  try {
    const first = store.addPng(Buffer.from('fake-png-a'), { width: 10, height: 20, now: 100 });
    const second = store.addPng(Buffer.from('fake-png-a'), { width: 10, height: 20, now: 200 });
    assert.equal(first.isNew, true);
    assert.equal(second.isNew, false);
    assert.equal(store.list().length, 1);
    assert.equal(store.list()[0].createdAt, 200);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('pinned images survive clear', () => {
  const { root, store } = tempStore();
  try {
    const one = store.addPng(Buffer.from('one'), { width: 1, height: 1 }).item;
    store.addPng(Buffer.from('two'), { width: 1, height: 1 });
    store.togglePin(one.id);
    store.clear({ keepPinned: true });
    assert.equal(store.list().length, 1);
    assert.equal(store.list()[0].id, one.id);
    assert.equal(store.list()[0].pinned, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('OCR and QR analysis metadata persists', () => {
  const { root, store } = tempStore();
  try {
    const item = store.addPng(Buffer.from('analysis'), { width: 1, height: 1 }).item;
    store.updateAnalysis(item.id, { ocrText: 'Merhaba dünya', qrText: 'https://example.com' });
    const reopened = new ImageStore(path.join(root, 'images.json'), path.join(root, 'images'), { limit: 10 });
    const loaded = reopened.get(item.id);
    assert.equal(loaded.ocrText, 'Merhaba dünya');
    assert.equal(loaded.qrText, 'https://example.com');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
