const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const QRCode = require('qrcode');
const { createWorker } = require('tesseract.js');
const engData = require('@tesseract.js-data/eng');
const turData = require('@tesseract.js-data/tur');

let ocrWorkerPromise = null;
let ocrDataPath = null;

function copyIfMissing(source, destination) {
  if (fs.existsSync(destination)) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function prepareOcrData(userDataPath) {
  const targetDir = path.join(userDataPath, 'ocr-data');
  const pairs = [
    [path.join(engData.langPath, 'eng.traineddata.gz'), path.join(targetDir, 'eng.traineddata.gz')],
    [path.join(turData.langPath, 'tur.traineddata.gz'), path.join(targetDir, 'tur.traineddata.gz')],
  ];

  for (const [source, destination] of pairs) {
    if (!fs.existsSync(source)) throw new Error(`OCR language data is missing: ${source}`);
    copyIfMissing(source, destination);
  }

  ocrDataPath = targetDir;
  return targetDir;
}

async function getOcrWorker(userDataPath, logger = () => {}) {
  const langPath = ocrDataPath || prepareOcrData(userDataPath);
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker(['eng', 'tur'], 1, {
      langPath,
      gzip: true,
      cacheMethod: 'none',
      logger,
    }).catch((error) => {
      ocrWorkerPromise = null;
      throw error;
    });
  }
  return ocrWorkerPromise;
}

async function recognizePng(buffer, userDataPath, logger) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Image data is empty.');
  const worker = await getOcrWorker(userDataPath, logger);
  const result = await worker.recognize(buffer, { rotateAuto: true });
  const text = String(result?.data?.text || '').trim();
  return {
    text,
    confidence: Number(result?.data?.confidence) || 0,
  };
}

async function terminateOcr() {
  if (!ocrWorkerPromise) return;
  try {
    const worker = await ocrWorkerPromise;
    await worker.terminate();
  } catch {
    // Ignore worker shutdown failures.
  } finally {
    ocrWorkerPromise = null;
  }
}

function scanQrFromPng(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return null;
  const png = PNG.sync.read(buffer, { skipRescale: false });
  const rgba = new Uint8ClampedArray(png.data.length);
  rgba.set(png.data);
  const result = jsQR(rgba, png.width, png.height, { inversionAttempts: 'attemptBoth' });
  return result?.data ? String(result.data) : null;
}

async function generateQrPng(text, options = {}) {
  const value = String(text || '').trim();
  if (!value) throw new Error('QR content cannot be empty.');
  if (Buffer.byteLength(value, 'utf8') > 2800) throw new Error('QR content is too long.');
  return QRCode.toBuffer(value, {
    type: 'png',
    width: Math.max(192, Math.min(1024, Number(options.width) || 512)),
    margin: 2,
    errorCorrectionLevel: options.errorCorrectionLevel || 'M',
  });
}

module.exports = {
  generateQrPng,
  prepareOcrData,
  recognizePng,
  scanQrFromPng,
  terminateOcr,
};
