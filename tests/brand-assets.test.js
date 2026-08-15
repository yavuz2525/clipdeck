const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('brand source reconstructs a valid PNG', () => {
  const sourcePath = path.join(__dirname, '..', 'assets', 'brand', 'icon.hex');
  const hex = fs.readFileSync(sourcePath, 'utf8').replace(/\s+/g, '');
  assert.match(hex, /^[0-9a-f]+$/i);
  assert.equal(hex.length % 2, 0);

  const png = Buffer.from(hex, 'hex');
  assert.deepEqual(
    [...png.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  assert.ok(png.length > 5_000);
});
