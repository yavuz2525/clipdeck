const crypto = require('node:crypto');

const SETS = Object.freeze({
  lowercase: 'abcdefghijkmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  numbers: '23456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?',
});

function clampLength(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 20;
  return Math.max(8, Math.min(128, Math.round(numeric)));
}

function pick(chars) {
  return chars[crypto.randomInt(0, chars.length)];
}

function secureShuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function generatePassword(options = {}) {
  const length = clampLength(options.length);
  const enabledKeys = ['lowercase', 'uppercase', 'numbers', 'symbols']
    .filter((key) => options[key] !== false);
  const keys = enabledKeys.length ? enabledKeys : ['lowercase', 'uppercase', 'numbers'];
  const pools = keys.map((key) => SETS[key]);
  const all = pools.join('');

  const required = pools.map((pool) => pick(pool));
  while (required.length < length) required.push(pick(all));
  return secureShuffle(required).slice(0, length).join('');
}

module.exports = {
  clampLength,
  generatePassword,
};
