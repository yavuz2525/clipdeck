const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePassword, clampLength } = require('../src/password-generator');

test('clamps password length', () => {
  assert.equal(clampLength(3), 8);
  assert.equal(clampLength(500), 128);
  assert.equal(clampLength(24), 24);
});

test('generates requested character classes', () => {
  const password = generatePassword({ length: 32, lowercase: true, uppercase: true, numbers: true, symbols: true });
  assert.equal(password.length, 32);
  assert.match(password, /[a-z]/);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[^a-zA-Z0-9]/);
});
