const test = require('node:test');
const assert = require('node:assert/strict');
const { generateQrPng, scanQrFromPng } = require('../src/media-services');

test('generated QR can be decoded locally', async () => {
  const payload = 'https://example.com/clipdeck?q=1';
  const png = await generateQrPng(payload, { width: 256 });
  assert.equal(scanQrFromPng(png), payload);
});
