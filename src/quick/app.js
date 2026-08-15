const searchInput = document.querySelector('#quickSearch');
const list = document.querySelector('#quickList');
const empty = document.querySelector('#quickEmpty');

let state = { items: [], settings: { limit: 100, paused: false } };
let selectedIndex = 0;
let visibleItems = [];

function relativeTime(timestamp) {
  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function results() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  return state.items
    .filter((item) => {
      if (!query) return true;
      return item.text.toLocaleLowerCase().includes(query)
        || item.tag.toLocaleLowerCase().includes(query);
    })
    .slice(0, 12);
}

async function copyItem(item) {
  const result = await window.clipdeck.copy(item.id);
  if (result.ok) window.close();
}

function render() {
  visibleItems = results();
  selectedIndex = Math.min(selectedIndex, Math.max(0, visibleItems.length - 1));
  list.replaceChildren();
  empty.classList.toggle('hidden', visibleItems.length > 0);

  visibleItems.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quick-item';
    button.classList.toggle('selected', index === selectedIndex);

    const meta = document.createElement('div');
    meta.className = 'item-meta';

    const tag = document.createElement('span');
    tag.className = 'item-tag';
    tag.textContent = item.tag;

    const time = document.createElement('span');
    time.textContent = relativeTime(item.createdAt);

    meta.append(tag, time);

    const preview = document.createElement('span');
    preview.className = 'item-preview';
    preview.textContent = item.text;

    button.append(meta, preview);
    button.addEventListener('mouseenter', () => {
      selectedIndex = index;
      renderSelection();
    });
    button.addEventListener('click', () => copyItem(item));

    list.appendChild(button);
  });

  renderSelection();
}

function renderSelection() {
  const buttons = [...list.querySelectorAll('.quick-item')];
  buttons.forEach((button, index) => button.classList.toggle('selected', index === selectedIndex));
  buttons[selectedIndex]?.scrollIntoView({ block: 'nearest' });
}

searchInput.addEventListener('input', () => {
  selectedIndex = 0;
  render();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    window.close();
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (visibleItems.length) selectedIndex = (selectedIndex + 1) % visibleItems.length;
    renderSelection();
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (visibleItems.length) {
      selectedIndex = (selectedIndex - 1 + visibleItems.length) % visibleItems.length;
    }
    renderSelection();
    return;
  }

  if (event.key === 'Enter' && visibleItems[selectedIndex]) {
    event.preventDefault();
    copyItem(visibleItems[selectedIndex]);
  }
});

window.addEventListener('focus', () => {
  searchInput.value = '';
  selectedIndex = 0;
  render();
  window.setTimeout(() => searchInput.focus(), 0);
});

window.clipdeck.onChanged((nextState) => {
  state = nextState;
  render();
});

window.clipdeck.getState().then((initialState) => {
  state = initialState;
  render();
  searchInput.focus();
});
