function makeButton(label, className = 'text-button') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function installMediaUi() {
  const media = window.clipdeck?.media;
  if (!media) return;

  const nav = document.querySelector('.view-tabs');
  const imageTab = document.querySelector('#imagesTab');
  const qrTab = document.querySelector('#qrTab');
  const imagesView = document.querySelector('#mediaImagesView');
  const qrView = document.querySelector('#qrCenterView');
  if (!nav || !imageTab || !qrTab || !imagesView || !qrView) return;

  const coreViews = [
    document.querySelector('#historyView'),
    document.querySelector('#snippetsView'),
    document.querySelector('#vaultView'),
  ].filter(Boolean);

  let currentImages = [];
  let mediaSettings = { imageHistory: true, snippetSuggestions: true };
  const previewCache = new Map();

  const grid = document.querySelector('#mediaImagesGrid');
  const empty = document.querySelector('#mediaImagesEmpty');
  const clearButton = document.querySelector('#mediaClearImages');
  const ocrStatus = document.querySelector('#mediaOcrStatus');
  const imageToggle = document.querySelector('#mediaImageHistoryToggle');
  const suggestionToggle = document.querySelector('#mediaSuggestionToggle');

  const qrInput = document.querySelector('#qrInput');
  const qrGenerate = document.querySelector('#qrGenerate');
  const qrScanClipboard = document.querySelector('#qrScanClipboard');
  const qrPreviewWrap = document.querySelector('#qrPreviewWrap');
  const qrPreview = document.querySelector('#qrPreview');
  const qrCopyImage = document.querySelector('#qrCopyImage');
  const qrResultWrap = document.querySelector('#qrResultWrap');
  const qrResult = document.querySelector('#qrResult');
  const qrCopyResult = document.querySelector('#qrCopyResult');
  const qrStatus = document.querySelector('#qrStatus');

  function showMediaView(view) {
    for (const element of coreViews) element.classList.add('hidden');
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
  }, true);

  function analysisBox(title, text) {
    const box = document.createElement('div');
    box.className = 'analysis-box';

    const strong = document.createElement('strong');
    strong.textContent = title;

    const pre = document.createElement('pre');
    pre.textContent = text;

    const copy = makeButton('Copy');
    copy.addEventListener('click', () => media.copyText(text));

    box.append(strong, pre, copy);
    return box;
  }

  function renderImages() {
    grid.replaceChildren();
    empty.classList.toggle('hidden', currentImages.length > 0);
    clearButton.disabled = currentImages.length === 0 || currentImages.every((item) => item.pinned);

    for (const item of currentImages) {
      const card = document.createElement('article');
      card.className = 'media-image-card';
      if (item.pinned) card.classList.add('pinned');

      const image = document.createElement('img');
      image.className = 'media-thumb';
      image.alt = `Clipboard image ${item.width} by ${item.height}`;

      if (previewCache.has(item.id)) {
        image.src = previewCache.get(item.id);
      } else {
        media.previewImage(item.id, 420)
          .then((result) => {
            if (!result?.ok) return;
            previewCache.set(item.id, result.dataUrl);
            image.src = result.dataUrl;
          })
          .catch(() => {});
      }

      const meta = document.createElement('div');
      meta.className = 'media-image-meta';
      meta.textContent = `${item.width}×${item.height}${item.pinned ? '  ·  pinned' : ''}`;

      const actions = document.createElement('div');
      actions.className = 'content-actions media-actions';

      const copy = makeButton('Copy image', 'text-button primary');
      const ocr = makeButton('OCR');
      const scan = makeButton('Scan QR');
      const pin = makeButton(item.pinned ? 'Unpin' : 'Pin');
      const remove = makeButton('Delete', 'text-button danger');

      copy.addEventListener('click', () => media.copyImage(item.id));
      pin.addEventListener('click', () => media.toggleImagePin(item.id));
      remove.addEventListener('click', () => media.removeImage(item.id));

      ocr.addEventListener('click', async () => {
        ocr.disabled = true;
        ocr.textContent = 'Reading…';
        const result = await media.ocrImage(item.id);
        ocr.disabled = false;
        ocr.textContent = 'OCR';
        if (!result.ok) meta.textContent = result.error || 'OCR failed.';
      });

      scan.addEventListener('click', async () => {
        scan.disabled = true;
        const result = await media.scanImageQr(item.id);
        scan.disabled = false;
        if (!result.ok) meta.textContent = result.error || 'No QR found.';
      });

      actions.append(copy, ocr, scan, pin, remove);
      card.append(image, meta, actions);

      if (item.ocrText) card.appendChild(analysisBox('OCR text', item.ocrText));
      if (item.qrText) card.appendChild(analysisBox('QR content', item.qrText));
      grid.appendChild(card);
    }
  }

  function renderMediaSettings() {
    imageToggle.checked = mediaSettings.imageHistory !== false;
    suggestionToggle.checked = mediaSettings.snippetSuggestions !== false;
  }

  clearButton.addEventListener('click', () => media.clearImages());
  imageToggle.addEventListener('change', () => media.setSetting('imageHistory', imageToggle.checked));
  suggestionToggle.addEventListener('change', () => media.setSetting('snippetSuggestions', suggestionToggle.checked));

  qrGenerate.addEventListener('click', async () => {
    qrStatus.textContent = 'Generating…';
    const result = await media.generateQr(qrInput.value);
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
    const result = await media.copyQrImage(qrInput.value);
    qrStatus.textContent = result.ok ? 'QR image copied.' : (result.error || 'Copy failed.');
  });

  qrScanClipboard.addEventListener('click', async () => {
    qrStatus.textContent = 'Scanning clipboard…';
    const result = await media.scanClipboardQr();
    if (!result.ok) {
      qrStatus.textContent = result.error || 'QR scan failed.';
      qrResultWrap.classList.add('hidden');
      return;
    }

    qrResult.textContent = result.text;
    qrResultWrap.classList.remove('hidden');
    qrStatus.textContent = 'QR detected.';
  });

  qrCopyResult.addEventListener('click', () => media.copyText(qrResult.textContent));

  media.onImagesChanged((items) => {
    currentImages = Array.isArray(items) ? items : [];
    renderImages();
  });

  media.onSettingsChanged((settings) => {
    mediaSettings = settings || mediaSettings;
    renderMediaSettings();
  });

  media.onOcrProgress((progress) => {
    if (!progress?.status) return;
    if (progress.status === 'done') {
      ocrStatus.textContent = 'OCR complete.';
      window.setTimeout(() => {
        if (ocrStatus.textContent === 'OCR complete.') ocrStatus.textContent = '';
      }, 1600);
      return;
    }

    if (progress.status === 'error') {
      ocrStatus.textContent = 'OCR failed.';
      return;
    }

    const percent = Number.isFinite(progress.progress) ? ` ${progress.progress}%` : '';
    ocrStatus.textContent = `OCR: ${progress.status}${percent}`;
  });

  Promise.all([
    media.listImages(),
    media.getSettings(),
  ]).then(([items, settings]) => {
    currentImages = Array.isArray(items) ? items : [];
    mediaSettings = settings || mediaSettings;
    renderImages();
    renderMediaSettings();
  }).catch(() => {});
}

installMediaUi();
