const crypto = require('node:crypto');
const path = require('node:path');
const {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  nativeImage,
} = require('electron');
const { ImageStore } = require('./src/image-store');
const { MediaSettingsStore } = require('./src/media-settings');
const {
  generateQrPng,
  prepareOcrData,
  recognizePng,
  scanQrFromPng,
  terminateOcr,
} = require('./src/media-services');
const { SnippetSuggestionController } = require('./src/suggest/controller');

require('./main.js');

const APP_ICON_PATH = path.join(__dirname, 'build', 'icon.png');
const IMAGE_POLL_INTERVAL_MS = 650;

let imageStore = null;
let mediaSettings = null;
let imageTimer = null;
let lastImageHash = '';
let suggestionController = null;
let ocrBusy = false;

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function currentClipboardImage() {
  const image = clipboard.readImage();
  if (!image || image.isEmpty()) return null;
  const png = image.toPNG();
  if (!png.length) return null;
  const size = image.getSize();
  return { image, png, hash: hashBuffer(png), width: size.width, height: size.height };
}

function broadcast(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  }
}

function broadcastImages() {
  if (imageStore) broadcast('media:imagesChanged', imageStore.list());
}

function broadcastOcrProgress(payload) {
  broadcast('media:ocrProgress', payload);
}

function pollImageClipboard() {
  if (!imageStore || !mediaSettings?.state.imageHistory) return;
  try {
    const current = currentClipboardImage();
    if (!current || current.hash === lastImageHash) return;
    lastImageHash = current.hash;
    imageStore.addPng(current.png, { width: current.width, height: current.height });
    broadcastImages();
  } catch (error) {
    console.error('Image clipboard monitoring failed:', error);
  }
}

function imagePreview(id, maxWidth = 420) {
  const buffer = imageStore.readBuffer(id);
  if (!buffer) return { ok: false, error: 'Image not found.' };
  const image = nativeImage.createFromBuffer(buffer);
  if (image.isEmpty()) return { ok: false, error: 'Image could not be decoded.' };
  const size = image.getSize();
  const targetWidth = Math.max(120, Math.min(720, Number(maxWidth) || 420));
  const scale = Math.min(1, targetWidth / Math.max(1, size.width));
  const preview = scale < 1
    ? image.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) })
    : image;
  return { ok: true, dataUrl: preview.toDataURL() };
}

function registerMediaIpc(userDataPath) {
  ipcMain.handle('media:images:list', () => imageStore.list());
  ipcMain.handle('media:settings:get', () => mediaSettings.snapshot());
  ipcMain.handle('media:settings:set', (_event, key, value) => {
    const settings = mediaSettings.set(key, value);
    if (key === 'snippetSuggestions') suggestionController?.setEnabled(settings.snippetSuggestions);
    if (key === 'imageHistory' && settings.imageHistory) {
      const current = currentClipboardImage();
      lastImageHash = current?.hash || '';
    }
    broadcast('media:settingsChanged', settings);
    return { ok: true, settings };
  });

  ipcMain.handle('media:image:preview', (_event, id, maxWidth) => imagePreview(id, maxWidth));
  ipcMain.handle('media:image:copy', (_event, id) => {
    const buffer = imageStore.readBuffer(id);
    if (!buffer) return { ok: false, error: 'Image not found.' };
    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) return { ok: false, error: 'Image could not be decoded.' };
    clipboard.writeImage(image);
    lastImageHash = hashBuffer(buffer);
    imageStore.touch(id);
    broadcastImages();
    return { ok: true };
  });
  ipcMain.handle('media:image:pin', (_event, id) => {
    const item = imageStore.togglePin(id);
    broadcastImages();
    return { ok: Boolean(item), item };
  });
  ipcMain.handle('media:image:remove', (_event, id) => {
    const ok = imageStore.remove(id);
    broadcastImages();
    return { ok };
  });
  ipcMain.handle('media:image:clear', () => {
    imageStore.clear({ keepPinned: true });
    broadcastImages();
    return { ok: true };
  });

  ipcMain.handle('media:image:ocr', async (_event, id) => {
    if (ocrBusy) return { ok: false, error: 'OCR is already processing another image.' };
    const buffer = imageStore.readBuffer(id);
    if (!buffer) return { ok: false, error: 'Image not found.' };
    ocrBusy = true;
    broadcastOcrProgress({ id, status: 'starting', progress: 0 });
    try {
      const result = await recognizePng(buffer, userDataPath, (message) => {
        const progress = Number.isFinite(message?.progress) ? Math.round(message.progress * 100) : null;
        broadcastOcrProgress({ id, status: message?.status || 'recognizing', progress });
      });
      imageStore.updateAnalysis(id, { ocrText: result.text });
      broadcastImages();
      broadcastOcrProgress({ id, status: 'done', progress: 100 });
      return { ok: true, ...result };
    } catch (error) {
      console.error('OCR failed:', error);
      broadcastOcrProgress({ id, status: 'error', progress: null });
      return { ok: false, error: error.message || 'OCR failed.' };
    } finally {
      ocrBusy = false;
    }
  });

  ipcMain.handle('media:qr:scanImage', (_event, id) => {
    try {
      const buffer = imageStore.readBuffer(id);
      if (!buffer) return { ok: false, error: 'Image not found.' };
      const text = scanQrFromPng(buffer);
      if (!text) return { ok: false, error: 'No QR code found in this image.' };
      imageStore.updateAnalysis(id, { qrText: text });
      broadcastImages();
      return { ok: true, text };
    } catch (error) {
      return { ok: false, error: error.message || 'QR scan failed.' };
    }
  });

  ipcMain.handle('media:qr:scanClipboard', () => {
    try {
      const current = currentClipboardImage();
      if (!current) return { ok: false, error: 'Clipboard does not contain an image.' };
      const text = scanQrFromPng(current.png);
      return text ? { ok: true, text } : { ok: false, error: 'No QR code found in the clipboard image.' };
    } catch (error) {
      return { ok: false, error: error.message || 'QR scan failed.' };
    }
  });

  ipcMain.handle('media:qr:generate', async (_event, text) => {
    try {
      const buffer = await generateQrPng(text);
      return { ok: true, dataUrl: `data:image/png;base64,${buffer.toString('base64')}` };
    } catch (error) {
      return { ok: false, error: error.message || 'QR could not be generated.' };
    }
  });

  ipcMain.handle('media:qr:copyImage', async (_event, text) => {
    try {
      const buffer = await generateQrPng(text);
      const image = nativeImage.createFromBuffer(buffer);
      clipboard.writeImage(image);
      lastImageHash = hashBuffer(buffer);
      imageStore.addPng(buffer, { width: image.getSize().width, height: image.getSize().height });
      broadcastImages();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || 'QR could not be copied.' };
    }
  });

  ipcMain.handle('media:text:copy', (_event, text) => {
    const value = String(text || '');
    if (!value) return { ok: false };
    clipboard.writeText(value);
    return { ok: true };
  });
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  imageStore = new ImageStore(
    path.join(userDataPath, 'clipdeck-images.json'),
    path.join(userDataPath, 'images'),
    { limit: 80 },
  );
  mediaSettings = new MediaSettingsStore(path.join(userDataPath, 'clipdeck-media-settings.json'));
  registerMediaIpc(userDataPath);

  try {
    prepareOcrData(userDataPath);
  } catch (error) {
    console.error('OCR data preparation failed:', error);
  }

  const current = currentClipboardImage();
  lastImageHash = current?.hash || '';
  imageTimer = setInterval(pollImageClipboard, IMAGE_POLL_INTERVAL_MS);

  suggestionController = new SnippetSuggestionController({
    snippetFilePath: path.join(userDataPath, 'clipdeck-snippets.json'),
    iconPath: APP_ICON_PATH,
  });
  suggestionController.setEnabled(mediaSettings.state.snippetSuggestions);
  suggestionController.start();
});

app.on('will-quit', () => {
  if (imageTimer) clearInterval(imageTimer);
  suggestionController?.stop();
  terminateOcr().catch(() => {});
});
