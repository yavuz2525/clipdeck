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
  const button = document.querySelector('#expandShortcutCapture');
  const error = document.querySelector('#expandShortcutError');
  const footer = document.querySelector('#footerExpandShortcut');
  if (!button || !error) return;

  let currentShortcut = DEFAULT_EXPAND_SHORTCUT;
  let capturing = false;

  function render(shortcut) {
    currentShortcut = shortcut || DEFAULT_EXPAND_SHORTCUT;
    if (!capturing) button.textContent = prettyShortcut(currentShortcut);
    if (footer) footer.textContent = prettyShortcut(currentShortcut);
  }

  window.clipdeck.getState()
    .then((state) => render(state?.settings?.expandShortcut))
    .catch(() => {});

  window.clipdeck.onChanged((state) => {
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

    const result = await window.clipdeck.setExpandShortcut(shortcut);
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

installExpandShortcutSettings();
