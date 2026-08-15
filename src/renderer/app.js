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

let state = { items: [], settings: { limit: 100, paused: false } };
let favoritesOnly = false;

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

function filteredItems() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  return state.items.filter((item) => {
    if (favoritesOnly && !item.favorite) return false;
    if (!query) return true;
    return item.text.toLocaleLowerCase().includes(query);
  });
}

function flash(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  window.clearTimeout(flash.timer);
  flash.timer = window.setTimeout(() => toast.classList.add('hidden'), 1400);
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

  if (state.settings.paused) {
    statusBanner.textContent = 'Clipboard monitoring is paused. New copies will not be saved.';
    statusBanner.classList.remove('hidden');
  } else if (statusBanner.textContent.includes('monitoring is paused')) {
    statusBanner.classList.add('hidden');
  }

  emptyState.classList.toggle('hidden', items.length > 0);
  if (items.length === 0 && (searchInput.value || favoritesOnly)) {
    emptyState.querySelector('h2').textContent = 'No matching clips';
    emptyState.querySelector('p').textContent = 'Try a different search or turn off the favorites filter.';
  } else {
    emptyState.querySelector('h2').textContent = 'No clips yet';
    emptyState.querySelector('p').textContent = 'Copy some text and it will appear here automatically.';
  }

  for (const item of items) {
    const fragment = clipTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.clip-card');
    const textButton = fragment.querySelector('.clip-text');
    const favoriteButton = fragment.querySelector('.favorite-action');

    card.classList.toggle('favorite', item.favorite);
    fragment.querySelector('.clip-time').textContent = relativeTime(item.createdAt);
    fragment.querySelector('.clip-size').textContent = sizeLabel(item.text);
    textButton.textContent = item.text;
    favoriteButton.textContent = item.favorite ? '★' : '☆';
    favoriteButton.setAttribute('aria-label', item.favorite ? 'Remove from favorites' : 'Add to favorites');

    const copy = async () => {
      const result = await window.clipdeck.copy(item.id);
      if (result.ok) flash('Copied');
    };

    textButton.addEventListener('click', copy);
    fragment.querySelector('.copy-action').addEventListener('click', copy);
    favoriteButton.addEventListener('click', () => window.clipdeck.toggleFavorite(item.id));
    fragment.querySelector('.delete-action').addEventListener('click', () => window.clipdeck.remove(item.id));

    clipsList.appendChild(fragment);
  }
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
