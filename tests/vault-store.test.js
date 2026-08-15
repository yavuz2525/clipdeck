const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { VaultStore } = require('../src/vault-store');

function mockCodec() {
  return {
    encrypt: async (text) => Buffer.from(`enc:${Buffer.from(text).toString('base64')}`),
    decrypt: async (buffer) => {
      const value = buffer.toString();
      return Buffer.from(value.slice(4), 'base64').toString();
    },
  };
}

test('vault persists encrypted payload without plaintext password', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipdeck-vault-'));
  const file = path.join(dir, 'vault.json');
  const store = new VaultStore(file, mockCodec());
  await store.save({ title: 'GitHub', username: 'me@example.com', password: 'super-secret', url: '', notes: '' }, 100);
  const disk = fs.readFileSync(file, 'utf8');
  assert.equal(disk.includes('super-secret'), false);
  assert.equal(disk.includes('me@example.com'), false);
  const items = await store.list();
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'GitHub');
  assert.equal(items[0].password, 'super-secret');
});
