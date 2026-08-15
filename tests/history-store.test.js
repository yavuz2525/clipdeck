const test = require('node:test');
const assert = require('node:assert/strict');
const { HistoryStore, clampLimit, clampTheme, detectTag } = require('../src/history-store');

test('rejects empty clipboard values', () => {
  const store = new HistoryStore();
  assert.equal(store.add('   '), null);
  assert.equal(store.snapshot().items.length, 0);
});

test('deduplicates exact text and moves it to the front', () => {
  const store = new HistoryStore();
  const first = store.add('alpha', 100);
  store.add('beta', 200);
  const again = store.add('alpha', 300);
  const items = store.snapshot().items;
  assert.equal(items.length, 2);
  assert.equal(items[0].text, 'alpha');
  assert.equal(items[0].id, first.id);
  assert.equal(again.createdAt, 300);
});

test('favorites and pinned items survive clearing', () => {
  const store = new HistoryStore();
  const favorite = store.add('favorite', 100);
  const pinned = store.add('pinned', 200);
  store.add('remove me', 300);
  store.toggleFavorite(favorite.id);
  store.togglePin(pinned.id);
  store.clear({ keepFavorites: true, keepPinned: true });
  const items = store.snapshot().items;
  assert.equal(items.length, 2);
  assert.ok(items.some((item) => item.text === 'favorite' && item.favorite));
  assert.ok(items.some((item) => item.text === 'pinned' && item.pinned));
});

test('limit accepts only supported values', () => {
  assert.equal(clampLimit(25), 25);
  assert.equal(clampLimit('250'), 250);
  assert.equal(clampLimit(999), 100);
});

test('pinned and favorite entries are prioritized when enforcing the limit', () => {
  const store = new HistoryStore();
  store.setLimit(25);
  const pinned = store.add('pinned', 1);
  const favorite = store.add('favorite', 2);
  store.togglePin(pinned.id);
  store.toggleFavorite(favorite.id);
  for (let i = 0; i < 30; i += 1) store.add(`clip-${i}`, i + 3);
  const items = store.snapshot().items;
  assert.equal(items.length, 25);
  assert.ok(items.some((item) => item.text === 'pinned'));
  assert.ok(items.some((item) => item.text === 'favorite'));
});

test('automatically tags common clipboard content', () => {
  assert.equal(detectTag('https://example.com/docs'), 'URL');
  assert.equal(detectTag('hello@example.com'), 'Email');
  assert.equal(detectTag('{"name":"ClipDeck"}'), 'JSON');
  assert.equal(detectTag('SELECT * FROM clips;'), 'SQL');
  assert.equal(detectTag('git status'), 'Command');
  assert.equal(detectTag('const answer = 42;'), 'Code');
  assert.equal(detectTag('#17624F'), 'Color');
  assert.equal(detectTag('192.168.1.1'), 'IP');
  assert.equal(detectTag('C:\\Users\\Yavuz\\Desktop\\clip.txt'), 'Path');
  assert.equal(detectTag('Just a normal sentence.'), 'Text');
});

test('new history items include tag and pin state', () => {
  const store = new HistoryStore();
  const item = store.add('npm run build', 100);
  assert.equal(item.tag, 'Command');
  assert.equal(item.pinned, false);
});

test('quick panel shortcut and theme persist in settings', () => {
  const store = new HistoryStore();
  store.setShortcut('Control+Alt+V');
  store.setTheme('dark');
  assert.equal(store.snapshot().settings.shortcut, 'Control+Alt+V');
  assert.equal(store.snapshot().settings.theme, 'dark');
  assert.equal(clampTheme('nope'), 'system');
});
