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

let state = { items: [], settings: { limit: 100, paused: false } };
let favoritesOnly = false;
let selectedTag = null;

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
  flash.timer = window.setTimeout(() => toast.classList.add('hidden'), 1400);
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

window.clipdeck.onChanged((nextState) => {
  state = nextState;
  render();
});

window.clipdeck.getState().then((initialState) => {
  state = initialState;
  render();
});

window.setInterval(() => {
  if (state.items.length) render();
}, 30_000);
