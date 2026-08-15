const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SnippetStore,
  extractVariables,
  normalizeTrigger,
  renderTemplate,
} = require('../src/snippet-store');

test('extracts unique template variables in order', () => {
  assert.deepEqual(extractVariables('Hello {{name}}, meet {{name}} on {{date}}.'), ['name', 'date']);
});

test('renders template variables', () => {
  assert.equal(renderTemplate('Hello {{ name }}!', { name: 'Yavuz' }), 'Hello Yavuz!');
});

test('normalizes snippet triggers', () => {
  assert.equal(normalizeTrigger(' Work Mail! '), 'work-mail');
  assert.equal(normalizeTrigger('adres_ev'), 'adres_ev');
});

test('saves, updates and finds snippets by trigger', () => {
  const store = new SnippetStore();
  const first = store.save({
    name: 'Mail',
    trigger: 'mail',
    template: 'hello@example.com',
  }, 100);
  assert.equal(store.list().length, 1);
  assert.equal(store.findByTrigger('MAIL').id, first.id);
  assert.equal(first.trigger, 'mail');

  store.save({
    id: first.id,
    name: 'Work mail',
    trigger: 'wmail',
    template: 'work@example.com',
  }, 200);
  const items = store.list();
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Work mail');
  assert.equal(items[0].trigger, 'wmail');
  assert.equal(items[0].updatedAt, 200);
  assert.equal(store.findByTrigger('mail'), null);
  assert.equal(store.findByTrigger('wmail').template, 'work@example.com');
});

test('snippet name becomes its trigger when trigger is omitted', () => {
  const store = new SnippetStore();
  const item = store.save({ name: 'Support Reply', template: 'Hello' }, 100);
  assert.equal(item.trigger, 'support-reply');
});
