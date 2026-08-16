const { contextBridge, ipcRenderer } = require('electron');

const DEFAULT_EXPAND_SHORTCUT = 'CommandOrControl+Alt+E';

function prettyShortcut(shortcut) {
  if (!shortcut) return 'Not set';
  return shortcut
    .replaceAll('CommandOrControl', 'Ctrl/⌘')
    .replaceAll('Control', 'Ctrl')
    .replaceAll('Command', '⌘')
    .replaceAll('+', ' + ');
}

function shortcutFromKeyboardEvent(event) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null;
  const parts = [];
  if (event.ctrlKey) parts.push('CommandOrControl');
  if (event.metaKey) parts.push('Command');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  const keyMap = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Esc',
  };
  let key = keyMap[event.key] || event.key;
  if (/^[a-z0-9]$/i.test(key)) key = key.toUpperCase();
  const isFunctionKey = /^F(?:[1-9]|1\d|2[0-4])$/.test(key);
  if (parts.length === 0 && !isFunctionKey) return null;
  parts.push(key);
  return parts.join('+');
}

function installExpandShortcutSettings() {
  let currentShortcut = DEFAULT_EXPAND_SHORTCUT;
  let capturing = false;

  const settingsCard = [...document.querySelectorAll('.setting-card')]
    .find((card) => card.querySelector('h3')?.textContent?.trim() === 'Snippet expansion');
  const footerSpan = [...document.querySelectorAll('.footer span')]
    .find((span) => span.textContent?.trim().startsWith('Expand snippet:'));

  if (!settingsCard) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'shortcut-capture';
  button.textContent = prettyShortcut(currentShortcut);
  button.setAttribute('aria-label', 'Change snippet expansion shortcut');

  const error = document.createElement('div');
  error.className = 'setting-error hidden';
  error.setAttribute('role', 'alert');
  settingsCard.append(button, error);

  function render(shortcut) {
    currentShortcut = shortcut || DEFAULT_EXPAND_SHORTCUT;
    if (!capturing) button.textContent = prettyShortcut(currentShortcut);
    const kbd = footerSpan?.querySelector('kbd');
    if (kbd) kbd.textContent = prettyShortcut(currentShortcut);
  }

  ipcRenderer.invoke('history:get').then((state) => {
    render(state?.settings?.expandShortcut);
  }).catch(() => {});

  ipcRenderer.on('history:changed', (_event, state) => {
    render(state?.settings?.expandShortcut);
  });

  button.addEventListener('click', () => {
    capturing = true;
    button.classList.add('recording');
    button.textContent = 'Press a shortcut…';
    error.classList.add('hidden');
    button.focus();
  });

  document.addEventListener('keydown', async (event) => {
    if (!capturing) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.key === 'Escape') {
      capturing = false;
      button.classList.remove('recording');
      button.textContent = prettyShortcut(currentShortcut);
      return;
    }

    const shortcut = shortcutFromKeyboardEvent(event);
    if (!shortcut) {
      button.textContent = 'Use Ctrl/Alt/⌘ + a key';
      return;
    }

    capturing = false;
    button.classList.remove('recording');
    button.textContent = prettyShortcut(shortcut);

    const result = await ipcRenderer.invoke('settings:expandShortcut', shortcut);
    if (!result.ok) {
      render(result.shortcut || currentShortcut);
      error.textContent = result.error || 'That shortcut could not be registered.';
      error.classList.remove('hidden');
      return;
    }

    error.classList.add('hidden');
    render(result.shortcut);
  }, true);
}

function makeButton(label, className = 'text-button') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function installMediaUi() {
  const nav = document.querySelector('.view-tabs');
  const vaultView = document.querySelector('#vaultView');
  const settingsPanel = document.querySelector('.settings-panel');
  if (!nav || !vaultView) return;

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = './media-tools.css';
  document.head.appendChild(css);

  const imageTab = makeButton('Images', 'view-tab');
  imageTab.dataset.mediaView = 'images';
  const qrTab = makeButton('QR', 'view-tab');
  qrTab.dataset.mediaView = 'qr';
  nav.append(imageTab, qrTab);

  const imagesView = document.createElement('section');
  imagesView.id = 'mediaImagesView';
  imagesView.className = 'app-view hidden';
  imagesView.innerHTML = `
    <div class="section-head">
      <div><h2>Image history</h2><p>Screenshots and copied images stay on this device.</p></div>
      <button id="mediaClearImages" class="text-button danger" type="button">Clear images</button>
    </div>
    <div class="media-tip"><strong>OCR + QR</strong><span>Extract Turkish/English text locally or scan QR codes from any saved image.</span></div>
    <section id="mediaImagesEmpty" class="empty-state hidden"><div class="empty-icon">▧</div><h2>No images yet</h2><p>Copy a screenshot or image and it will appear here.</p></section>
    <section id="mediaImagesGrid" class="media-images-grid" aria-label="Image clipboard history"></section>
  `;

  const qrView = document.createElement('section');
  qrView.id = 'qrCenterView';
  qrView.className = 'app-view hidden';
  qrView.innerHTML = `
    <div class="section-head"><div><h2>QR Center</h2><p>Create a QR from text or scan one directly from the clipboard.</p></div></div>
    <section class="qr-card">
      <label class="field">Text or URL<textarea id="qrInput" rows="5" placeholder="https://example.com"></textarea></label>
      <div class="content-actions">
        <button id="qrGenerate" class="text-button primary" type="button">Generate QR</button>
        <button id="qrScanClipboard" class="text-button" type="button">Scan clipboard image</button>
      </div>
      <div id="qrPreviewWrap" class="qr-preview-wrap hidden"><img id="qrPreview" alt="Generated QR code" /><button id="qrCopyImage" class="text-button" type="button">Copy QR image</button></div>
      <div id="qrResultWrap" class="analysis-box hidden"><strong>Scanned content</strong><pre id="qrResult"></pre><button id="qrCopyResult" class="text-button" type="button">Copy result</button></div>
      <div id="qrStatus" class="subtle"></div>
    </section>
  `;

  vaultView.insertAdjacentElement('afterend', imagesView);
  imagesView.insertAdjacentElement('afterend', qrView);

  let currentImages = [];
  let mediaSettings = { imageHistory: true, snippetSuggestions: true };
  const previewCache = new Map();
  const grid = imagesView.querySelector('#mediaImagesGrid');
  const empty = imagesView.querySelector('#mediaImagesEmpty');
  const clearButton = imagesView.querySelector('#mediaClearImages');
  const qrInput = qrView.querySelector('#qrInput');
  const qrGenerate = qrView.querySelector('#qrGenerate');
  const qrScanClipboard = qrView.querySelector('#qrScanClipboard');
  const qrPreviewWrap = qrView.querySelector('#qrPreviewWrap');
  const qrPreview = qrView.querySelector('#qrPreview');
  const qrCopyImage = qrView.querySelector('#qrCopyImage');
  const qrResultWrap = qrView.querySelector('#qrResultWrap');
  const qrResult = qrView.querySelector('#qrResult');
  const qrCopyResult = qrView.querySelector('#qrCopyResult');
  const qrStatus = qrView.querySelector('#qrStatus');

  function showMediaView(view) {
    document.querySelector('#historyView')?.classList.add('hidden');
    document.querySelector('#snippetsView')?.classList.add('hidden');
    document.querySelector('#vaultView')?.classList.add('hidden');
    imagesView.classList.toggle('hidden', view !== 'images');
    qrView.classList.toggle('hidden', view !== 'qr');
    for (const tab of nav.querySelectorAll('.view-tab')) tab.classList.remove('active');
    (view === 'images' ? imageTab : qrTab).classList.add('active');
  }

  imageTab.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
    showMediaView('images');
  });
  qrTab.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
    showMediaView('qr');
  });

  nav.addEventListener('click', (event) => {
    if (event.target === imageTab || event.target === qrTab) return;
    imagesView.classList.add('hidden');
    qrView.classList.add('hidden');
    imageTab.classList.remove('active');
    qrTab.classList.remove('active');
  }, true);

  function analysisBox(title, text) {
    const box = document.createElement('div');
    box.className = 'analysis-box';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const pre = document.createElement('pre');
    pre.textContent = text;
    const copy = makeButton('Copy', 'text-button');
    copy.addEventListener('click', () => ipcRenderer.invoke('media:text:copy', text));
    box.append(strong, pre, copy);
    return box;
  }

  async function renderImages() {
    grid.replaceChildren();
    empty.classList.toggle('hidden', currentImages.length > 0);
    clearButton.disabled = currentImages.every((item) => item.pinned);

    for (const item of currentImages) {
      const card = document.createElement('article');
      card.className = 'media-image-card';
      if (item.pinned) card.classList.add('pinned');

      const img = document.createElement('img');
      img.className = 'media-thumb';
      img.alt = `Clipboard image ${item.width} by ${item.height}`;
      if (previewCache.has(item.id)) img.src = previewCache.get(item.id);
      else {
        ipcRenderer.invoke('media:image:preview', item.id, 420).then((result) => {
          if (result?.ok) {
            previewCache.set(item.id, result.dataUrl);
            img.src = result.dataUrl;
          }
        }).catch(() => {});
      }

      const meta = document.createElement('div');
      meta.className = 'media-image-meta';
      meta.textContent = `${item.width}×${item.height}${item.pinned ? '  ·  pinned' : ''}`;

      const actions = document.createElement('div');
      actions.className = 'content-actions media-actions';
      const copy = makeButton('Copy image', 'text-button primary');
      const ocr = makeButton('OCR', 'text-button');
      const scan = makeButton('Scan QR', 'text-button');
      const pin = makeButton(item.pinned ? 'Unpin' : 'Pin', 'text-button');
      const remove = makeButton('Delete', 'text-button danger');
      copy.addEventListener('click', () => ipcRenderer.invoke('media:image:copy', item.id));
      ocr.addEventListener('click', async () => {
        ocr.disabled = true;
        ocr.textContent = 'Reading…';
        const result = await ipcRenderer.invoke('media:image:ocr', item.id);
        ocr.disabled = false;
        ocr.textContent = 'OCR';
        if (!result.ok) meta.textContent = result.error || 'OCR failed.';
      });
      scan.addEventListener('click', async () => {
        scan.disabled = true;
        const result = await ipcRenderer.invoke('media:qr:scanImage', item.id);
        scan.disabled = false;
        if (!result.ok) meta.textContent = result.error || 'No QR found.';
      });
      pin.addEventListener('click', () => ipcRenderer.invoke('media:image:pin', item.id));
      remove.addEventListener('click', () => ipcRenderer.invoke('media:image:remove', item.id));
      actions.append(copy, ocr, scan, pin, remove);

      card.append(img, meta, actions);
      if (item.ocrText) card.appendChild(analysisBox('OCR text', item.ocrText));
      if (item.qrText) card.appendChild(analysisBox('QR content', item.qrText));
      grid.appendChild(card);
    }
  }

  clearButton.addEventListener('click', () => ipcRenderer.invoke('media:image:clear'));

  qrGenerate.addEventListener('click', async () => {
    qrStatus.textContent = 'Generating…';
    const result = await ipcRenderer.invoke('media:qr:generate', qrInput.value);
    if (!result.ok) {
      qrStatus.textContent = result.error || 'QR could not be generated.';
      qrPreviewWrap.classList.add('hidden');
      return;
    }
    qrPreview.src = result.dataUrl;
    qrPreviewWrap.classList.remove('hidden');
    qrStatus.textContent = 'QR ready.';
  });

  qrCopyImage.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('media:qr:copyImage', qrInput.value);
    qrStatus.textContent = result.ok ? 'QR image copied.' : (result.error || 'Copy failed.');
  });

  qrScanClipboard.addEventListener('click', async () => {
    qrStatus.textContent = 'Scanning clipboard…';
    const result = await ipcRenderer.invoke('media:qr:scanClipboard');
    if (!result.ok) {
      qrStatus.textContent = result.error || 'QR scan failed.';
      qrResultWrap.classList.add('hidden');
      return;
    }
    qrResult.textContent = result.text;
    qrResultWrap.classList.remove('hidden');
    qrStatus.textContent = 'QR detected.';
  });

  qrCopyResult.addEventListener('click', () => ipcRenderer.invoke('media:text:copy', qrResult.textContent));

  if (settingsPanel) {
    const card = document.createElement('div');
    card.className = 'setting-card media-setting-card';
    card.innerHTML = `
      <div class="setting-copy"><h3>Media & snippet suggestions</h3><p>Keep image history and show snippet matches while you type. Suggestions only keep the current trigger-shaped token in memory; it is never written to disk.</p></div>
      <div class="media-toggle-stack">
        <label><input id="mediaImageHistoryToggle" type="checkbox" /> Image history</label>
        <label><input id="mediaSuggestionToggle" type="checkbox" /> Snippet suggestions</label>
      </div>
    `;
    const automaticUpdatesCard = [...settingsPanel.querySelectorAll('.setting-card')]
      .find((item) => item.querySelector('h3')?.textContent?.trim() === 'Automatic updates');
    settingsPanel.insertBefore(card, automaticUpdatesCard || null);
    const imageToggle = card.querySelector('#mediaImageHistoryToggle');
    const suggestionToggle = card.querySelector('#mediaSuggestionToggle');

    function renderSettings() {
      imageToggle.checked = mediaSettings.imageHistory !== false;
      suggestionToggle.checked = mediaSettings.snippetSuggestions !== false;
    }
    imageToggle.addEventListener('change', () => ipcRenderer.invoke('media:settings:set', 'imageHistory', imageToggle.checked));
    suggestionToggle.addEventListener('change', () => ipcRenderer.invoke('media:settings:set', 'snippetSuggestions', suggestionToggle.checked));
    ipcRenderer.invoke('media:settings:get').then((settings) => {
      mediaSettings = settings || mediaSettings;
      renderSettings();
    }).catch(() => {});
    ipcRenderer.on('media:settingsChanged', (_event, settings) => {
      mediaSettings = settings || mediaSettings;
      renderSettings();
    });
  }

  ipcRenderer.on('media:imagesChanged', (_event, items) => {
    currentImages = Array.isArray(items) ? items : [];
    renderImages();
  });
  ipcRenderer.on('media:ocrProgress', (_event, progress) => {
    const item = currentImages.find((entry) => entry.id === progress?.id);
    if (!item) return;
    if (progress?.status && progress.status !== 'done') {
      const percent = Number.isFinite(progress.progress) ? ` ${progress.progress}%` : '';
      qrStatus.dataset.ocr = `${progress.status}${percent}`;
    }
  });

  ipcRenderer.invoke('media:images:list').then((items) => {
    currentImages = Array.isArray(items) ? items : [];
    renderImages();
  }).catch(() => {});
}

window.addEventListener('DOMContentLoaded', () => {
  installExpandShortcutSettings();
  installMediaUi();
}, { once: true });

contextBridge.exposeInMainWorld('clipdeck', {
  getState: () => ipcRenderer.invoke('history:get'),
  copy: (id) => ipcRenderer.invoke('history:copy', id),
  toggleFavorite: (id) => ipcRenderer.invoke('history:favorite', id),
  togglePin: (id) => ipcRenderer.invoke('history:pin', id),
  remove: (id) => ipcRenderer.invoke('history:remove', id),
  clear: () => ipcRenderer.invoke('history:clear'),
  setPaused: (paused) => ipcRenderer.invoke('settings:paused', paused),
  setLimit: (limit) => ipcRenderer.invoke('settings:limit', limit),
  setTheme: (theme) => ipcRenderer.invoke('settings:theme', theme),
  setShortcut: (shortcut) => ipcRenderer.invoke('settings:shortcut', shortcut),
  setExpandShortcut: (shortcut) => ipcRenderer.invoke('settings:expandShortcut', shortcut),
  listSnippets: () => ipcRenderer.invoke('snippets:list'),
  saveSnippet: (input) => ipcRenderer.invoke('snippets:save', input),
  removeSnippet: (id) => ipcRenderer.invoke('snippets:remove', id),
  copySnippet: (id, values) => ipcRenderer.invoke('snippets:copy', id, values),
  generatePassword: (options) => ipcRenderer.invoke('password:generate', options),
  getVaultStatus: () => ipcRenderer.invoke('vault:status'),
  listVault: () => ipcRenderer.invoke('vault:list'),
  saveVaultEntry: (input) => ipcRenderer.invoke('vault:save', input),
  removeVaultEntry: (id) => ipcRenderer.invoke('vault:remove', id),
  copySensitive: (text) => ipcRenderer.invoke('vault:copy', text),
  getUpdateState: () => ipcRenderer.invoke('updates:get'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('history:changed', listener);
    return () => ipcRenderer.removeListener('history:changed', listener);
  },
  onUpdateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('updates:changed', listener);
    return () => ipcRenderer.removeListener('updates:changed', listener);
  },
});
