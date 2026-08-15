const searchInput = document.querySelector('#searchInput');
const favoritesButton = document.querySelector('#favoritesButton');
const pinnedButton = document.querySelector('#pinnedButton');
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
const themeSelect = document.querySelector('#themeSelect');
const updateVersion = document.querySelector('#updateVersion');
const updateStatus = document.querySelector('#updateStatus');
const updateProgressWrap = document.querySelector('#updateProgressWrap');
const updateProgress = document.querySelector('#updateProgress');
const checkUpdatesButton = document.querySelector('#checkUpdatesButton');
const installUpdateButton = document.querySelector('#installUpdateButton');

const historyView = document.querySelector('#historyView');
const snippetsView = document.querySelector('#snippetsView');
const vaultView = document.querySelector('#vaultView');
const viewTabs = [...document.querySelectorAll('.view-tab')];

const newSnippetButton = document.querySelector('#newSnippetButton');
const snippetSearch = document.querySelector('#snippetSearch');
const snippetsList = document.querySelector('#snippetsList');
const snippetsEmpty = document.querySelector('#snippetsEmpty');
const snippetEditorOverlay = document.querySelector('#snippetEditorOverlay');
const snippetEditorTitle = document.querySelector('#snippetEditorTitle');
const snippetEditorClose = document.querySelector('#snippetEditorClose');
const snippetId = document.querySelector('#snippetId');
const snippetName = document.querySelector('#snippetName');
const snippetTemplate = document.querySelector('#snippetTemplate');
const snippetCancelButton = document.querySelector('#snippetCancelButton');
const snippetSaveButton = document.querySelector('#snippetSaveButton');
const snippetUseOverlay = document.querySelector('#snippetUseOverlay');
const snippetUseTitle = document.querySelector('#snippetUseTitle');
const snippetUseClose = document.querySelector('#snippetUseClose');
const snippetVariableFields = document.querySelector('#snippetVariableFields');
const snippetUseCancel = document.querySelector('#snippetUseCancel');
const snippetUseCopy = document.querySelector('#snippetUseCopy');

const newVaultButton = document.querySelector('#newVaultButton');
const vaultWarning = document.querySelector('#vaultWarning');
const vaultSearch = document.querySelector('#vaultSearch');
const vaultList = document.querySelector('#vaultList');
const vaultEmpty = document.querySelector('#vaultEmpty');
const passwordLength = document.querySelector('#passwordLength');
const genLowercase = document.querySelector('#genLowercase');
const genUppercase = document.querySelector('#genUppercase');
const genNumbers = document.querySelector('#genNumbers');
const genSymbols = document.querySelector('#genSymbols');
const generatedPassword = document.querySelector('#generatedPassword');
const generatePasswordButton = document.querySelector('#generatePasswordButton');
const copyGeneratedButton = document.querySelector('#copyGeneratedButton');
const saveGeneratedButton = document.querySelector('#saveGeneratedButton');
const vaultEditorOverlay = document.querySelector('#vaultEditorOverlay');
const vaultEditorTitle = document.querySelector('#vaultEditorTitle');
const vaultEditorClose = document.querySelector('#vaultEditorClose');
const vaultId = document.querySelector('#vaultId');
const vaultTitle = document.querySelector('#vaultTitle');
const vaultUsername = document.querySelector('#vaultUsername');
const vaultPassword = document.querySelector('#vaultPassword');
const vaultUrl = document.querySelector('#vaultUrl');
const vaultNotes = document.querySelector('#vaultNotes');
const vaultGenerateButton = document.querySelector('#vaultGenerateButton');
const vaultRevealButton = document.querySelector('#vaultRevealButton');
const vaultCancelButton = document.querySelector('#vaultCancelButton');
const vaultSaveButton = document.querySelector('#vaultSaveButton');

let state = {
  items: [],
  settings: {
    limit: 100,
    paused: false,
    shortcut: 'CommandOrControl+Shift+V',
    theme: 'system',
  },
};
let updateState = {
  supported: false,
  status: 'disabled',
  currentVersion: null,
  availableVersion: null,
  progress: null,
  error: null,
};
let snippets = [];
let vaultItems = [];
let vaultStatus = { available: false, secure: false, backend: 'OS protected storage' };
let favoritesOnly = false;
let pinnedOnly = false;
let selectedTag = null;
let capturingShortcut = false;
let activeView = 'history';
let activeSnippetForUse = null;

function applyTheme(theme) {
  document.documentElement.dataset.theme = ['system', 'dark', 'light'].includes(theme) ? theme : 'system';
}

function relativeTime(timestamp) {
  const diff = Math.max(0, Date.now() - timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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

function flash(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  window.clearTimeout(flash.timer);
  flash.timer = window.setTimeout(() => toast.classList.add('hidden'), 1800);
}

function filteredItems() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  return state.items.filter((item) => {
    if (favoritesOnly && !item.favorite) return false;
    if (pinnedOnly && !item.pinned) return false;
    if (selectedTag && item.tag !== selectedTag) return false;
    if (!query) return true;
    return item.text.toLocaleLowerCase().includes(query)
      || item.tag.toLocaleLowerCase().includes(query);
  });
}

function renderTagFilters() {
  const counts = new Map();
  for (const item of state.items) counts.set(item.tag, (counts.get(item.tag) || 0) + 1);
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
      renderHistory();
    });
    tagFilters.appendChild(button);
  }
}

function createClipCard(item) {
  const fragment = clipTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.clip-card');
  const textButton = fragment.querySelector('.clip-text');
  const favoriteButton = fragment.querySelector('.favorite-action');
  const pinButton = fragment.querySelector('.pin-action');
  const tagButton = fragment.querySelector('.clip-tag');

  card.classList.toggle('favorite', item.favorite);
  card.classList.toggle('pinned', item.pinned);
  tagButton.textContent = item.tag;
  fragment.querySelector('.clip-time').textContent = relativeTime(item.createdAt);
  fragment.querySelector('.clip-size').textContent = sizeLabel(item.text);
  textButton.textContent = item.text;
  favoriteButton.textContent = item.favorite ? '★' : '☆';
  favoriteButton.setAttribute('aria-label', item.favorite ? 'Remove from favorites' : 'Add to favorites');
  pinButton.textContent = item.pinned ? '●' : '⌖';
  pinButton.classList.toggle('active', item.pinned);
  pinButton.setAttribute('aria-label', item.pinned ? 'Unpin clip' : 'Pin clip');

  tagButton.addEventListener('click', () => {
    selectedTag = item.tag;
    renderHistory();
  });

  const copy = async () => {
    const result = await window.clipdeck.copy(item.id);
    if (result.ok) flash('Copied');
  };

  textButton.addEventListener('click', copy);
  fragment.querySelector('.copy-action').addEventListener('click', copy);
  fragment.querySelector('.snippet-action').addEventListener('click', () => openSnippetEditor({ template: item.text }));
  pinButton.addEventListener('click', () => window.clipdeck.togglePin(item.id));
  favoriteButton.addEventListener('click', () => window.clipdeck.toggleFavorite(item.id));
  fragment.querySelector('.delete-action').addEventListener('click', () => window.clipdeck.remove(item.id));
  return fragment;
}

function appendTimelineGroup(label, items) {
  if (!items.length) return;
  const section = document.createElement('section');
  section.className = 'timeline-group';
  const heading = document.createElement('div');
  heading.className = 'timeline-heading';
  const title = document.createElement('h2');
  title.textContent = label;
  const count = document.createElement('span');
  count.textContent = String(items.length);
  heading.append(title, count);
  section.appendChild(heading);
  const groupList = document.createElement('div');
  groupList.className = 'timeline-items';
  for (const item of items) groupList.appendChild(createClipCard(item));
  section.appendChild(groupList);
  clipsList.appendChild(section);
}

function renderTimeline(items) {
  const pinned = items.filter((item) => item.pinned);
  const regular = items.filter((item) => !item.pinned);
  appendTimelineGroup('Pinned', pinned);

  const groups = new Map();
  for (const item of regular) {
    const bucket = timelineBucket(item.createdAt);
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket).push(item);
  }
  for (const [label, groupedItems] of groups) appendTimelineGroup(label, groupedItems);
}

function renderHistory() {
  const items = filteredItems();
  clipsList.replaceChildren();
  countLabel.textContent = `${state.items.length} ${state.items.length === 1 ? 'clip' : 'clips'}`;
  limitSelect.value = String(state.settings.limit);
  pauseButton.classList.toggle('paused', state.settings.paused);
  pauseButton.setAttribute('aria-label', state.settings.paused ? 'Resume clipboard monitoring' : 'Pause clipboard monitoring');
  pauseButton.title = state.settings.paused ? 'Resume monitoring' : 'Pause monitoring';
  pauseIcon.textContent = state.settings.paused ? '▶' : 'Ⅱ';
  pinnedButton.setAttribute('aria-pressed', String(pinnedOnly));
  favoritesButton.setAttribute('aria-pressed', String(favoritesOnly));
  renderTagFilters();

  if (state.settings.paused) {
    statusBanner.textContent = 'Clipboard monitoring is paused. New copies will not be saved.';
    statusBanner.classList.remove('hidden');
  } else {
    statusBanner.classList.add('hidden');
  }

  emptyState.classList.toggle('hidden', items.length > 0);
  if (items.length === 0 && (searchInput.value || favoritesOnly || pinnedOnly || selectedTag)) {
    emptyState.querySelector('h2').textContent = 'No matching clips';
    emptyState.querySelector('p').textContent = 'Try a different search or clear the active filters.';
  } else {
    emptyState.querySelector('h2').textContent = 'No clips yet';
    emptyState.querySelector('p').textContent = 'Copy some text and it will appear here automatically.';
  }
  renderTimeline(items);
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
  if (updateState.status === 'ready') message = `ClipDeck ${updateState.availableVersion} is downloaded and ready to install.`;
  if (updateState.status === 'error') message = updateState.error || 'Update check failed.';
  updateStatus.textContent = message;
  updateStatus.classList.toggle('error', updateState.status === 'error');
  const showProgress = updateState.status === 'downloading';
  updateProgressWrap.classList.toggle('hidden', !showProgress);
  updateProgress.style.width = `${Number.isFinite(updateState.progress) ? updateState.progress : 0}%`;
  checkUpdatesButton.disabled = !updateState.supported || updateState.status === 'checking' || updateState.status === 'downloading';
  installUpdateButton.classList.toggle('hidden', updateState.status !== 'ready');
}

function renderSettings() {
  const shortcut = state.settings.shortcut || 'CommandOrControl+Shift+V';
  if (!capturingShortcut) shortcutCapture.textContent = prettyShortcut(shortcut);
  footerShortcut.textContent = prettyShortcut(shortcut);
  themeSelect.value = state.settings.theme || 'system';
  renderUpdateState();
}

function renderSnippetCard(item) {
  const card = document.createElement('article');
  card.className = 'content-card';
  const head = document.createElement('div');
  head.className = 'content-card-head';
  const titleWrap = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = item.name;
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = `Updated ${relativeTime(item.updatedAt)}`;
  titleWrap.append(title, meta);
  head.appendChild(titleWrap);
  card.appendChild(head);

  if (item.variables?.length) {
    const badges = document.createElement('div');
    badges.className = 'variable-badges';
    for (const variable of item.variables) {
      const badge = document.createElement('span');
      badge.className = 'variable-badge';
      badge.textContent = `{{${variable}}}`;
      badges.appendChild(badge);
    }
    card.appendChild(badges);
  }

  const preview = document.createElement('p');
  preview.className = 'content-card-preview';
  preview.textContent = item.template;
  card.appendChild(preview);

  const actions = document.createElement('div');
  actions.className = 'content-actions';
  const use = document.createElement('button');
  use.className = 'text-button primary';
  use.type = 'button';
  use.textContent = item.variables?.length ? 'Fill & copy' : 'Copy';
  use.addEventListener('click', () => useSnippet(item));
  const edit = document.createElement('button');
  edit.className = 'text-button';
  edit.type = 'button';
  edit.textContent = 'Edit';
  edit.addEventListener('click', () => openSnippetEditor(item));
  const remove = document.createElement('button');
  remove.className = 'text-button danger';
  remove.type = 'button';
  remove.textContent = 'Delete';
  remove.addEventListener('click', async () => {
    await window.clipdeck.removeSnippet(item.id);
    await loadSnippets();
    flash('Snippet deleted');
  });
  actions.append(use, edit, remove);
  card.appendChild(actions);
  return card;
}

function renderSnippets() {
  const query = snippetSearch.value.trim().toLocaleLowerCase();
  const items = snippets.filter((item) => !query
    || item.name.toLocaleLowerCase().includes(query)
    || item.template.toLocaleLowerCase().includes(query));
  snippetsList.replaceChildren();
  for (const item of items) snippetsList.appendChild(renderSnippetCard(item));
  snippetsEmpty.classList.toggle('hidden', items.length > 0);
  snippetsEmpty.querySelector('h2').textContent = query ? 'No matching snippets' : 'No snippets yet';
}

async function loadSnippets() {
  snippets = await window.clipdeck.listSnippets();
  renderSnippets();
}

function openSnippetEditor(item = {}) {
  snippetEditorTitle.textContent = item.id ? 'Edit snippet' : 'New snippet';
  snippetId.value = item.id || '';
  snippetName.value = item.name || '';
  snippetTemplate.value = item.template || '';
  snippetEditorOverlay.classList.remove('hidden');
  window.setTimeout(() => (item.name ? snippetTemplate : snippetName).focus(), 0);
}

function closeSnippetEditor() {
  snippetEditorOverlay.classList.add('hidden');
}

async function useSnippet(item) {
  if (!item.variables?.length) {
    const result = await window.clipdeck.copySnippet(item.id, {});
    if (result.ok) flash('Snippet copied');
    return;
  }

  activeSnippetForUse = item;
  snippetUseTitle.textContent = item.name;
  snippetVariableFields.replaceChildren();
  for (const variable of item.variables) {
    const label = document.createElement('label');
    label.className = 'field';
    label.textContent = variable;
    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.variable = variable;
    label.appendChild(input);
    snippetVariableFields.appendChild(label);
  }
  snippetUseOverlay.classList.remove('hidden');
  window.setTimeout(() => snippetVariableFields.querySelector('input')?.focus(), 0);
}

function closeSnippetUse() {
  activeSnippetForUse = null;
  snippetUseOverlay.classList.add('hidden');
}

function generatorOptions() {
  return {
    length: Number(passwordLength.value),
    lowercase: genLowercase.checked,
    uppercase: genUppercase.checked,
    numbers: genNumbers.checked,
    symbols: genSymbols.checked,
  };
}

async function generatePasswordInto(target = generatedPassword) {
  const result = await window.clipdeck.generatePassword(generatorOptions());
  if (result.ok) target.value = result.password;
  return result.password || '';
}

function renderVaultStatus() {
  if (!vaultStatus.available) {
    vaultWarning.textContent = 'Secure OS storage is unavailable. Vault saving is disabled on this system.';
    vaultWarning.classList.remove('hidden');
    vaultWarning.classList.add('error');
    newVaultButton.disabled = true;
    saveGeneratedButton.disabled = true;
    return;
  }

  newVaultButton.disabled = false;
  saveGeneratedButton.disabled = false;
  if (!vaultStatus.secure) {
    vaultWarning.textContent = `Vault backend: ${vaultStatus.backend}. This backend does not provide strong OS-level protection.`;
    vaultWarning.classList.remove('hidden');
    vaultWarning.classList.add('error');
  } else {
    vaultWarning.textContent = `Vault encryption: ${vaultStatus.backend}. Password payloads are encrypted before being written to disk.`;
    vaultWarning.classList.remove('hidden');
    vaultWarning.classList.remove('error');
    vaultWarning.classList.add('success');
  }
}

function maskPassword(password) {
  return '•'.repeat(Math.max(8, Math.min(18, password.length || 8)));
}

function renderVaultCard(item) {
  const card = document.createElement('article');
  card.className = 'content-card';
  const head = document.createElement('div');
  head.className = 'content-card-head';
  const titleWrap = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = item.title;
  const sub = document.createElement('div');
  sub.className = 'subtle';
  sub.textContent = item.username || item.url || 'Saved password';
  titleWrap.append(title, sub);
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = relativeTime(item.updatedAt);
  head.append(titleWrap, meta);
  card.appendChild(head);

  const secret = document.createElement('div');
  secret.className = 'vault-secret';
  const code = document.createElement('code');
  code.textContent = maskPassword(item.password);
  const reveal = document.createElement('button');
  reveal.type = 'button';
  reveal.className = 'text-button';
  reveal.textContent = 'Show';
  let isRevealed = false;
  reveal.addEventListener('click', () => {
    isRevealed = !isRevealed;
    secret.classList.toggle('revealed', isRevealed);
    code.textContent = isRevealed ? item.password : maskPassword(item.password);
    reveal.textContent = isRevealed ? 'Hide' : 'Show';
  });
  secret.append(code, reveal);
  card.appendChild(secret);

  const actions = document.createElement('div');
  actions.className = 'content-actions';
  const copyPassword = document.createElement('button');
  copyPassword.type = 'button';
  copyPassword.className = 'text-button primary';
  copyPassword.textContent = 'Copy password';
  copyPassword.addEventListener('click', async () => {
    const result = await window.clipdeck.copySensitive(item.password);
    if (result.ok) flash('Password copied without adding it to history');
  });
  actions.appendChild(copyPassword);

  if (item.username) {
    const copyUser = document.createElement('button');
    copyUser.type = 'button';
    copyUser.className = 'text-button';
    copyUser.textContent = 'Copy username';
    copyUser.addEventListener('click', async () => {
      await window.clipdeck.copySensitive(item.username);
      flash('Username copied');
    });
    actions.appendChild(copyUser);
  }

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'text-button';
  edit.textContent = 'Edit';
  edit.addEventListener('click', () => openVaultEditor(item));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'text-button danger';
  remove.textContent = 'Delete';
  remove.addEventListener('click', async () => {
    await window.clipdeck.removeVaultEntry(item.id);
    await loadVault();
    flash('Vault entry deleted');
  });
  actions.append(edit, remove);
  card.appendChild(actions);
  return card;
}

function renderVault() {
  renderVaultStatus();
  const query = vaultSearch.value.trim().toLocaleLowerCase();
  const items = vaultItems.filter((item) => !query
    || item.title.toLocaleLowerCase().includes(query)
    || item.username.toLocaleLowerCase().includes(query)
    || item.url.toLocaleLowerCase().includes(query));
  vaultList.replaceChildren();
  for (const item of items) vaultList.appendChild(renderVaultCard(item));
  vaultEmpty.classList.toggle('hidden', items.length > 0);
  vaultEmpty.querySelector('h2').textContent = query ? 'No matching vault entries' : 'No vault entries';
}

async function loadVault() {
  const result = await window.clipdeck.listVault();
  if (result.status) vaultStatus = result.status;
  vaultItems = result.items || [];
  renderVault();
}

function openVaultEditor(item = {}) {
  if (!vaultStatus.available && !item.id) {
    flash('Secure OS storage is unavailable');
    return;
  }
  vaultEditorTitle.textContent = item.id ? 'Edit vault entry' : 'New vault entry';
  vaultId.value = item.id || '';
  vaultTitle.value = item.title || '';
  vaultUsername.value = item.username || '';
  vaultPassword.value = item.password || '';
  vaultPassword.type = 'password';
  vaultRevealButton.textContent = 'Show';
  vaultUrl.value = item.url || '';
  vaultNotes.value = item.notes || '';
  vaultEditorOverlay.classList.remove('hidden');
  window.setTimeout(() => vaultTitle.focus(), 0);
}

function closeVaultEditor() {
  vaultEditorOverlay.classList.add('hidden');
}

function switchView(view) {
  activeView = ['history', 'snippets', 'vault'].includes(view) ? view : 'history';
  historyView.classList.toggle('hidden', activeView !== 'history');
  snippetsView.classList.toggle('hidden', activeView !== 'snippets');
  vaultView.classList.toggle('hidden', activeView !== 'vault');
  for (const tab of viewTabs) tab.classList.toggle('active', tab.dataset.view === activeView);
  if (activeView === 'snippets') loadSnippets();
  if (activeView === 'vault') loadVault();
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

function closeTopOverlay() {
  if (!vaultEditorOverlay.classList.contains('hidden')) return closeVaultEditor();
  if (!snippetUseOverlay.classList.contains('hidden')) return closeSnippetUse();
  if (!snippetEditorOverlay.classList.contains('hidden')) return closeSnippetEditor();
  if (!settingsOverlay.classList.contains('hidden')) return closeSettings();
  return undefined;
}

function renderAll() {
  applyTheme(state.settings.theme || 'system');
  renderHistory();
  renderSettings();
  if (activeView === 'snippets') renderSnippets();
  if (activeView === 'vault') renderVault();
}

viewTabs.forEach((tab) => tab.addEventListener('click', () => switchView(tab.dataset.view)));
searchInput.addEventListener('input', renderHistory);
snippetSearch.addEventListener('input', renderSnippets);
vaultSearch.addEventListener('input', renderVault);

favoritesButton.addEventListener('click', () => {
  favoritesOnly = !favoritesOnly;
  renderHistory();
});
pinnedButton.addEventListener('click', () => {
  pinnedOnly = !pinnedOnly;
  renderHistory();
});
pauseButton.addEventListener('click', async () => {
  await window.clipdeck.setPaused(!state.settings.paused);
});
limitSelect.addEventListener('change', async () => {
  await window.clipdeck.setLimit(Number(limitSelect.value));
});
clearButton.addEventListener('click', async () => {
  if (state.items.some((item) => !item.favorite && !item.pinned)) {
    await window.clipdeck.clear();
    flash('Cleared history; favorites and pinned clips were kept');
  }
});

settingsButton.addEventListener('click', openSettings);
settingsCloseButton.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (event) => {
  if (event.target === settingsOverlay) closeSettings();
});
themeSelect.addEventListener('change', async () => {
  const result = await window.clipdeck.setTheme(themeSelect.value);
  if (result.ok) {
    applyTheme(result.theme);
    flash(`Theme: ${result.theme}`);
  }
});
shortcutCapture.addEventListener('click', () => {
  capturingShortcut = true;
  shortcutCapture.classList.add('recording');
  shortcutCapture.textContent = 'Press a shortcut…';
  shortcutError.classList.add('hidden');
  shortcutCapture.focus();
});
checkUpdatesButton.addEventListener('click', () => window.clipdeck.checkForUpdates());
installUpdateButton.addEventListener('click', async () => {
  installUpdateButton.disabled = true;
  await window.clipdeck.installUpdate();
});

newSnippetButton.addEventListener('click', () => openSnippetEditor());
snippetEditorClose.addEventListener('click', closeSnippetEditor);
snippetCancelButton.addEventListener('click', closeSnippetEditor);
snippetEditorOverlay.addEventListener('click', (event) => {
  if (event.target === snippetEditorOverlay) closeSnippetEditor();
});
snippetSaveButton.addEventListener('click', async () => {
  const result = await window.clipdeck.saveSnippet({
    id: snippetId.value || undefined,
    name: snippetName.value,
    template: snippetTemplate.value,
  });
  if (!result.ok) return flash(result.error || 'Snippet could not be saved');
  closeSnippetEditor();
  await loadSnippets();
  switchView('snippets');
  flash('Snippet saved');
});
snippetUseClose.addEventListener('click', closeSnippetUse);
snippetUseCancel.addEventListener('click', closeSnippetUse);
snippetUseOverlay.addEventListener('click', (event) => {
  if (event.target === snippetUseOverlay) closeSnippetUse();
});
snippetUseCopy.addEventListener('click', async () => {
  if (!activeSnippetForUse) return;
  const values = {};
  for (const input of snippetVariableFields.querySelectorAll('input[data-variable]')) {
    values[input.dataset.variable] = input.value;
  }
  const result = await window.clipdeck.copySnippet(activeSnippetForUse.id, values);
  if (result.ok) {
    closeSnippetUse();
    flash('Rendered snippet copied');
  }
});

newVaultButton.addEventListener('click', () => openVaultEditor());
generatePasswordButton.addEventListener('click', () => generatePasswordInto());
copyGeneratedButton.addEventListener('click', async () => {
  if (!generatedPassword.value) await generatePasswordInto();
  if (generatedPassword.value) {
    await window.clipdeck.copySensitive(generatedPassword.value);
    flash('Generated password copied without adding it to history');
  }
});
saveGeneratedButton.addEventListener('click', async () => {
  if (!generatedPassword.value) await generatePasswordInto();
  openVaultEditor({ password: generatedPassword.value });
});
vaultEditorClose.addEventListener('click', closeVaultEditor);
vaultCancelButton.addEventListener('click', closeVaultEditor);
vaultEditorOverlay.addEventListener('click', (event) => {
  if (event.target === vaultEditorOverlay) closeVaultEditor();
});
vaultGenerateButton.addEventListener('click', () => generatePasswordInto(vaultPassword));
vaultRevealButton.addEventListener('click', () => {
  const reveal = vaultPassword.type === 'password';
  vaultPassword.type = reveal ? 'text' : 'password';
  vaultRevealButton.textContent = reveal ? 'Hide' : 'Show';
});
vaultSaveButton.addEventListener('click', async () => {
  vaultSaveButton.disabled = true;
  const result = await window.clipdeck.saveVaultEntry({
    id: vaultId.value || undefined,
    title: vaultTitle.value,
    username: vaultUsername.value,
    password: vaultPassword.value,
    url: vaultUrl.value,
    notes: vaultNotes.value,
  });
  vaultSaveButton.disabled = false;
  if (!result.ok) return flash(result.error || 'Vault entry could not be saved');
  closeVaultEditor();
  await loadVault();
  switchView('vault');
  flash('Password saved securely');
});

for (const checkbox of [genLowercase, genUppercase, genNumbers, genSymbols]) {
  checkbox.addEventListener('change', () => generatePasswordInto());
}
passwordLength.addEventListener('change', () => generatePasswordInto());

document.addEventListener('keydown', async (event) => {
  if (!capturingShortcut) {
    if (event.key === 'Escape') closeTopOverlay();
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

window.clipdeck.onChanged((nextState) => {
  state = nextState;
  renderAll();
});
window.clipdeck.onUpdateChanged((nextState) => {
  updateState = nextState;
  renderUpdateState();
});

Promise.all([
  window.clipdeck.getState(),
  window.clipdeck.getUpdateState(),
  window.clipdeck.listSnippets(),
  window.clipdeck.getVaultStatus(),
]).then(([initialState, initialUpdateState, initialSnippets, initialVaultStatus]) => {
  state = initialState;
  updateState = initialUpdateState;
  snippets = initialSnippets;
  vaultStatus = initialVaultStatus;
  renderAll();
  generatePasswordInto();
});

window.setInterval(() => {
  if (state.items.length && activeView === 'history') renderHistory();
}, 30_000);
