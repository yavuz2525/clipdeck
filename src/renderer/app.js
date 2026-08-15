const searchInput = document.querySelector('#searchInput');
const favoritesButton = document.querySelector('#favoritesButton');
const pauseButton = document.querySelector('#pauseButton');
const pauseIcon = document.querySelector('#pauseIcon');
const limitSelect = document.querySelector('#limitSelect');
const clearButton = document.querySelector('#clearButton');
const countLabel = document.querySelector('#countLabel');
const statusBanner = document.querySelector('#statusBanner');
const toast = document.querySelector('#toast');
const emptyState = document.querySelector('#emptyState');
const clipsList = document.querySelector('#clipsList');
const clipTemplate = document.querySelector('#clipTemplate');
const tagFilters = document.querySelector('#tagFilters');
const settingsButton = document.querySelector('#settingsButton');
const settingsOverlay = document.querySelector('#settingsOverlay');
const settingsCloseButton = document.querySelector('#settingsCloseButton');
const shortcutCapture = document.querySelector('#shortcutCapture');
const shortcutError = document.querySelector('#shortcutError');
const footerShortcut = document.querySelector('#footerShortcut');
const updateVersion = document.querySelector('#updateVersion');
const updateStatus = document.querySelector('#updateStatus');
const updateProgressWrap = document.querySelector('#updateProgressWrap');
const updateProgress = document.querySelector('#updateProgress');
const checkUpdatesButton = document.querySelector('#checkUpdatesButton');
const installUpdateButton = document.querySelector('#installUpdateButton');

let state = {
  items: [],
  settings: { limit: 100, paused: false, shortcut: 'CommandOrControl+Shift+V' },
};
let updateState = {
  supported: false,
  status: 'disabled',
  currentVersion: null,
  availableVersion: null,
  progress: null,
  error: null,
};
let favoritesOnly = false;
let selectedTag = null;
let capturingShortcut = false;

function relativeTime(timestamp) {
  const diff = Math.max(0, Date.now() - timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function sizeLabel(text) {
  const chars = text.length;
  if (chars < 1000) return `${chars} chars`;
  return `${(chars / 1000).toFixed(1)}k chars`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function timelineBucket(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);

  if (sameDay(date, now)) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Yesterday';

  const weekStart = startOfDay(now);
  const mondayOffset = (now.getDay() + 6) % 7;
  weekStart.setDate(now.getDate() - mondayOffset);
  if (date >= weekStart) return 'This Week';

  return 'Older';
}

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

  let key = event.key;
  const keyMap = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Esc',
  };

  key = keyMap[key] || key;
  if (/^[a-z0-9]$/i.test(key)) key = key.toUpperCase();

  const isFunctionKey = /^F(?:[1-9]|1\d|2[0-4])$/.test(key);
  if (parts.length === 0 && !isFunctionKey) return null;

  parts.push(key);
  return parts.join('+');
}

function filteredItems() {
  const query = searchInput.value.trim().toLocaleLowerCase();

  return state.items.filter((item) => {
    if (favoritesOnly && !item.favorite) return false;
    if (selectedTag && item.tag !== selectedTag) return false;
    if (!query) return true;

    return item.text.toLocaleLowerCase().includes(query)
      || item.tag.toLocaleLowerCase().includes(query);
  });
}

function flash(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  window.clearTimeout(flash.timer);
  flash.timer = window.setTimeout(() => toast.classList.add('hidden'), 1600);
}

function renderTagFilters() {
  const counts = new Map();
  for (const item of state.items) {
    counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
  }

  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  tagFilters.replaceChildren();
  tagFilters.classList.toggle('hidden', tags.length === 0);

  for (const [tag, count] of tags) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag-filter';
    button.setAttribute('aria-pressed', String(selectedTag === tag));
    button.textContent = `${tag} ${count}`;
    button.addEventListener('click', () => {
      selectedTag = selectedTag === tag ? null : tag;
      render();
    });
    tagFilters.appendChild(button);
  }
}

function createClipCard(item) {
  const fragment = clipTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.clip-card');
  const textButton = fragment.querySelector('.clip-text');
  const favoriteButton = fragment.querySelector('.favorite-action');
  const tagButton = fragment.querySelector('.clip-tag');

  card.classList.toggle('favorite', item.favorite);
  tagButton.textContent = item.tag;
  fragment.querySelector('.clip-time').textContent = relativeTime(item.createdAt);
  fragment.querySelector('.clip-size').textContent = sizeLabel(item.text);
  textButton.textContent = item.text;
  favoriteButton.textContent = item.favorite ? '★' : '☆';
  favoriteButton.setAttribute('aria-label', item.favorite ? 'Remove from favorites' : 'Add to favorites');

  tagButton.addEventListener('click', () => {
    selectedTag = item.tag;
    render();
  });

  const copy = async () => {
    const result = await window.clipdeck.copy(item.id);
    if (result.ok) flash('Copied');
  };

  textButton.addEventListener('click', copy);
  fragment.querySelector('.copy-action').addEventListener('click', copy);
  favoriteButton.addEventListener('click', () => window.clipdeck.toggleFavorite(item.id));
  fragment.querySelector('.delete-action').addEventListener('click', () => window.clipdeck.remove(item.id));

  return fragment;
}

function renderTimeline(items) {
  const groups = new Map();

  for (const item of items) {
    const bucket = timelineBucket(item.createdAt);
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket).push(item);
  }

  for (const [label, groupedItems] of groups) {
    const section = document.createElement('section');
    section.className = 'timeline-group';

    const heading = document.createElement('div');
    heading.className = 'timeline-heading';

    const title = document.createElement('h2');
    title.textContent = label;

    const count = document.createElement('span');
    count.textContent = String(groupedItems.length);

    heading.append(title, count);
    section.appendChild(heading);

    const groupList = document.createElement('div');
    groupList.className = 'timeline-items';

    for (const item of groupedItems) {
      groupList.appendChild(createClipCard(item));
    }

    section.appendChild(groupList);
    clipsList.appendChild(section);
  }
}

function renderUpdateState() {
  const version = updateState.currentVersion || '—';
  updateVersion.textContent = `Current version: ${version}`;

  let message = 'Automatic updates are enabled.';
  if (!updateState.supported) message = 'Automatic updates are available in the installed Windows build.';
  if (updateState.status === 'checking') message = 'Checking for updates…';
  if (updateState.status === 'up-to-date') message = 'You are up to date.';
  if (updateState.status === 'downloading') {
    const suffix = Number.isFinite(updateState.progress) ? ` ${updateState.progress}%` : '';
    message = `Downloading ClipDeck ${updateState.availableVersion || ''}${suffix}…`.replace('  ', ' ');
  }
  if (updateState.status === 'ready') {
    message = `ClipDeck ${updateState.availableVersion} is downloaded and ready to install.`;
  }
  if (updateState.status === 'error') message = updateState.error || 'Update check failed.';

  updateStatus.textContent = message;
  updateStatus.classList.toggle('error', updateState.status === 'error');

  const showProgress = updateState.status === 'downloading';
  updateProgressWrap.classList.toggle('hidden', !showProgress);
  updateProgress.style.width = `${Number.isFinite(updateState.progress) ? updateState.progress : 0}%`;

  checkUpdatesButton.disabled = !updateState.supported
    || updateState.status === 'checking'
    || updateState.status === 'downloading';
  installUpdateButton.classList.toggle('hidden', updateState.status !== 'ready');
}

function renderSettings() {
  const shortcut = state.settings.shortcut || 'CommandOrControl+Shift+V';
  if (!capturingShortcut) shortcutCapture.textContent = prettyShortcut(shortcut);
  footerShortcut.textContent = prettyShortcut(shortcut);
  renderUpdateState();
}

function render() {
  const items = filteredItems();
  clipsList.replaceChildren();

  countLabel.textContent = `${state.items.length} ${state.items.length === 1 ? 'clip' : 'clips'}`;
  limitSelect.value = String(state.settings.limit);
  pauseButton.classList.toggle('paused', state.settings.paused);
  pauseButton.setAttribute('aria-label', state.settings.paused ? 'Resume clipboard monitoring' : 'Pause clipboard monitoring');
  pauseButton.title = state.settings.paused ? 'Resume monitoring' : 'Pause monitoring';
  pauseIcon.textContent = state.settings.paused ? '▶' : 'Ⅱ';

  renderTagFilters();
  renderSettings();

  if (state.settings.paused) {
    statusBanner.textContent = 'Clipboard monitoring is paused. New copies will not be saved.';
    statusBanner.classList.remove('hidden');
  } else {
    statusBanner.classList.add('hidden');
  }

  emptyState.classList.toggle('hidden', items.length > 0);
  if (items.length === 0 && (searchInput.value || favoritesOnly || selectedTag)) {
    emptyState.querySelector('h2').textContent = 'No matching clips';
    emptyState.querySelector('p').textContent = 'Try a different search or clear the active filters.';
  } else {
    emptyState.querySelector('h2').textContent = 'No clips yet';
    emptyState.querySelector('p').textContent = 'Copy some text and it will appear here automatically.';
  }

  renderTimeline(items);
}

function openSettings() {
  settingsOverlay.classList.remove('hidden');
  renderSettings();
  settingsCloseButton.focus();
}

function closeSettings() {
  capturingShortcut = false;
  shortcutCapture.classList.remove('recording');
  shortcutError.classList.add('hidden');
  settingsOverlay.classList.add('hidden');
  settingsButton.focus();
}

searchInput.addEventListener('input', render);

favoritesButton.addEventListener('click', () => {
  favoritesOnly = !favoritesOnly;
  favoritesButton.setAttribute('aria-pressed', String(favoritesOnly));
  render();
});

pauseButton.addEventListener('click', async () => {
  await window.clipdeck.setPaused(!state.settings.paused);
});

limitSelect.addEventListener('change', async () => {
  await window.clipdeck.setLimit(Number(limitSelect.value));
});

clearButton.addEventListener('click', async () => {
  if (state.items.some((item) => !item.favorite)) {
    await window.clipdeck.clear();
    flash('Cleared non-favorites');
  }
});

settingsButton.addEventListener('click', openSettings);
settingsCloseButton.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (event) => {
  if (event.target === settingsOverlay) closeSettings();
});

shortcutCapture.addEventListener('click', () => {
  capturingShortcut = true;
  shortcutCapture.classList.add('recording');
  shortcutCapture.textContent = 'Press a shortcut…';
  shortcutError.classList.add('hidden');
  shortcutCapture.focus();
});

document.addEventListener('keydown', async (event) => {
  if (!capturingShortcut) {
    if (event.key === 'Escape' && !settingsOverlay.classList.contains('hidden')) closeSettings();
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.key === 'Escape') {
    capturingShortcut = false;
    shortcutCapture.classList.remove('recording');
    shortcutCapture.textContent = prettyShortcut(state.settings.shortcut);
    return;
  }

  const shortcut = shortcutFromKeyboardEvent(event);
  if (!shortcut) {
    shortcutCapture.textContent = 'Use Ctrl/Alt/⌘ + a key';
    return;
  }

  capturingShortcut = false;
  shortcutCapture.classList.remove('recording');
  shortcutCapture.textContent = prettyShortcut(shortcut);

  const result = await window.clipdeck.setShortcut(shortcut);
  if (!result.ok) {
    shortcutError.textContent = result.error || 'That shortcut could not be registered.';
    shortcutError.classList.remove('hidden');
    shortcutCapture.textContent = prettyShortcut(result.shortcut || state.settings.shortcut);
    return;
  }

  shortcutError.classList.add('hidden');
  flash(`Shortcut changed to ${prettyShortcut(result.shortcut)}`);
});

checkUpdatesButton.addEventListener('click', async () => {
  await window.clipdeck.checkForUpdates();
});

installUpdateButton.addEventListener('click', async () => {
  installUpdateButton.disabled = true;
  await window.clipdeck.installUpdate();
});

window.clipdeck.onChanged((nextState) => {
  state = nextState;
  render();
});

window.clipdeck.onUpdateChanged((nextState) => {
  updateState = nextState;
  renderUpdateState();
});

Promise.all([
  window.clipdeck.getState(),
  window.clipdeck.getUpdateState(),
]).then(([initialState, initialUpdateState]) => {
  state = initialState;
  updateState = initialUpdateState;
  render();
});

window.setInterval(() => {
  if (state.items.length) render();
}, 30_000);
