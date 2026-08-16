const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeToken } = require('../src/suggest/controller');

test('suggestion token is normalized and bounded', () => {
  assert.equal(normalizeToken('  MaIl  '), 'mail');
  assert.equal(normalizeToken('A'.repeat(100)).length, 64);
});
