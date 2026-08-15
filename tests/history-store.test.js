const test = require('node:test');
const assert = require('node:assert/strict');
const { HistoryStore, clampLimit, detectTag } = require('../src/history-store');

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

test('favorites survive clearing', () => {
  const store = new HistoryStore();
  const favorite = store.add('keep me', 100);
  store.add('remove me', 200);
  store.toggleFavorite(favorite.id);
  store.clear({ keepFavorites: true });

  const items = store.snapshot().items;
  assert.equal(items.length, 1);
  assert.equal(items[0].text, 'keep me');
  assert.equal(items[0].favorite, true);
});

test('limit accepts only supported values', () => {
  assert.equal(clampLimit(25), 25);
  assert.equal(clampLimit('250'), 250);
  assert.equal(clampLimit(999), 100);
});

test('favorite entries are preserved when enforcing the limit', () => {
  const store = new HistoryStore();
  store.setLimit(25);

  const oldest = store.add('favorite', 1);
  store.toggleFavorite(oldest.id);
  for (let i = 0; i < 30; i += 1) store.add(`clip-${i}`, i + 2);

  const items = store.snapshot().items;
  assert.equal(items.length, 25);
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

test('new history items include their detected tag', () => {
  const store = new HistoryStore();
  const item = store.add('npm run build', 100);
  assert.equal(item.tag, 'Command');
  assert.equal(store.snapshot().items[0].tag, 'Command');
});
