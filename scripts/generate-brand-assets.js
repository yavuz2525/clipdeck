const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'assets', 'brand', 'icon.hex');
const outputDir = path.join(root, 'build');
const outputPath = path.join(outputDir, 'icon.png');

const hex = fs.readFileSync(sourcePath, 'utf8').replace(/\s+/g, '');
if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
  throw new Error('ClipDeck brand source is invalid.');
}

const png = Buffer.from(hex, 'hex');
const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!png.subarray(0, 8).equals(signature)) {
  throw new Error('Generated ClipDeck icon is not a valid PNG.');
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, png);
console.log(`Generated ${path.relative(root, outputPath)} (${png.length} bytes)`);
